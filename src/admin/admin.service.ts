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

  /** system_config 전체 조회 (카테고리별 + 검토 상태) */
  async getConfigs(category?: string) {
    let query = this.supabase.db
      .from('system_config')
      .select('key, value, category, unit, description, source, review_cycle, updated_at')
      .order('category')
      .order('key');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`설정 조회 실패: ${error.message}`);
    }

    const now = Date.now();
    const cycleToMs: Record<string, number> = {
      '1주': 7 * 24 * 60 * 60 * 1000,
      '2주': 14 * 24 * 60 * 60 * 1000,
      '1개월': 30 * 24 * 60 * 60 * 1000,
      '3개월': 90 * 24 * 60 * 60 * 1000,
      '6개월': 180 * 24 * 60 * 60 * 1000,
    };

    return {
      configs: (data || []).map((c: any) => {
        const lastUpdated = new Date(c.updated_at).getTime();
        const cycleMs = cycleToMs[c.review_cycle] || cycleToMs['6개월'];
        const isOverdue = (now - lastUpdated) > cycleMs;

        return {
          key: c.key,
          value: c.value,
          category: c.category,
          unit: c.unit,
          description: c.description,
          source: c.source,
          reviewCycle: c.review_cycle,
          updatedAt: c.updated_at,
          status: isOverdue ? 'OVERDUE' : 'OK',
        };
      }),
      summary: {
        total: (data || []).length,
        overdue: (data || []).filter((c: any) => {
          const lastUpdated = new Date(c.updated_at).getTime();
          const cycleMs = cycleToMs[c.review_cycle] || cycleToMs['6개월'];
          return (now - lastUpdated) > cycleMs;
        }).length,
      },
    };
  }

  /** system_config 값 수정 */
  async updateConstant(key: string, value: string) {
    const { data: existing } = await this.supabase.db
      .from('system_config')
      .select('id')
      .eq('key', key)
      .single();

    if (!existing) {
      throw new NotFoundException(`설정 키를 찾을 수 없습니다: ${key}`);
    }

    const now = new Date().toISOString();
    const { error } = await this.supabase.db
      .from('system_config')
      .update({
        value,
        updated_at: now,
      })
      .eq('key', key);

    if (error) {
      throw new Error(`설정 수정 실패: ${error.message}`);
    }

    return { key, value, updatedAt: now };
  }
}
