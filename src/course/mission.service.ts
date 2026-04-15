import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class MissionService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 활성 코스의 전체 미션 + 완료 상태 조회 */
  async getMissions(userId: string, userCourseId: string, courseId: string) {
    // 미션 목록
    const { data: missions, error } = await this.supabase.db
      .from('course_missions')
      .select('id, chapter_number, mission_order, type, title, description')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true })
      .order('mission_order', { ascending: true });

    if (error) {
      throw new Error(`미션 조회 실패: ${error.message}`);
    }

    // 완료 기록
    const { data: completions } = await this.supabase.db
      .from('user_mission_completions')
      .select('mission_id, completed_at, note')
      .eq('user_id', userId)
      .eq('user_course_id', userCourseId);

    const completionMap = new Map(
      (completions || []).map((c: any) => [c.mission_id, c]),
    );

    const missionList = (missions || []).map((m: any) => {
      const completion = completionMap.get(m.id);
      return {
        id: m.id,
        chapterNumber: m.chapter_number,
        missionOrder: m.mission_order,
        type: m.type,
        title: m.title,
        description: m.description,
        completed: !!completion,
        completedAt: completion?.completed_at || null,
        note: completion?.note || null,
      };
    });

    const total = missionList.length;
    const completed = missionList.filter((m) => m.completed).length;

    return { missions: missionList, summary: { total, completed } };
  }

  /** 특정 챕터 미션 조회 */
  async getMissionsByChapter(
    userId: string,
    userCourseId: string,
    courseId: string,
    chapterNumber: number,
  ) {
    const result = await this.getMissions(userId, userCourseId, courseId);
    const filtered = result.missions.filter(
      (m) => m.chapterNumber === chapterNumber,
    );
    return {
      missions: filtered,
      summary: {
        total: filtered.length,
        completed: filtered.filter((m) => m.completed).length,
      },
    };
  }

  /** 미션 완료 처리 */
  async completeMission(userId: string, userCourseId: string, missionId: string, note?: string) {
    // 미션 존재 확인
    const { data: mission, error: missionError } = await this.supabase.db
      .from('course_missions')
      .select('id')
      .eq('id', missionId)
      .single();

    if (missionError || !mission) {
      throw new NotFoundException('미션을 찾을 수 없습니다.');
    }

    // 이미 완료했는지 확인
    const { data: existing } = await this.supabase.db
      .from('user_mission_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .single();

    if (existing) {
      throw new BadRequestException('이미 완료한 미션입니다.');
    }

    // 완료 기록
    const { error: insertError } = await this.supabase.db
      .from('user_mission_completions')
      .insert({
        user_id: userId,
        user_course_id: userCourseId,
        mission_id: missionId,
        note: note || null,
      });

    if (insertError) {
      throw new Error(`미션 완료 저장 실패: ${insertError.message}`);
    }

    // 전체 완료 수 계산
    const { count } = await this.supabase.db
      .from('user_mission_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('user_course_id', userCourseId);

    return {
      completed: true,
      missionId,
      completedAt: new Date().toISOString(),
      totalCompleted: count || 0,
    };
  }

  /** 미션 진행 요약 (페이스메이커용) */
  async getMissionProgress(userId: string, userCourseId: string, courseId: string, currentChapter: number) {
    const result = await this.getMissions(userId, userCourseId, courseId);
    const currentChapterMissions = result.missions
      .filter((m) => m.chapterNumber === currentChapter)
      .map((m) => ({ title: m.title, type: m.type, completed: m.completed }));

    return {
      totalMissions: result.summary.total,
      completedMissions: result.summary.completed,
      currentChapterMissions,
    };
  }
}
