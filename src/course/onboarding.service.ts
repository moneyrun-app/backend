import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { DiagnosticService } from './diagnostic.service';
import { CourseService } from './course.service';
import { CourseBookGenerator } from './course-book.generator';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly diagnosticService: DiagnosticService,
    private readonly courseService: CourseService,
    private readonly courseBookGenerator: CourseBookGenerator,
  ) {}

  // ========== 온보딩 진행 상태 조회 ==========

  async getStatus(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress) {
      return {
        currentStep: 'select-level',
        isComplete: false,
        selectedCategory: null,
        levelChoice: null,
        assignedLevel: null,
        generationStatus: null,
        purchaseId: null,
      };
    }

    // 완료 여부
    const isComplete = !!progress.pacemaker_welcomed;

    // 현재 단계 판단
    let currentStep: string;
    if (progress.pacemaker_welcomed) {
      currentStep = 'complete';
    } else if (progress.generation_status === 'generating' || progress.generation_status === 'completed') {
      currentStep = 'generation';
    } else if (progress.assigned_level) {
      currentStep = 'generation'; // 레벨 배정됨 → 생성 단계
    } else if (progress.level_choice === 'find-level') {
      currentStep = 'quiz';
    } else {
      currentStep = 'select-level';
    }

    return {
      currentStep,
      isComplete,
      selectedCategory: progress.selected_category,
      levelChoice: progress.level_choice || null,
      assignedLevel: progress.assigned_level,
      generationStatus: progress.generation_status,
      purchaseId: progress.generation_purchase_id,
    };
  }

  // ========== 코스 레벨 선택 ==========

  async selectLevel(userId: string, choice: string) {
    // onboarding_progress 확인 (로그인 시 pre-onboarding에서 생성됨)
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('id, selected_category, finance_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress?.selected_category) {
      throw new BadRequestException('온보딩 데이터가 없습니다. 먼저 로그인 시 pre-onboarding 데이터를 전달해주세요.');
    }

    const category = progress.selected_category;
    const now = new Date().toISOString();

    if (choice === 'beginner') {
      // 기초부터 시작 → 바로 기초 코스 배정 + AI 마이북 생성
      const courseId = await this.courseService.findCourseId(category, '기초');
      if (!courseId) {
        throw new NotFoundException(`${category} 기초 코스를 찾을 수 없습니다.`);
      }

      const { data: course } = await this.supabase.db
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      // onboarding_progress 업데이트
      await this.supabase.db
        .from('onboarding_progress')
        .update({
          level_choice: 'beginner',
          assigned_level: '기초',
          course_id: courseId,
          updated_at: now,
        })
        .eq('user_id', userId);

      // 유저 닉네임 조회
      const { data: user } = await this.supabase.db
        .from('users')
        .select('nickname')
        .eq('id', userId)
        .single();

      const nickname = user?.nickname || '유저';

      // AI 마이북 생성 시작
      await this.startBookGeneration(userId, courseId, progress);

      return {
        choice: 'beginner',
        assignedLevel: '기초',
        courseTitle: course?.title || `${category} 기초 과정`,
        message: `${nickname}님은 ${category} 기초단계부터 차근차근 시작할거에요!`,
        generationStarted: true,
      };
    }

    // find-level → 퀴즈 모드 진입
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        level_choice: 'find-level',
        updated_at: now,
      })
      .eq('user_id', userId);

    return {
      choice: 'find-level',
      message: '실력을 확인하고 딱 맞는 난이도를 찾아드릴게요.',
      nextStep: 'quiz',
    };
  }

  // ========== 퀴즈 문제 조회 ==========

  async getQuizQuestions(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('selected_category, level_choice')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress?.selected_category) {
      throw new BadRequestException('온보딩 데이터가 없습니다.');
    }

    if (progress.level_choice !== 'find-level') {
      throw new BadRequestException('"내 레벨 찾기"를 선택한 유저만 퀴즈를 풀 수 있습니다.');
    }

    const questions = await this.diagnosticService.getQuestions(progress.selected_category);

    return {
      category: progress.selected_category,
      questions,
    };
  }

  // ========== 퀴즈 제출 → 레벨 배정 + AI 생성 자동 시작 ==========

  async submitQuizAndGenerate(
    userId: string,
    answers: Array<{ questionId: string; answer: number }>,
  ) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress?.selected_category || progress.level_choice !== 'find-level') {
      throw new BadRequestException('"내 레벨 찾기"를 먼저 선택해주세요.');
    }

    // 채점 + 레벨 배정 + 오답 저장
    const result = await this.diagnosticService.evaluateAndAssignLevel(
      userId,
      progress.selected_category,
      answers,
    );

    // 코스 ID 조회
    const courseId = await this.courseService.findCourseId(
      progress.selected_category,
      result.assignedLevel,
    );

    if (!courseId) {
      throw new NotFoundException(
        `${progress.selected_category} ${result.assignedLevel} 코스를 찾을 수 없습니다.`,
      );
    }

    const { data: course } = await this.supabase.db
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();

    // 유저 닉네임 조회
    const { data: user } = await this.supabase.db
      .from('users')
      .select('nickname')
      .eq('id', userId)
      .single();

    const nickname = user?.nickname || '유저';
    const category = progress.selected_category;

    // onboarding_progress 업데이트
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        diagnostic_answers: { answers, ...result },
        assigned_level: result.assignedLevel,
        course_id: courseId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // AI 마이북 생성 시작
    await this.startBookGeneration(userId, courseId, progress);

    // 레벨별 결과 메시지
    const levelMessages: Record<string, string> = {
      '기초': `${nickname}님은 ${category} 기초 단계군요! 훌륭한 기초 지식을 가지고 계시네요. 부족한 2%를 채워줄 '${nickname}님 전용 ${category} 마이북'을 만들어드릴게요.`,
      '심화': `${nickname}님은 ${category} 심화 단계군요! 상위권의 지식을 가지고 계시네요. ${category}를 마스터 할 수 있도록 '${nickname}님 전용 ${category} 마이북'을 만들어드릴게요.`,
      '마스터': `${nickname}님은 ${category} 마스터 단계군요! 최상위 지식을 가지고 계시네요. 좀 더 심화된 내용을 더한 '${nickname}님 전용 ${category} 마이북'을 만들어드릴게요.`,
    };

    return {
      assignedLevel: result.assignedLevel,
      courseTitle: course?.title || `${category} ${result.assignedLevel} 과정`,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      message: levelMessages[result.assignedLevel] || '',
      wrongNoteMessage: result.wrongQuestionIds.length > 0
        ? '오늘 푼 퀴즈 중 오답은 마이북 > 오답노트에 쏙 넣어드렸어요!'
        : null,
      generationStarted: true,
    };
  }

  // ========== AI 마이북 생성 시작 (공통) ==========

  private async startBookGeneration(
    userId: string,
    courseId: string,
    progress: any,
  ) {
    // 이미 생성 중이면 스킵
    if (progress.generation_status === 'generating') {
      return;
    }

    // user_purchases 생성
    const { data: purchase, error: purchaseError } = await this.supabase.db
      .from('user_purchases')
      .insert({
        user_id: userId,
        source: 'course',
        status: 'generating',
      })
      .select('id')
      .single();

    if (purchaseError) {
      throw new Error(`구매 레코드 생성 실패: ${purchaseError.message}`);
    }

    // user_courses 생성
    await this.supabase.db
      .from('user_courses')
      .insert({
        user_id: userId,
        course_id: courseId,
        status: 'active',
        purchase_id: purchase.id,
      });

    // onboarding_progress 업데이트
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        generation_status: 'generating',
        generation_purchase_id: purchase.id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // 비동기 AI 생성 시작
    this.courseBookGenerator.generateCourseBook(
      purchase.id,
      userId,
      courseId,
      (progress.finance_data as Record<string, any>) || {},
      (progress.course_extra_data as Record<string, any>) || {},
      (progress.diagnostic_answers as any)?.answers || [],
      progress.id,
    );
  }

  // ========== 생성 상태 폴링 ==========

  async getGenerationStatus(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('generation_status, generation_purchase_id')
      .eq('user_id', userId)
      .maybeSingle();

    let generationProgress = null;
    if (progress?.generation_purchase_id) {
      const { data: purchase } = await this.supabase.db
        .from('user_purchases')
        .select('generation_progress')
        .eq('id', progress.generation_purchase_id)
        .single();
      generationProgress = purchase?.generation_progress || null;
    }

    return {
      status: progress?.generation_status || 'pending',
      purchaseId: progress?.generation_purchase_id || null,
      progress: generationProgress || {
        step: '대기 중',
        percent: 0,
        chaptersDone: 0,
        totalChapters: 0,
      },
    };
  }

  // ========== 온보딩 완료 ==========

  async completeOnboarding(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('course_id, generation_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (progress?.generation_status !== 'completed') {
      throw new BadRequestException('마이북 생성이 아직 완료되지 않았습니다.');
    }

    // 코스 제목 조회
    const { data: course } = await this.supabase.db
      .from('courses')
      .select('title, level')
      .eq('id', progress.course_id)
      .single();

    // 닉네임 조회
    const { data: user } = await this.supabase.db
      .from('users')
      .select('nickname')
      .eq('id', userId)
      .single();

    const nickname = user?.nickname || '유저';
    const courseTitle = course?.title || '코스';
    const targetLevel = course?.level === '기초' ? '심화' : course?.level === '심화' ? '마스터' : '완주';

    const welcomeMessage = `반가워요 ${nickname} 님! 오늘부터 우리 '${courseTitle}' ${targetLevel}까지 함께 달려봐요! 먼저 1장부터 읽어보고, 첫 미션 도전해볼까?`;

    // onboarding_progress 업데이트
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        pacemaker_welcomed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return {
      complete: true,
      welcomeMessage,
      courseTitle,
    };
  }
}
