import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase/supabase.service.js';

/**
 * 소비 블록 비즈니스 로직 서비스.
 * 일별/주별/월별 블록 생성, 러닝 속도 계산, 블록 조회를 담당한다.
 */
@Injectable()
export class BlocksService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────────
  // 블록 조회
  // ─────────────────────────────────────────────

  /**
   * 특정 월의 일별 블록 배열을 조회한다.
   * @param userId - 유저 ID
   * @param year - 연도
   * @param month - 월
   * @returns 일별 블록 배열
   */
  async getDailyBlocks(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = this.getLastDayOfMonth(year, month);

    const { data, error } = await client
      .from('daily_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('block_date', startDate)
      .lte('block_date', endDate)
      .order('block_date', { ascending: true });

    if (error) {
      this.logger.error(`일별 블록 조회 실패: ${error.message}`, undefined, 'BlocksService');
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * 특정 월의 주간 블록 요약을 조회한다.
   * @param userId - 유저 ID
   * @param year - 연도
   * @param month - 월
   * @returns 주간 블록 배열
   */
  async getWeeklyBlocks(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = this.getLastDayOfMonth(year, month);

    const { data, error } = await client
      .from('weekly_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true });

    if (error) {
      this.logger.error(`주간 블록 조회 실패: ${error.message}`, undefined, 'BlocksService');
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * 월간 블록 요약을 조회한다.
   * @param userId - 유저 ID
   * @param year - 연도
   * @param month - 월
   * @returns 월간 블록
   */
  async getMonthlyBlock(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<string, unknown> | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('monthly_blocks')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      this.logger.error(`월간 블록 조회 실패: ${error.message}`, undefined, 'BlocksService');
      throw error;
    }

    return data as Record<string, unknown> | null;
  }

  /**
   * 블록 캘린더 종합 데이터를 조회한다.
   * 일별 블록 + 주간 요약 + 월간 요약 + 집계 통계를 한 번에 반환한다.
   * @param userId - 유저 ID
   * @param year - 연도
   * @param month - 월
   * @returns 종합 블록 데이터
   */
  async getBlockCalendar(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<string, unknown>> {
    const [dailyBlocks, weeklyBlocks, monthlyBlock] = await Promise.all([
      this.getDailyBlocks(userId, year, month),
      this.getWeeklyBlocks(userId, year, month),
      this.getMonthlyBlock(userId, year, month),
    ]);

    const redDays = dailyBlocks.filter((b) => b.block_color === 'red').length;
    const blueDays = dailyBlocks.filter((b) => b.block_color === 'blue').length;

    return {
      dailyBlocks,
      weeklyBlocks,
      monthlyBlock,
      summary: {
        redDays,
        blueDays,
        totalDays: dailyBlocks.length,
      },
    };
  }

  /**
   * 이번 주 잔여 예산을 계산한다.
   * @param userId - 유저 ID
   * @returns 잔여 예산 정보
   */
  async getWeeklyBudgetRemaining(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 유저 주간 예산 조회
    const { data: budget } = await client
      .from('user_budgets')
      .select('weekly_budget')
      .eq('user_id', userId)
      .maybeSingle();

    if (!budget) {
      return { weeklyBudget: 0, spent: 0, remaining: 0 };
    }

    const weeklyBudget = (budget as Record<string, unknown>).weekly_budget as number;

    // 이번 주 월~일 범위 계산
    const { startDate, endDate } = this.getCurrentWeekRange();

    // 이번 주 지출 합계
    const { data: transactions } = await client
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'expense')
      .eq('is_deleted', false)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    const spent = ((transactions ?? []) as { amount: number }[]).reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );

    return {
      weeklyBudget,
      spent,
      remaining: weeklyBudget - spent,
    };
  }

  /**
   * 러닝 속도를 계산한다.
   * 산식: (알뜰 블록 일수 / 전체 경과 일수) × 100
   * @param userId - 유저 ID
   * @returns 러닝 속도 정보
   */
  async getRunningSpeed(userId: string): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 전체 일별 블록 조회
    const { data: allBlocks } = await client
      .from('daily_blocks')
      .select('block_color')
      .eq('user_id', userId);

    const blocks = (allBlocks ?? []) as { block_color: string }[];
    const totalDays = blocks.length;
    const blueDays = blocks.filter((b) => b.block_color === 'blue').length;

    const speed = totalDays > 0 ? Math.round((blueDays / totalDays) * 1000) / 10 : 0;

    // 전월 속도 (비교용)
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEndDate = this.getLastDayOfMonth(prevYear, prevMonth);

    const { data: prevBlocks } = await client
      .from('daily_blocks')
      .select('block_color')
      .eq('user_id', userId)
      .gte('block_date', prevStartDate)
      .lte('block_date', prevEndDate);

    const prevList = (prevBlocks ?? []) as { block_color: string }[];
    const prevTotal = prevList.length;
    const prevBlue = prevList.filter((b) => b.block_color === 'blue').length;
    const prevSpeed = prevTotal > 0 ? Math.round((prevBlue / prevTotal) * 1000) / 10 : 0;

    const changeRate = prevSpeed > 0
      ? Math.round(((speed - prevSpeed) / prevSpeed) * 1000) / 10
      : 0;

    return {
      speed,
      totalDays,
      blueDays,
      redDays: totalDays - blueDays,
      previousMonthSpeed: prevSpeed,
      changeRate,
    };
  }

  // ─────────────────────────────────────────────
  // 크론: 매일 자정 — 전날 소비 블록 생성
  // ─────────────────────────────────────────────

  /**
   * 매일 자정에 전날의 소비 블록을 생성한다.
   * 전날 지출 합계와 유저의 일 예산을 비교해서 빨강/파랑 블록을 결정한다.
   */
  @Cron('0 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyBlockGeneration(): Promise<void> {
    this.logger.log('일일 소비 블록 생성 시작', 'BlocksService');

    const client = this.supabaseService.getClient();
    const yesterday = this.getYesterday();

    // 예산이 설정된 모든 유저 조회
    const { data: budgets } = await client
      .from('user_budgets')
      .select('user_id, daily_budget');

    if (!budgets || budgets.length === 0) {
      this.logger.log('블록 생성할 유저가 없습니다.', 'BlocksService');
      return;
    }

    let created = 0;

    for (const budget of budgets as { user_id: string; daily_budget: number }[]) {
      try {
        await this.createDailyBlock(budget.user_id, yesterday, budget.daily_budget);
        created++;
      } catch (err) {
        this.logger.error(
          `유저 ${budget.user_id} 블록 생성 실패: ${(err as Error).message}`,
          undefined,
          'BlocksService',
        );
      }
    }

    this.logger.log(`일일 블록 생성 완료: ${created}건`, 'BlocksService');
  }

  /**
   * 매주 월요일 자정에 지난 주 주간 블록을 확정한다.
   */
  @Cron('0 0 * * 1', { timeZone: 'Asia/Seoul' })
  async handleWeeklyBlockGeneration(): Promise<void> {
    this.logger.log('주간 블록 확정 시작', 'BlocksService');

    const client = this.supabaseService.getClient();

    const { data: budgets } = await client
      .from('user_budgets')
      .select('user_id');

    if (!budgets || budgets.length === 0) return;

    for (const budget of budgets as { user_id: string }[]) {
      try {
        await this.createWeeklyBlock(budget.user_id);
      } catch (err) {
        this.logger.error(
          `유저 ${budget.user_id} 주간 블록 생성 실패: ${(err as Error).message}`,
          undefined,
          'BlocksService',
        );
      }
    }

    this.logger.log('주간 블록 확정 완료', 'BlocksService');
  }

  /**
   * 매월 1일 자정에 전월 월간 블록을 확정한다.
   */
  @Cron('0 0 1 * *', { timeZone: 'Asia/Seoul' })
  async handleMonthlyBlockGeneration(): Promise<void> {
    this.logger.log('월간 블록 확정 시작', 'BlocksService');

    const client = this.supabaseService.getClient();

    const { data: budgets } = await client
      .from('user_budgets')
      .select('user_id');

    if (!budgets || budgets.length === 0) return;

    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    for (const budget of budgets as { user_id: string }[]) {
      try {
        await this.createMonthlyBlock(budget.user_id, prevYear, prevMonth);
      } catch (err) {
        this.logger.error(
          `유저 ${budget.user_id} 월간 블록 생성 실패: ${(err as Error).message}`,
          undefined,
          'BlocksService',
        );
      }
    }

    this.logger.log('월간 블록 확정 완료', 'BlocksService');
  }

  // ─────────────────────────────────────────────
  // 블록 생성 로직
  // ─────────────────────────────────────────────

  /**
   * 특정 날짜의 일별 블록을 생성한다.
   * 지출 > 일 예산 → red, 지출 ≤ 일 예산 → blue
   * @param userId - 유저 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @param dailyBudget - 일 예산 (원)
   */
  async createDailyBlock(
    userId: string,
    date: string,
    dailyBudget: number,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    // 해당 날짜 지출 합계
    const { data: transactions } = await client
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'expense')
      .eq('is_deleted', false)
      .eq('transaction_date', date);

    const totalSpent = ((transactions ?? []) as { amount: number }[]).reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );

    const blockColor = this.determineBlockColor(totalSpent, dailyBudget);

    await client.from('daily_blocks').upsert(
      {
        user_id: userId,
        block_date: date,
        total_spent: totalSpent,
        daily_budget: dailyBudget,
        block_color: blockColor,
      },
      { onConflict: 'user_id,block_date' },
    );
  }

  /**
   * 지난 주의 주간 블록을 생성한다.
   * 7일 중 빨강이 더 많으면 red, 파랑이 더 많거나 같으면 blue.
   * @param userId - 유저 ID
   */
  private async createWeeklyBlock(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // 지난 주 범위 (월~일)
    const { startDate, endDate, year, week } = this.getLastWeekRange();

    const { data: blocks } = await client
      .from('daily_blocks')
      .select('block_color')
      .eq('user_id', userId)
      .gte('block_date', startDate)
      .lte('block_date', endDate);

    const list = (blocks ?? []) as { block_color: string }[];
    const redDays = list.filter((b) => b.block_color === 'red').length;
    const blueDays = list.filter((b) => b.block_color === 'blue').length;

    const blockColor = redDays > blueDays ? 'red' : 'blue';

    await client.from('weekly_blocks').upsert(
      {
        user_id: userId,
        year,
        week,
        start_date: startDate,
        end_date: endDate,
        red_days: redDays,
        blue_days: blueDays,
        block_color: blockColor,
      },
      { onConflict: 'user_id,year,week' },
    );
  }

  /**
   * 전월의 월간 블록을 생성한다.
   * 주간 블록 중 빨강이 더 많으면 red, 아니면 blue.
   * @param userId - 유저 ID
   * @param year - 연도
   * @param month - 월
   */
  private async createMonthlyBlock(
    userId: string,
    year: number,
    month: number,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = this.getLastDayOfMonth(year, month);

    const { data: weeks } = await client
      .from('weekly_blocks')
      .select('block_color')
      .eq('user_id', userId)
      .gte('start_date', startDate)
      .lte('start_date', endDate);

    const list = (weeks ?? []) as { block_color: string }[];
    const redWeeks = list.filter((w) => w.block_color === 'red').length;
    const blueWeeks = list.filter((w) => w.block_color === 'blue').length;

    const blockColor = redWeeks > blueWeeks ? 'red' : 'blue';

    await client.from('monthly_blocks').upsert(
      {
        user_id: userId,
        year,
        month,
        red_weeks: redWeeks,
        blue_weeks: blueWeeks,
        block_color: blockColor,
      },
      { onConflict: 'user_id,year,month' },
    );
  }

  // ─────────────────────────────────────────────
  // 순수 헬퍼 메서드
  // ─────────────────────────────────────────────

  /**
   * 지출과 예산을 비교해서 블록 색상을 결정한다.
   * @param totalSpent - 총 지출 (원)
   * @param dailyBudget - 일 예산 (원)
   * @returns 'red' (과소비) 또는 'blue' (알뜰)
   */
  determineBlockColor(totalSpent: number, dailyBudget: number): 'red' | 'blue' {
    return totalSpent > dailyBudget ? 'red' : 'blue';
  }

  /**
   * 러닝 속도를 계산한다.
   * @param blueDays - 알뜰 블록 일수
   * @param totalDays - 전체 경과 일수
   * @returns 러닝 속도 (km/h)
   */
  calculateRunningSpeed(blueDays: number, totalDays: number): number {
    if (totalDays === 0) return 0;
    return Math.round((blueDays / totalDays) * 1000) / 10;
  }

  /**
   * 어제 날짜를 YYYY-MM-DD 형식으로 반환한다.
   * @returns 어제 날짜
   */
  getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.formatDate(d);
  }

  /**
   * 이번 주 월~일 범위를 반환한다.
   * @returns 시작일, 종료일
   */
  getCurrentWeekRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: this.formatDate(monday),
      endDate: this.formatDate(sunday),
    };
  }

  /**
   * 지난 주 월~일 범위와 ISO 주차를 반환한다.
   * @returns 시작일, 종료일, 연도, 주차
   */
  private getLastWeekRange(): {
    startDate: string;
    endDate: string;
    year: number;
    week: number;
  } {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    return {
      startDate: this.formatDate(lastMonday),
      endDate: this.formatDate(lastSunday),
      year: lastMonday.getFullYear(),
      week: this.getISOWeek(lastMonday),
    };
  }

  /**
   * ISO 주차를 계산한다.
   * @param date - Date 객체
   * @returns ISO 주차 (1~53)
   */
  private getISOWeek(date: Date): number {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 4);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * 월의 마지막 날을 YYYY-MM-DD로 반환한다.
   * @param year - 연도
   * @param month - 월
   * @returns 마지막 날짜
   */
  getLastDayOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
