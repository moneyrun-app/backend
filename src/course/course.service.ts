import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { MissionService } from './mission.service';

@Injectable()
export class CourseService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly missionService: MissionService,
  ) {}

  /** 유저의 활성 코스 조회 */
  async getActiveCourse(userId: string) {
    const { data: userCourse, error } = await this.supabase.db
      .from('user_courses')
      .select(`
        id,
        course_id,
        status,
        purchase_id,
        current_chapter,
        started_at,
        courses (id, category, level, title, description, chapter_count)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !userCourse) return null;

    const course = (userCourse as any).courses;

    // 미션 요약
    const missionProgress = await this.missionService.getMissionProgress(
      userId,
      userCourse.id,
      userCourse.course_id,
      userCourse.current_chapter,
    );

    return {
      userCourseId: userCourse.id,
      courseId: course.id,
      category: course.category,
      level: course.level,
      title: course.title,
      currentChapter: userCourse.current_chapter,
      totalChapters: course.chapter_count,
      purchaseId: userCourse.purchase_id,
      status: userCourse.status,
      missionSummary: {
        total: missionProgress.totalMissions,
        completed: missionProgress.completedMissions,
      },
      startedAt: userCourse.started_at,
    };
  }

  /** 수강 가능한 코스 목록 */
  async getAvailableCourses(userId: string) {
    const { data: courses, error } = await this.supabase.db
      .from('courses')
      .select('id, category, level, title, description, chapter_count')
      .eq('is_active', true)
      .order('category')
      .order('level');

    if (error) {
      throw new Error(`코스 목록 조회 실패: ${error.message}`);
    }

    // 완료한 코스 조회
    const { data: completedCourses } = await this.supabase.db
      .from('user_courses')
      .select('course_id')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const completedIds = new Set(
      (completedCourses || []).map((c: any) => c.course_id),
    );

    return (courses || []).map((c: any) => ({
      id: c.id,
      category: c.category,
      level: c.level,
      title: c.title,
      description: c.description,
      chapterCount: c.chapter_count,
      isCompleted: completedIds.has(c.id),
    }));
  }

  /** 코스 상세 (미션 포함) */
  async getCourseDetail(courseId: string) {
    const { data: course, error } = await this.supabase.db
      .from('courses')
      .select('id, category, level, title, description, chapter_count')
      .eq('id', courseId)
      .single();

    if (error || !course) {
      throw new NotFoundException('코스를 찾을 수 없습니다.');
    }

    const { data: missions } = await this.supabase.db
      .from('course_missions')
      .select('id, chapter_number, mission_order, type, title, description')
      .eq('course_id', courseId)
      .order('chapter_number')
      .order('mission_order');

    return {
      ...course,
      chapterCount: course.chapter_count,
      missions: (missions || []).map((m: any) => ({
        id: m.id,
        chapterNumber: m.chapter_number,
        missionOrder: m.mission_order,
        type: m.type,
        title: m.title,
        description: m.description,
      })),
    };
  }

  /** 새 코스 시작 (이전 코스 완료 후) */
  async startCourse(userId: string, courseId: string) {
    // 활성 코스 있는지 확인
    const active = await this.getActiveCourse(userId);
    if (active) {
      throw new ConflictException('현재 진행 중인 코스를 먼저 완료해주세요.');
    }

    // 코스 존재 확인
    const { data: course, error } = await this.supabase.db
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .eq('is_active', true)
      .single();

    if (error || !course) {
      throw new NotFoundException('코스를 찾을 수 없습니다.');
    }

    // user_purchases 생성 (코스 마이북)
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
    const { data: userCourse, error: ucError } = await this.supabase.db
      .from('user_courses')
      .insert({
        user_id: userId,
        course_id: courseId,
        status: 'active',
        purchase_id: purchase.id,
      })
      .select('id')
      .single();

    if (ucError) {
      throw new Error(`코스 등록 실패: ${ucError.message}`);
    }

    return {
      userCourseId: userCourse.id,
      purchaseId: purchase.id,
      status: 'generating',
      estimatedSeconds: 60,
    };
  }

  /** 활성 코스 완료 */
  async completeCourse(userId: string) {
    const active = await this.getActiveCourse(userId);
    if (!active) {
      throw new NotFoundException('활성 코스가 없습니다.');
    }

    const now = new Date().toISOString();

    await this.supabase.db
      .from('user_courses')
      .update({ status: 'completed', completed_at: now })
      .eq('id', active.userCourseId);

    // 수강 일수 계산
    const startedAt = new Date(active.startedAt);
    const daysSpent = Math.ceil(
      (Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // 다음 레벨 추천
    const levelOrder = ['기초', '심화', '마스터'];
    const currentIdx = levelOrder.indexOf(active.level);
    let nextRecommendation: { courseId: string; title: string } | null = null;

    if (currentIdx < levelOrder.length - 1) {
      const nextLevel = levelOrder[currentIdx + 1];
      const { data: nextCourse } = await this.supabase.db
        .from('courses')
        .select('id, title')
        .eq('category', active.category)
        .eq('level', nextLevel)
        .eq('is_active', true)
        .single();

      if (nextCourse) {
        nextRecommendation = { courseId: nextCourse.id, title: nextCourse.title };
      }
    }

    return {
      completed: true,
      courseSummary: {
        title: active.title,
        completedMissions: active.missionSummary.completed,
        totalMissions: active.missionSummary.total,
        daysSpent,
      },
      nextRecommendation,
    };
  }

  /** category + level로 코스 ID 조회 */
  async findCourseId(category: string, level: string): Promise<string | null> {
    const { data } = await this.supabase.db
      .from('courses')
      .select('id')
      .eq('category', category)
      .eq('level', level)
      .single();

    return data?.id || null;
  }
}
