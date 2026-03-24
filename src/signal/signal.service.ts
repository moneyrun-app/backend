import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase/supabase.service.js';

/** 신호등 등급 타입 */
export type SignalGrade = 'red' | 'yellow' | 'green';

/**
 * 신호등 시스템 서비스.
 * 6개월 평균 소득 대비 지출 비율로 빨/노/초 등급을 판정한다.
 * - 빨강: 지출이 소득의 105% 초과 (적자)
 * - 노랑: 지출이 소득의 95%~105% 이내 (균형)
 * - 초록: 지출이 소득의 95% 미만 (잉여)
 */
@Injectable()
export class SignalService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * 유저의 현재 신호등 등급을 조회한다.
   * @param userId - 유저 ID
   * @returns 신호등 등급 정보 (없으면 null)
   */
  async getGrade(userId: string): Promise<Record<string, unknown> | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('signal_grades')
      .select('*')
      .eq('user_id', userId)
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(`신호등 등급 조회 실패: ${error.message}`, undefined, 'SignalService');
      throw error;
    }

    return data as Record<string, unknown> | null;
  }

  /**
   * 유저의 등급 변화 이력을 조회한다.
   * @param userId - 유저 ID
   * @returns 등급 변화 이력 배열
   */
  async getGradeHistory(userId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('signal_grade_history')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(20);

    if (error) {
      this.logger.error(`등급 이력 조회 실패: ${error.message}`, undefined, 'SignalService');
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * 유저의 신호등 등급을 평가한다.
   * 6개월간 거래 데이터에서 소득/지출을 집계하여 등급을 판정한다.
   * @param userId - 유저 ID
   * @returns 평가된 등급 정보
   */
  async evaluateGrade(userId: string): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 6개월 전 날짜 계산
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    // 6개월간 소득 합계
    const { data: incomeData } = await client
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'income')
      .eq('is_deleted', false)
      .gte('transaction_date', startDate);

    const totalIncome = ((incomeData ?? []) as { amount: number }[]).reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );

    // 유저 프로필에서 연소득 가져와서 월 소득 추정 (거래 소득이 없는 경우 대비)
    let monthlyIncome = totalIncome / 6;

    if (totalIncome === 0) {
      const { data: budget } = await client
        .from('user_budgets')
        .select('monthly_income')
        .eq('user_id', userId)
        .maybeSingle();

      if (budget) {
        monthlyIncome = (budget as Record<string, unknown>).monthly_income as number;
      }
    }

    // 6개월간 지출 합계
    const { data: expenseData } = await client
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'expense')
      .eq('is_deleted', false)
      .gte('transaction_date', startDate);

    const totalExpense = ((expenseData ?? []) as { amount: number }[]).reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );

    const avgIncome = Math.round(monthlyIncome);
    const avgExpense = Math.round(totalExpense / 6);

    // 등급 판정
    const grade = this.determineGrade(avgIncome, avgExpense);
    const expenseRatio = avgIncome > 0
      ? Math.round((avgExpense / avgIncome) * 10000) / 100
      : 0;

    // 이전 등급 조회
    const previousGradeData = await this.getGrade(userId);
    const previousGrade = previousGradeData
      ? (previousGradeData.grade as string)
      : null;

    // 등급 저장 (upsert)
    const { data: savedGrade, error } = await client
      .from('signal_grades')
      .upsert(
        {
          user_id: userId,
          grade,
          avg_income: avgIncome,
          avg_expense: avgExpense,
          expense_ratio: expenseRatio,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) {
      this.logger.error(`신호등 등급 저장 실패: ${error.message}`, undefined, 'SignalService');
      throw error;
    }

    // 등급이 변했으면 이력 기록
    if (previousGrade && previousGrade !== grade) {
      await client.from('signal_grade_history').insert({
        user_id: userId,
        previous_grade: previousGrade,
        new_grade: grade,
        reason: `지출/소득 비율 ${expenseRatio}% (${previousGrade} → ${grade})`,
      });

      this.logger.log(
        `유저 ${userId} 신호등 등급 변경: ${previousGrade} → ${grade}`,
        'SignalService',
      );
    }

    return savedGrade as Record<string, unknown>;
  }

  /**
   * 3개월마다 전체 유저의 신호등 등급을 재평가한다.
   * 매월 1일에 실행하되, 3개월 주기인지 확인.
   */
  @Cron('0 1 1 */3 *', { timeZone: 'Asia/Seoul' })
  async handleQuarterlyEvaluation(): Promise<void> {
    this.logger.log('3개월 정기 신호등 등급 재평가 시작', 'SignalService');

    const client = this.supabaseService.getClient();

    const { data: users } = await client
      .from('user_profiles')
      .select('user_id')
      .eq('is_deleted', false)
      .eq('is_onboarded', true);

    if (!users || users.length === 0) {
      this.logger.log('평가할 유저가 없습니다.', 'SignalService');
      return;
    }

    let evaluated = 0;

    for (const user of users as { user_id: string }[]) {
      try {
        await this.evaluateGrade(user.user_id);
        evaluated++;
      } catch (err) {
        this.logger.error(
          `유저 ${user.user_id} 등급 평가 실패: ${(err as Error).message}`,
          undefined,
          'SignalService',
        );
      }
    }

    this.logger.log(`등급 재평가 완료: ${evaluated}명`, 'SignalService');
  }

  // ─────────────────────────────────────────────
  // 순수 로직
  // ─────────────────────────────────────────────

  /**
   * 평균 소득과 평균 지출로 신호등 등급을 판정한다.
   * - 빨강: 지출이 소득의 105% 초과
   * - 노랑: 지출이 소득의 95%~105% 이내
   * - 초록: 지출이 소득의 95% 미만
   * @param avgIncome - 월 평균 소득 (원)
   * @param avgExpense - 월 평균 지출 (원)
   * @returns 신호등 등급
   */
  determineGrade(avgIncome: number, avgExpense: number): SignalGrade {
    if (avgIncome === 0) return 'red';

    const ratio = avgExpense / avgIncome;

    if (ratio > 1.05) return 'red';
    if (ratio >= 0.95) return 'yellow';
    return 'green';
  }
}
