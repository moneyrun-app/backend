import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 유저 목록 + 총 수 (페이지네이션) */
  async getUsers(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase.db
      .from('users')
      .select('id, nickname, email, role, has_completed_onboarding, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`유저 목록 조회 실패: ${error.message}`);
    }

    return {
      users: (data || []).map((u: any) => ({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        role: u.role,
        hasCompletedOnboarding: u.has_completed_onboarding,
        createdAt: u.created_at,
      })),
      total: count || 0,
      page,
      limit,
    };
  }

  /** 퀴즈 전체 목록 */
  async getQuizzes() {
    const { data, error } = await this.supabase.db
      .from('quizzes')
      .select('id, question, choices, correct_answer, brief_explanation, detailed_explanation, source, category, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`퀴즈 목록 조회 실패: ${error.message}`);
    }

    return {
      quizzes: (data || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        choices: q.choices,
        correctAnswer: q.correct_answer,
        briefExplanation: q.brief_explanation,
        detailedExplanation: q.detailed_explanation,
        source: q.source,
        category: q.category,
        createdAt: q.created_at,
      })),
      total: (data || []).length,
    };
  }

  /** system_config 값 수정 */
  async updateConstant(key: string, value: string) {
    // 존재하는 키인지 확인
    const { data: existing } = await this.supabase.db
      .from('system_config')
      .select('id')
      .eq('key', key)
      .single();

    if (!existing) {
      throw new NotFoundException(`설정 키를 찾을 수 없습니다: ${key}`);
    }

    const { error } = await this.supabase.db
      .from('system_config')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      throw new Error(`설정 수정 실패: ${error.message}`);
    }

    return { key, value, updatedAt: new Date().toISOString() };
  }
}
