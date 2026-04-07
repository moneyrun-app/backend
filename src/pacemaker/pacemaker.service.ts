import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { MessageGenerator } from './message.generator';
import { QuizService } from '../quiz/quiz.service';
import { FeedbackDto } from './dto/feedback.dto';
import { CreateDailyCheckDto } from './dto/daily-check.dto';

@Injectable()
export class PacemakerService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly messageGenerator: MessageGenerator,
    private readonly quizService: QuizService,
  ) {}

  async getTodayMessage(userId: string, nickname: string) {
    const today = this.getTodayKST();

    const { data: cached } = await this.supabase.db
      .from('pacemaker_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1)
      .single();

    if (cached) {
      const quizzes = await this.quizService.getTodayQuizzes(userId, 10);
      return this.formatResponse(cached, quizzes);
    }

    try {
      return await this.generateAndSave(userId, nickname, today);
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
        const { data: retry } = await this.supabase.db
          .from('pacemaker_messages')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .limit(1)
          .single();

        if (retry) {
          const quizzes = await this.quizService.getTodayQuizzes(userId, 10);
          return this.formatResponse(retry, quizzes);
        }
      }
      throw e;
    }
  }

  async submitFeedback(userId: string, dto: FeedbackDto) {
    const { error } = await this.supabase.db
      .from('pacemaker_feedback')
      .insert({
        message_id: dto.messageId,
        user_id: userId,
        type: dto.type,
        content: dto.content || null,
      });

    if (error) {
      throw new Error(`피드백 저장 실패: ${error.message}`);
    }

    return { message: '피드백이 접수되었습니다.' };
  }

  async getHistory(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [messagesRes, countRes] = await Promise.all([
      this.supabase.db
        .from('pacemaker_messages')
        .select('id, date, message, grade, theme, quote')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1),
      this.supabase.db
        .from('pacemaker_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    return {
      items: messagesRes.data || [],
      pagination: {
        page,
        limit,
        total: countRes.count || 0,
      },
    };
  }

  // ========== 일별 지출 체크 ==========

  async createDailyCheck(userId: string, dto: CreateDailyCheckDto) {
    const today = this.getTodayKST();
    if (dto.date > today) {
      throw new HttpException('미래 날짜는 체크할 수 없습니다.', HttpStatus.BAD_REQUEST);
    }

    // 확정된 월의 daily check 수정 차단
    const dateMonth = dto.date.substring(0, 7);
    const finalized = await this.isMonthFinalized(userId, dateMonth);
    if (finalized) {
      throw new HttpException('이미 확정된 월의 지출은 수정할 수 없습니다. 확정을 취소한 후 수정해주세요.', HttpStatus.BAD_REQUEST);
    }

    const { data: existing } = await this.supabase.db
      .from('daily_checks')
      .select('id')
      .eq('user_id', userId)
      .eq('date', dto.date)
      .single();

    if (existing) {
      const { data: updated, error } = await this.supabase.db
        .from('daily_checks')
        .update({
          status: dto.status,
          amount: dto.amount ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`일별 체크 수정 실패: ${error.message}`);
      }

      return { id: updated.id, date: updated.date, status: updated.status, amount: updated.amount };
    }

    const { data: saved, error } = await this.supabase.db
      .from('daily_checks')
      .insert({
        user_id: userId,
        date: dto.date,
        status: dto.status,
        amount: dto.amount ?? 0,
      })
      .select()
      .single();

    if (error || !saved) {
      throw new Error(`일별 체크 저장 실패: ${error?.message || 'INSERT 반환값 없음'}`);
    }

    return { id: saved.id, date: saved.date, status: saved.status, amount: saved.amount };
  }

  async getDailyChecks(userId: string, month: string) {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${daysInMonth}`;

    const [checksRes, profileRes] = await Promise.all([
      this.supabase.db
        .from('daily_checks')
        .select('id, date, status, amount')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true }),
      this.financeService.getFullProfile(userId),
    ]);

    if (checksRes.error) {
      throw new Error(`일별 체크 조회 실패: ${checksRes.error.message}`);
    }

    const days = checksRes.data || [];
    const dailyBudget = profileRes.variableCost.daily;

    const daysTracked = days.length;
    const daysUnder = days.filter((d: any) => d.status === 'under').length;
    const daysOver = days.filter((d: any) => d.status === 'over').length;
    const totalSpent = days.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const adjustedBudget = dailyBudget * daysTracked;
    const spentRate = adjustedBudget > 0 ? Math.round((totalSpent / adjustedBudget) * 1000) / 10 : 0;

    // 오늘 기준 역순 연속 절약일 (under) — 미체크 날은 무시
    const todayStr = this.getTodayKST();
    const currentStreak = this.calculateStreak(days, todayStr);
    const bestStreak = this.calculateBestStreak(days);

    return {
      days,
      summary: {
        totalSpent,
        adjustedBudget,
        dailyBudget,
        monthlyBudget: dailyBudget * daysInMonth,
        spentRate,
        daysInMonth,
        daysTracked,
        daysUnder,
        daysOver,
        currentStreak,
        bestStreak,
      },
    };
  }

  // ========== 주간 요약 ==========

  async getWeeklySummary(userId: string, date: string) {
    const { weekStart, weekEnd } = this.getWeekRange(date);

    // 이미 저장된 주간 요약이 있는지 확인
    const { data: existing } = await this.supabase.db
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single();

    if (existing) {
      return this.formatWeeklySummary(existing);
    }

    // 없으면 계산해서 반환 (지난 주면 저장도 함)
    return this.calculateWeeklySummary(userId, weekStart, weekEnd);
  }

  private async calculateWeeklySummary(userId: string, weekStart: string, weekEnd: string) {
    const [checksRes, profileRes] = await Promise.all([
      this.supabase.db
        .from('daily_checks')
        .select('id, date, status, amount')
        .eq('user_id', userId)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true }),
      this.financeService.getFullProfile(userId),
    ]);

    const days = checksRes.data || [];
    const dailyBudget = profileRes.variableCost.daily;

    const daysTracked = days.length;
    const daysSkipped = 7 - daysTracked;
    const daysUnder = days.filter((d: any) => d.status === 'under').length;
    const daysOver = days.filter((d: any) => d.status === 'over').length;
    const totalSpent = days.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const adjustedBudget = dailyBudget * daysTracked;
    const spentRate = adjustedBudget > 0 ? Math.round((totalSpent / adjustedBudget) * 1000) / 10 : 0;

    const summary = {
      weekStart,
      weekEnd,
      daysTracked,
      daysSkipped,
      daysUnder,
      daysOver,
      totalSpent,
      adjustedBudget,
      spentRate,
      remainingBudget: adjustedBudget - totalSpent,
    };

    // 지난 주(weekEnd < 오늘)면 DB에 저장
    const today = this.getTodayKST();
    if (weekEnd < today) {
      await this.supabase.db
        .from('weekly_summaries')
        .upsert({
          user_id: userId,
          week_start: weekStart,
          week_end: weekEnd,
          days_tracked: daysTracked,
          days_skipped: daysSkipped,
          days_under: daysUnder,
          days_over: daysOver,
          total_spent: totalSpent,
          adjusted_budget: adjustedBudget,
          spent_rate: spentRate,
        }, { onConflict: 'user_id,week_start' });
    }

    return summary;
  }

  private formatWeeklySummary(row: any) {
    return {
      weekStart: row.week_start,
      weekEnd: row.week_end,
      daysTracked: row.days_tracked,
      daysSkipped: row.days_skipped,
      daysUnder: row.days_under,
      daysOver: row.days_over,
      totalSpent: row.total_spent,
      adjustedBudget: row.adjusted_budget,
      spentRate: Number(row.spent_rate),
      remainingBudget: row.adjusted_budget - row.total_spent,
    };
  }

  // ========== Private: 메시지 생성 ==========

  private async generateAndSave(userId: string, nickname: string, today: string) {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const [recentScraps, spending] = await Promise.all([
      this.supabase.db
        .from('external_scraps')
        .select('title, channel')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      this.getSpendingData(userId, profile.variableCost.daily),
    ]);

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    const contextData = {
      profile,
      nickname,
      configMap,
      recentScraps: recentScraps.data || [],
      spending,
      today,
      dayOfWeek: this.getDayOfWeekKR(),
      dayOfWeekIndex: kst.getUTCDay(),
    };

    const { message, theme, quote } = await this.messageGenerator.generate(contextData);

    const quizzes = await this.quizService.getTodayQuizzes(userId, 10);
    const quizIds = quizzes.map((q: any) => q.id);

    const { data: saved, error: saveError } = await this.supabase.db
      .from('pacemaker_messages')
      .insert({
        user_id: userId,
        date: today,
        message,
        grade: profile.grade,
        daily_variable_cost: profile.variableCost.daily,
        spending_status: {
          todayRemaining: profile.variableCost.daily,
          weeklyRemaining: profile.variableCost.weekly,
          level: profile.grade.toLowerCase(),
        },
        quiz_ids: quizIds,
        theme,
        quote,
        disclaimer: '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      })
      .select()
      .single();

    if (saveError || !saved) {
      console.error('[pacemaker] 메시지 저장 실패:', saveError);
      throw new Error(`메시지 저장 실패: ${saveError?.message || 'INSERT 반환값 없음'}`);
    }

    return this.formatResponse(saved, quizzes);
  }

  /** 어제 지출 + 이번 주 지출 데이터 조회 */
  private async getSpendingData(userId: string, dailyBudget: number) {
    const today = this.getTodayKST();
    const yesterday = this.addDays(today, -1);
    const { weekStart } = this.getWeekRange(today);

    const [yesterdayRes, weekRes] = await Promise.all([
      this.supabase.db
        .from('daily_checks')
        .select('status, amount')
        .eq('user_id', userId)
        .eq('date', yesterday)
        .single(),
      this.supabase.db
        .from('daily_checks')
        .select('date, status, amount')
        .eq('user_id', userId)
        .gte('date', weekStart)
        .lt('date', today)
        .order('date', { ascending: true }),
    ]);

    const weekDays = weekRes.data || [];
    const weekTotalSpent = weekDays.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const weekDaysTracked = weekDays.length;

    // 연속 절약일 (역순, 미체크 무시)
    let currentStreak = 0;
    for (let i = weekDays.length - 1; i >= 0; i--) {
      if (weekDays[i].status === 'under') currentStreak++;
      else break;
    }

    return {
      yesterdayAmount: yesterdayRes.data?.amount ?? null,
      yesterdayStatus: yesterdayRes.data?.status ?? null,
      weekTotalSpent,
      weekDaysTracked,
      weekAdjustedBudget: dailyBudget * weekDaysTracked,
      currentStreak,
    };
  }

  private formatResponse(row: any, quizzes: any[]) {
    return {
      id: row.id,
      date: row.date,
      message: row.message,
      grade: row.grade,
      theme: row.theme || null,
      quote: row.quote || null,
      dailyVariableCost: row.daily_variable_cost,
      spendingStatus: row.spending_status || {
        todayRemaining: row.daily_variable_cost,
        weeklyRemaining: 0,
        level: (row.grade || 'yellow').toLowerCase(),
      },
      quizzes,
      quizCount: quizzes.length,
      disclaimer: row.disclaimer || '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      createdAt: row.created_at,
    };
  }

  // ========== 월간 소비 확정 ==========

  /** 1. 확정 상태 조회 */
  async getMonthlyFinalizeStatus(userId: string) {
    const today = this.getTodayKST();
    const [y, m, d] = today.split('-').map(Number);
    const currentMonth = `${y}-${String(m).padStart(2, '0')}`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const isLastDay = d === daysInMonth;

    // 현재 월 확정 여부
    const { data: currentFin } = await this.supabase.db
      .from('monthly_finalizations')
      .select('id')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .eq('expired', false)
      .single();

    // 현재 월 리포트 여부 (monthly_reports.month는 DATE 타입 → "-01" 붙여서 조회)
    const { data: currentReport } = await this.supabase.db
      .from('monthly_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('month', `${currentMonth}-01`)
      .single();

    // pendingReport: 확정O + 리포트X + 소멸X인 월 (최대 1개, 최신)
    const { data: allFinalizations } = await this.supabase.db
      .from('monthly_finalizations')
      .select('month')
      .eq('user_id', userId)
      .eq('expired', false)
      .order('month', { ascending: false });

    let pendingReport: { month: string; reportId: null } | null = null;

    if (allFinalizations) {
      for (const fin of allFinalizations) {
        if (fin.month === currentMonth) continue;
        const { data: report } = await this.supabase.db
          .from('monthly_reports')
          .select('id')
          .eq('user_id', userId)
          .eq('month', `${fin.month}-01`)
          .single();

        if (!report) {
          pendingReport = { month: fin.month, reportId: null };
          break;  // 최신 1개만
        }
      }
    }

    // 과거 미확정 월 목록 (유저 첫 daily_check 이후 ~ 전월)
    const unfinalizedMonths = await this.getUnfinalizedMonths(userId, currentMonth);

    return {
      currentMonth: {
        month: currentMonth,
        finalized: !!currentFin,
        isLastDay,
        reportId: currentReport?.id || null,
      },
      pendingReport,
      unfinalizedMonths,
    };
  }

  /** 2. 월간 소비 확정 */
  async finalizeMonth(userId: string, month: string) {
    // 이미 확정된 월인지 확인
    const { data: existing } = await this.supabase.db
      .from('monthly_finalizations')
      .select('id, expired')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    if (existing && !existing.expired) {
      throw new HttpException('이미 확정된 월입니다.', HttpStatus.BAD_REQUEST);
    }

    const today = this.getTodayKST();
    const currentMonth = today.substring(0, 7);

    // 이전 미확정 월 자동 확정
    const unfinalizedMonths = await this.getUnfinalizedMonths(userId, month);
    const autoFinalized: string[] = [];

    for (const um of unfinalizedMonths) {
      await this.supabase.db
        .from('monthly_finalizations')
        .upsert({
          user_id: userId,
          month: um,
          expired: false,
        }, { onConflict: 'user_id,month' });
      autoFinalized.push(um);
    }

    // 이전 pendingReport 소멸 처리
    let expiredReport: string | null = null;
    const { data: allFins } = await this.supabase.db
      .from('monthly_finalizations')
      .select('month')
      .eq('user_id', userId)
      .eq('expired', false)
      .neq('month', month)
      .order('month', { ascending: false });

    if (allFins) {
      for (const fin of allFins) {
        const { data: report } = await this.supabase.db
          .from('monthly_reports')
          .select('id')
          .eq('user_id', userId)
          .eq('month', `${fin.month}-01`)
          .single();

        if (!report) {
          // 리포트 미생성 → 소멸
          await this.supabase.db
            .from('monthly_finalizations')
            .update({ expired: true })
            .eq('user_id', userId)
            .eq('month', fin.month);
          expiredReport = fin.month;
          break;
        }
      }
    }

    // 해당 월 확정
    if (existing) {
      await this.supabase.db
        .from('monthly_finalizations')
        .update({ expired: false, finalized_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await this.supabase.db
        .from('monthly_finalizations')
        .insert({ user_id: userId, month });
    }

    return {
      finalized: month,
      autoFinalized,
      expiredReport,
    };
  }

  /** 3. 확정 취소 */
  async cancelFinalize(userId: string, month: string) {
    // 리포트 생성 여부 확인 (monthly_reports.month는 DATE 타입)
    const { data: report } = await this.supabase.db
      .from('monthly_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('month', `${month}-01`)
      .single();

    if (report) {
      throw new HttpException(
        '리포트가 이미 생성된 월은 확정을 취소할 수 없습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { error } = await this.supabase.db
      .from('monthly_finalizations')
      .delete()
      .eq('user_id', userId)
      .eq('month', month);

    if (error) {
      throw new Error(`확정 취소 실패: ${error.message}`);
    }

    return { success: true };
  }

  /** 확정 여부 확인 (daily-check 차단용) */
  async isMonthFinalized(userId: string, month: string): Promise<boolean> {
    const { data } = await this.supabase.db
      .from('monthly_finalizations')
      .select('id')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('expired', false)
      .single();

    return !!data;
  }

  /** 과거 미확정 월 목록 (유저 가입월 ~ targetMonth 직전) */
  private async getUnfinalizedMonths(userId: string, targetMonth: string): Promise<string[]> {
    // 유저 가입일 기준
    const { data: user } = await this.supabase.db
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    if (!user) return [];

    const createdAt = new Date(user.created_at);
    const startMonth = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (startMonth >= targetMonth) return [];

    // startMonth ~ targetMonth 직전까지의 모든 월
    const allMonths: string[] = [];
    let [sy, sm] = startMonth.split('-').map(Number);
    const [ty, tm] = targetMonth.split('-').map(Number);

    while (sy < ty || (sy === ty && sm < tm)) {
      allMonths.push(`${sy}-${String(sm).padStart(2, '0')}`);
      sm++;
      if (sm > 12) { sm = 1; sy++; }
    }

    // 이미 확정된 월 제외
    const { data: finalized } = await this.supabase.db
      .from('monthly_finalizations')
      .select('month')
      .eq('user_id', userId)
      .in('month', allMonths);

    const finalizedSet = new Set((finalized || []).map((f: any) => f.month));
    return allMonths.filter(m => !finalizedSet.has(m));
  }

  // ========== 유틸 ==========

  /** 연속 절약일 계산 (역순, 미체크 날 무시) */
  private calculateStreak(days: any[], todayStr: string): number {
    const sorted = [...days]
      .filter((d: any) => d.date <= todayStr)
      .sort((a: any, b: any) => b.date.localeCompare(a.date));

    let streak = 0;
    for (const day of sorted) {
      if (day.status === 'under') streak++;
      else break;
    }
    return streak;
  }

  /** 최대 연속 절약일 계산 */
  private calculateBestStreak(days: any[]): number {
    let best = 0;
    let current = 0;
    for (const day of days) {
      if (day.status === 'under') {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    return best;
  }

  /** 날짜가 속한 주의 월~일 범위 */
  private getWeekRange(dateStr: string): { weekStart: string; weekEnd: string } {
    const date = new Date(dateStr + 'T00:00:00Z');
    const day = date.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0],
    };
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  private getTodayKST(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  }

  private getDayOfWeekKR(): string {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return days[kst.getUTCDay()] + '요일';
  }
}
