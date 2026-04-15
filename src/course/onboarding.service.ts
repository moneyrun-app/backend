import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { calculateVariableCost } from '../finance/variable-cost.calculator';
import { calculateGrade } from '../finance/grade.calculator';
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

  /** 온보딩 진행 상태 조회 */
  async getStatus(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!progress) {
      return {
        currentStep: 1,
        isComplete: false,
        step1: { selectedCategory: null },
        step2: { assignedLevel: null, diagnosticScore: null },
        step3: { financeDataSubmitted: false },
        step4: { generationStatus: null, purchaseId: null },
        step5: { pacemakerWelcomed: false },
      };
    }

    // 유저가 이미 온보딩 완료했는지 확인
    const { data: user } = await this.supabase.db
      .from('users')
      .select('has_completed_onboarding')
      .eq('id', userId)
      .single();

    const isComplete =
      user?.has_completed_onboarding &&
      progress.pacemaker_welcomed;

    return {
      currentStep: progress.current_step,
      isComplete: !!isComplete,
      step1: { selectedCategory: progress.selected_category },
      step2: {
        assignedLevel: progress.assigned_level,
        diagnosticScore: progress.diagnostic_answers
          ? (progress.diagnostic_answers as any).scoreRatio || null
          : null,
      },
      step3: { financeDataSubmitted: !!progress.finance_data },
      step4: {
        generationStatus: progress.generation_status,
        purchaseId: progress.generation_purchase_id,
      },
      step5: { pacemakerWelcomed: progress.pacemaker_welcomed },
    };
  }

  /** Step 1: 관심 분야 선택 */
  async step1SelectCategory(userId: string, category: string) {
    const now = new Date().toISOString();

    // upsert onboarding_progress
    const { data: existing } = await this.supabase.db
      .from('onboarding_progress')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      await this.supabase.db
        .from('onboarding_progress')
        .update({
          selected_category: category,
          current_step: 2,
          // 카테고리 변경 시 이후 단계 초기화
          diagnostic_answers: null,
          assigned_level: null,
          course_id: null,
          updated_at: now,
        })
        .eq('user_id', userId);
    } else {
      await this.supabase.db
        .from('onboarding_progress')
        .insert({
          user_id: userId,
          selected_category: category,
          current_step: 2,
          updated_at: now,
        });
    }

    return { nextStep: 2, selectedCategory: category };
  }

  /** Step 2: 진단퀴즈 문제 조회 */
  async step2GetQuestions(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('selected_category')
      .eq('user_id', userId)
      .single();

    if (!progress?.selected_category) {
      throw new BadRequestException('Step 1을 먼저 완료해주세요.');
    }

    const questions = await this.diagnosticService.getQuestions(progress.selected_category);

    return {
      category: progress.selected_category,
      questions,
    };
  }

  /** Step 2: 진단퀴즈 답변 제출 + 레벨 배정 */
  async step2Submit(
    userId: string,
    answers: Array<{ questionId: string; answer: number }>,
  ) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('selected_category')
      .eq('user_id', userId)
      .single();

    if (!progress?.selected_category) {
      throw new BadRequestException('Step 1을 먼저 완료해주세요.');
    }

    // 채점 + 레벨 배정
    const result = await this.diagnosticService.evaluateAndAssignLevel(
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

    // 코스 제목 조회
    const { data: course } = await this.supabase.db
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();

    // onboarding_progress 업데이트
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        diagnostic_answers: { answers, ...result },
        assigned_level: result.assignedLevel,
        course_id: courseId,
        current_step: 3,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return {
      nextStep: 3,
      assignedLevel: result.assignedLevel,
      courseTitle: course?.title || `${progress.selected_category} ${result.assignedLevel} 과정`,
      scoreRatio: result.scoreRatio,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
    };
  }

  /** Step 3: 재무 데이터 입력 */
  async step3SubmitFinanceData(
    userId: string,
    financeData: {
      nickname: string;
      age: number;
      retirementAge: number;
      pensionStartAge?: number;
      monthlyIncome: number;
      monthlyInvestment: number;
      monthlyFixedCost: number;
      monthlyVariableCost: number;
    },
    courseExtraData?: Record<string, any>,
  ) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('course_id')
      .eq('user_id', userId)
      .single();

    if (!progress?.course_id) {
      throw new BadRequestException('Step 2를 먼저 완료해주세요.');
    }

    // 계산 (기존 auth.service.completeOnboarding 로직 재사용)
    const pensionStartAge = financeData.pensionStartAge ?? 65;
    const monthlyExpense = financeData.monthlyFixedCost + financeData.monthlyVariableCost;
    const surplus = financeData.monthlyIncome - monthlyExpense - financeData.monthlyInvestment;
    const investmentPeriod = financeData.retirementAge - financeData.age;
    const vestingPeriod = pensionStartAge - financeData.retirementAge;
    const grade = calculateGrade(financeData.monthlyIncome, monthlyExpense);
    const variableCost = calculateVariableCost(
      financeData.monthlyIncome,
      financeData.monthlyFixedCost,
      financeData.monthlyInvestment,
    );

    // finance_profiles upsert
    const { data: existingProfile } = await this.supabase.db
      .from('finance_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    const profileData = {
      user_id: userId,
      age: financeData.age,
      retirement_age: financeData.retirementAge,
      pension_start_age: pensionStartAge,
      monthly_income: financeData.monthlyIncome,
      monthly_fixed_cost: financeData.monthlyFixedCost,
      monthly_variable_cost: financeData.monthlyVariableCost,
      monthly_investment: financeData.monthlyInvestment,
      variable_cost_monthly: variableCost.monthly,
      variable_cost_weekly: variableCost.weekly,
      variable_cost_daily: variableCost.daily,
      grade,
    };

    if (existingProfile) {
      await this.supabase.db
        .from('finance_profiles')
        .update(profileData)
        .eq('user_id', userId);
    } else {
      await this.supabase.db
        .from('finance_profiles')
        .insert(profileData);
    }

    // users 업데이트
    await this.supabase.db
      .from('users')
      .update({
        nickname: financeData.nickname,
        has_completed_onboarding: true,
        onboarding_version: 3,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // onboarding_progress 업데이트
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        finance_data: financeData,
        course_extra_data: courseExtraData || null,
        current_step: 4,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return {
      nextStep: 4,
      grade,
      availableBudget: {
        monthly: variableCost.monthly,
        weekly: variableCost.weekly,
        daily: variableCost.daily,
      },
    };
  }

  /** Step 4: AI 마이북 생성 시작 */
  async step4Generate(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!progress?.finance_data || !progress.course_id) {
      throw new BadRequestException('Step 3를 먼저 완료해주세요.');
    }

    // 이미 생성 중이면 기존 상태 반환
    if (progress.generation_status === 'generating') {
      return {
        status: 'generating',
        purchaseId: progress.generation_purchase_id,
        estimatedSeconds: 60,
      };
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
        course_id: progress.course_id,
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

    // 비동기 AI 생성 시작 (기다리지 않음)
    this.courseBookGenerator.generateCourseBook(
      purchase.id,
      userId,
      progress.course_id,
      progress.finance_data as Record<string, any>,
      (progress.course_extra_data as Record<string, any>) || {},
      (progress.diagnostic_answers as any)?.answers || [],
      progress.id,
    );

    return {
      status: 'generating',
      purchaseId: purchase.id,
      estimatedSeconds: 60,
    };
  }

  /** Step 4: 생성 상태 폴링 */
  async step4Status(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('generation_status, generation_purchase_id')
      .eq('user_id', userId)
      .single();

    return {
      status: progress?.generation_status || 'pending',
      purchaseId: progress?.generation_purchase_id || null,
    };
  }

  /** Step 5: 온보딩 완료 + 웰컴 */
  async step5Complete(userId: string) {
    const { data: progress } = await this.supabase.db
      .from('onboarding_progress')
      .select('course_id, generation_status')
      .eq('user_id', userId)
      .single();

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

    const welcomeMessage = `반가워요 ${nickname} 님! 오늘부터 우리 '${courseTitle}' ${targetLevel}까지 함께 달려봐요! 🔥 먼저 1장부터 읽어보고, 첫 미션 도전해볼까?`;

    // onboarding_progress 업데이트
    await this.supabase.db
      .from('onboarding_progress')
      .update({
        pacemaker_welcomed: true,
        current_step: 5,
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
