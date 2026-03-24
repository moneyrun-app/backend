import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase/supabase.service.js';
import { AiService } from '../ai/ai.service.js';
import { SimulatorService } from '../simulator/simulator.service.js';

/** 등급별 AI 톤 */
const GRADE_TONES: Record<string, string> = {
  red: '따끔하지만 응원하는 톤. 위기감을 주되 극복할 수 있다는 희망도 함께.',
  yellow: '격려하는 톤. 잘하고 있지만 조금만 더 하면 좋겠다는 느낌.',
  green: '칭찬하는 톤. 잘하고 있다는 자신감을 주면서 더 나은 방법도 제안.',
};

/**
 * AI 페이스메이커 서비스.
 * 유저 데이터를 종합해서 AI에게 컨텍스트를 만들고 발화를 생성한다.
 * 홈 대시보드 통합 API도 여기서 제공한다.
 */
@Injectable()
export class PacemakerService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    private readonly simulatorService: SimulatorService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * AI 페이스메이커 발화를 생성한다.
   * @param userId - 유저 ID
   * @returns AI 발화 텍스트 + 관련 수치
   */
  async generateMessage(userId: string): Promise<Record<string, unknown>> {
    const context = await this.buildContext(userId);

    const systemPrompt = `너는 머니런 앱의 AI 페이스메이커야. 유저의 재무 상황을 보고 한마디 해줘.
${GRADE_TONES[context.signalGrade as string] ?? GRADE_TONES['yellow']}
규칙:
- 반말로 말해. 친근하게.
- 구체적인 금액을 반드시 포함해.
- 1~2문장으로 짧게.
- 이모지 1개만 사용.`;

    const userMessage = `유저 상황:
- 오늘 지출: ${context.todaySpent}원
- 일 예산: ${context.dailyBudget}원
- 이번 주 잔여 예산: ${context.weeklyRemaining}원
- 신호등 등급: ${context.signalGrade}
- 알뜰 블록 ${context.blueDays}일 / 전체 ${context.totalDays}일
- 러닝 속도: ${context.runningSpeed} km/h
${context.opportunityCost ? `- 오늘 최대 지출 ${context.topExpenseAmount}원(${context.topExpenseDesc})을 10년 투자하면: ${context.opportunityCost}원` : ''}`;

    const response = await this.aiService.generateText(
      systemPrompt,
      userMessage,
      200,
    );

    // 발화 로그 저장
    const client = this.supabaseService.getClient();
    await client.from('pacemaker_logs').insert({
      user_id: userId,
      message: response.content,
      context: JSON.stringify(context),
      tokens_used: response.tokensUsed,
    });

    return {
      message: response.content,
      context,
    };
  }

  /**
   * 이번 주 성과 뱃지를 계산한다.
   * - 절약왕: 최근 7일 연속 알뜰 블록
   * - 저축왕인: 이번 주 저축 ≥ 목표의 120%
   * @param userId - 유저 ID
   * @returns 뱃지 목록
   */
  async getWeeklyBadges(userId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();
    const badges: Record<string, unknown>[] = [];

    // 최근 7일 블록 조회
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = this.formatDate(sevenDaysAgo);

    const { data: blocks } = await client
      .from('daily_blocks')
      .select('block_color')
      .eq('user_id', userId)
      .gte('block_date', startDate)
      .order('block_date', { ascending: true });

    const blockList = (blocks ?? []) as { block_color: string }[];

    // 절약왕: 7일 연속 blue
    if (blockList.length >= 7 && blockList.every((b) => b.block_color === 'blue')) {
      badges.push({ type: 'saving_king', label: '절약왕', earned: true });
    }

    // 저축왕인: 이번 주 저축 >= 목표의 120%
    const { data: budget } = await client
      .from('user_budgets')
      .select('savings_goal')
      .eq('user_id', userId)
      .maybeSingle();

    if (budget) {
      const savingsGoal = (budget as Record<string, unknown>).savings_goal as number;
      const weeklyGoal = Math.floor(savingsGoal / 4);

      // 이번 주 투자/저축 합계
      const { data: savings } = await client
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .in('category', ['투자', '저축'])
        .eq('is_deleted', false)
        .gte('transaction_date', startDate);

      const totalSaved = ((savings ?? []) as { amount: number }[]).reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );

      if (weeklyGoal > 0 && totalSaved >= weeklyGoal * 1.2) {
        badges.push({ type: 'savings_champion', label: '저축왕인', earned: true });
      }
    }

    return badges;
  }

  /**
   * 홈 대시보드 통합 데이터를 조회한다.
   * 프론트가 홈 진입 시 한 번에 필요한 모든 데이터를 묶어서 반환한다.
   * @param userId - 유저 ID
   * @returns 통합 대시보드 데이터
   */
  async getHomeDashboard(userId: string): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 병렬로 데이터 조회
    const [
      pacemakerMessage,
      badges,
      assetSnapshot,
      goalInfo,
    ] = await Promise.all([
      this.generateMessage(userId).catch(() => ({
        message: '오늘도 화이팅! 💪',
        context: {},
      })),
      this.getWeeklyBadges(userId).catch(() => []),
      this.getAssetInfo(userId),
      this.getGoalInfo(userId),
    ]);

    return {
      pacemaker: pacemakerMessage,
      badges,
      asset: assetSnapshot,
      goal: goalInfo,
    };
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────

  /**
   * AI 발화용 컨텍스트를 구성한다.
   */
  private async buildContext(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();
    const today = this.formatDate(new Date());

    // 오늘 지출
    const { data: todayTx } = await client
      .from('transactions')
      .select('amount, description')
      .eq('user_id', userId)
      .eq('transaction_type', 'expense')
      .eq('is_deleted', false)
      .eq('transaction_date', today);

    const todayExpenses = (todayTx ?? []) as { amount: number; description: string }[];
    const todaySpent = todayExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);

    // 오늘 최대 지출
    let topExpenseAmount = 0;
    let topExpenseDesc = '';
    for (const t of todayExpenses) {
      if (Math.abs(t.amount) > topExpenseAmount) {
        topExpenseAmount = Math.abs(t.amount);
        topExpenseDesc = t.description;
      }
    }

    // 일 예산
    const { data: budget } = await client
      .from('user_budgets')
      .select('daily_budget, weekly_budget')
      .eq('user_id', userId)
      .maybeSingle();

    const dailyBudget = budget ? ((budget as Record<string, unknown>).daily_budget as number) : 0;

    // 이번 주 잔여 예산 (간이 계산)
    const weeklyBudget = budget ? ((budget as Record<string, unknown>).weekly_budget as number) : 0;

    // 신호등 등급
    const { data: signal } = await client
      .from('signal_grades')
      .select('grade')
      .eq('user_id', userId)
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const signalGrade = signal ? ((signal as Record<string, unknown>).grade as string) : 'yellow';

    // 블록 통계
    const { data: allBlocks } = await client
      .from('daily_blocks')
      .select('block_color')
      .eq('user_id', userId);

    const blockList = (allBlocks ?? []) as { block_color: string }[];
    const totalDays = blockList.length;
    const blueDays = blockList.filter((b) => b.block_color === 'blue').length;
    const runningSpeed = totalDays > 0 ? Math.round((blueDays / totalDays) * 1000) / 10 : 0;

    // 기회비용 계산
    let opportunityCost = 0;
    if (topExpenseAmount > 0) {
      opportunityCost = this.simulatorService.calculateOpportunityCost(
        topExpenseAmount,
        0.05,
        10,
      );
    }

    return {
      todaySpent,
      dailyBudget,
      weeklyRemaining: weeklyBudget - todaySpent,
      signalGrade,
      totalDays,
      blueDays,
      runningSpeed,
      topExpenseAmount: topExpenseAmount > 0 ? topExpenseAmount : undefined,
      topExpenseDesc: topExpenseDesc || undefined,
      opportunityCost: opportunityCost > 0 ? opportunityCost : undefined,
    };
  }

  /**
   * 자산 정보를 조회한다 (스냅샷 기반).
   */
  private async getAssetInfo(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data: snapshot } = await client
      .from('asset_snapshots')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!snapshot) {
      return { hasSnapshot: false };
    }

    const { data: accounts } = await client
      .from('codef_accounts')
      .select('balance')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    const currentBalance = ((accounts ?? []) as { balance: number }[]).reduce(
      (sum, a) => sum + a.balance,
      0,
    );

    const snapshotData = snapshot as Record<string, unknown>;
    const startBalance = snapshotData.total_balance as number;

    return {
      hasSnapshot: true,
      startBalance,
      currentBalance,
      additionalAsset: currentBalance - startBalance,
      daysPassed: Math.floor(
        (Date.now() - new Date(snapshotData.snapshot_date as string).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    };
  }

  /**
   * 목표 달성 정보를 조회한다.
   */
  private async getGoalInfo(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data: profile } = await client
      .from('user_profiles')
      .select('goal_name, goal_amount')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!profile) return { hasGoal: false };

    const profileData = profile as Record<string, unknown>;
    const goalAmount = (profileData.goal_amount as number) ?? 0;
    const goalName = (profileData.goal_name as string) ?? '';

    if (goalAmount <= 0) return { hasGoal: false };

    // 현재 추가 자산
    const assetInfo = await this.getAssetInfo(userId);
    const additionalAsset = (assetInfo.additionalAsset as number) ?? 0;

    const progress = this.simulatorService.calculateGoalProgress(
      additionalAsset,
      goalAmount * 10000, // 만원 → 원
    );

    return {
      hasGoal: true,
      goalName,
      goalAmount,
      progress,
    };
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
