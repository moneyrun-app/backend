import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';

/**
 * 월간 리포트 v2 — 데이터 수집 레이어
 * 각 섹션에 필요한 원시 데이터를 수집하고 수치를 계산한다.
 * AI는 이 수치를 기반으로 narrative만 생성.
 */

// ========== 타입 정의 ==========

export interface SpendingData {
  // 고정비/변동비 비중
  fixedCost: number;
  variableCost: number;
  surplus: number;
  fixedRatio: number;
  variableRatio: number;
  surplusRatio: number;
  // 이번달 지출 통계
  totalSpent: number;
  daysTracked: number;
  daysUnder: number;
  daysOver: number;
  noSpendDays: number;
  bestStreak: number;
  currentStreak: number;
  dailyBudget: number;
  adjustedBudget: number;
  spentRate: number;
  // 전월 비교
  prevTotalSpent: number | null;
  prevSavings: number | null;
  spendingChangeRate: number | null;  // %
  savingsChangeRate: number | null;   // %
  // 다음달 예측
  nextDailyBudget: number;
  nextGrade: string;
  // 또래 비교
  peerAgeGroup: string;
  peerPercentile: number | null;      // 상위 N%
  peerAvgSurplusRatio: number;
}

export interface ProposalItem {
  id: string;
  title: string;
  source: 'detailed_report' | 'pacemaker';
  checked: boolean | null;  // null = 아직 체크 안함
}

export interface ProposalData {
  items: ProposalItem[];
  completionRate: number;
  pacemakerActionTotal: number;
  pacemakerActionCompleted: number;
  pacemakerActionRate: number;
}

export interface QuizItem {
  quizId: string;
  question: string;
  category: string;
  choices: string[];
  correctAnswer: number;
  userAnswer: number;
  correct: boolean;
}

export interface LearningData {
  fqScore: number;
  prevFqScore: number | null;
  fqChange: number | null;
  totalQuizzes: number;
  correctCount: number;
  correctRate: number;
  totalStudyMinutes: number;  // 퀴즈당 30초 환산
  topCategories: string[];
  quizList: QuizItem[];       // 오답 먼저, 정답 나중
  wrongNotes: {
    quizId: string;
    question: string;
    choices: string[];
    correctAnswer: number;
    userAnswer: number;
    briefExplanation: string;
    detailedExplanation: string;
    category: string;
  }[];
}

export interface BadgeResult {
  code: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: string;  // "22/30"
}

export interface MonthlyReportData {
  spending: SpendingData;
  proposals: ProposalData;
  learning: LearningData;
  badges: BadgeResult[];
  month: string;
  nickname: string;
  grade: string;
}

@Injectable()
export class MonthlyReportCollector {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
  ) {}

  /**
   * 월간 리포트에 필요한 모든 데이터를 수집
   */
  async collect(
    userId: string,
    month: string,
    proposalChecks: { proposalId: string; checked: boolean }[],
  ): Promise<MonthlyReportData> {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const [spending, proposals, learning] = await Promise.all([
      this.collectSpending(userId, month, profile, configMap),
      this.collectProposals(userId, month, proposalChecks),
      this.collectLearning(userId, month),
    ]);

    const badges = await this.evaluateBadges(userId, month, spending, learning);

    return {
      spending,
      proposals,
      learning,
      badges,
      month,
      nickname: profile.nickname || '유저',
      grade: profile.grade,
    };
  }

  // ========== ① 소비 데이터 수집 ==========

  private async collectSpending(
    userId: string,
    month: string,
    profile: any,
    configMap: Record<string, string>,
  ): Promise<SpendingData> {
    const { monthStart, monthEnd, daysInMonth } = this.getMonthRange(month);

    // 이번달 daily_checks
    const { data: checks } = await this.supabase.db
      .from('daily_checks')
      .select('date, status, amount')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: true });

    const days = checks || [];
    const totalSpent = days.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const daysTracked = days.length;
    const daysUnder = days.filter((d: any) => d.status === 'under').length;
    const daysOver = days.filter((d: any) => d.status === 'over').length;
    const noSpendDays = days.filter((d: any) => (d.amount || 0) === 0 && d.status === 'under').length;
    const dailyBudget = profile.variableCost.daily;
    const adjustedBudget = dailyBudget * daysTracked;
    const spentRate = adjustedBudget > 0 ? Math.round((totalSpent / adjustedBudget) * 1000) / 10 : 0;

    // 연속 절약일
    const { currentStreak, bestStreak } = this.calculateStreaks(days);

    // 고정비/변동비 비중
    const income = profile.monthlyIncome;
    const fixedCost = profile.monthlyFixedCost;
    const variableCost = profile.monthlyVariableCost;
    const surplus = income - fixedCost - variableCost;
    const fixedRatio = income > 0 ? Math.round((fixedCost / income) * 100) : 0;
    const variableRatio = income > 0 ? Math.round((variableCost / income) * 100) : 0;
    const surplusRatio = income > 0 ? Math.round((surplus / income) * 100) : 0;

    // 전월 비교
    const prevMonth = this.getPrevMonth(month);
    const { data: prevSnapshot } = await this.supabase.db
      .from('monthly_snapshots')
      .select('total_spent, savings')
      .eq('user_id', userId)
      .eq('month', prevMonth)
      .single();

    const prevTotalSpent = prevSnapshot?.total_spent ?? null;
    const savings = income - totalSpent;
    const prevSavings = prevSnapshot?.savings ?? null;
    const spendingChangeRate = prevTotalSpent !== null && prevTotalSpent > 0
      ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 1000) / 10
      : null;
    const savingsChangeRate = prevSavings !== null && prevSavings > 0
      ? Math.round(((savings - prevSavings) / prevSavings) * 1000) / 10
      : null;

    // 다음달 예측: 이번달 실제 소비 기반 등급 재산정
    const actualVariableRatio = income > 0 ? (totalSpent / income) : 0;
    let nextGrade: string;
    if (actualVariableRatio > 0.70) nextGrade = 'RED';
    else if (actualVariableRatio > 0.40) nextGrade = 'YELLOW';
    else nextGrade = 'GREEN';

    const nextDailyBudget = daysTracked > 0
      ? Math.floor((income - fixedCost - totalSpent / daysTracked * daysInMonth) / daysInMonth)
      : dailyBudget;

    // 또래 비교
    const peer = this.constantsService.getPeerData(configMap, profile.age);
    const peerAvgSurplusRatio = peer.avgSurplusRatio || 0;
    // 유저 잉여 비율이 또래 평균 대비 어디인지 (간이 percentile)
    const peerPercentile = this.calculatePeerPercentile(surplusRatio, peerAvgSurplusRatio);

    return {
      fixedCost, variableCost, surplus,
      fixedRatio, variableRatio, surplusRatio,
      totalSpent, daysTracked, daysUnder, daysOver, noSpendDays,
      bestStreak, currentStreak, dailyBudget, adjustedBudget, spentRate,
      prevTotalSpent, prevSavings: prevSavings,
      spendingChangeRate, savingsChangeRate,
      nextDailyBudget: Math.max(nextDailyBudget, 0),
      nextGrade,
      peerAgeGroup: peer.ageGroupLabel,
      peerPercentile,
      peerAvgSurplusRatio,
    };
  }

  // ========== ② 제안 이행 데이터 수집 ==========

  private async collectProposals(
    userId: string,
    month: string,
    proposalChecks: { proposalId: string; checked: boolean }[],
  ): Promise<ProposalData> {
    const items: ProposalItem[] = [];

    // 1. 상세리포트에서 제안 추출 (Section E 로드맵 + Section F 절약팁)
    const { data: reports } = await this.supabase.db
      .from('detailed_reports')
      .select('sections')
      .eq('user_id', userId)
      .eq('report_version', 'v6')
      .order('created_at', { ascending: false })
      .limit(1);

    if (reports && reports.length > 0) {
      const sections = reports[0].sections || [];

      // Section E: 로드맵 steps
      const sectionE = sections.find((s: any) => s.section === 'E');
      if (sectionE?.steps) {
        for (const step of sectionE.steps) {
          const id = `report-e-${step.phase}`;
          const check = proposalChecks.find(c => c.proposalId === id);
          items.push({
            id,
            title: step.goal,
            source: 'detailed_report',
            checked: check?.checked ?? null,
          });
        }
      }

      // Section F: 고정비/변동비 절약팁
      const sectionF = sections.find((s: any) => s.section === 'F');
      if (sectionF) {
        const tips = [...(sectionF.fixedCostTips || []), ...(sectionF.variableCostTips || [])];
        for (let i = 0; i < tips.length; i++) {
          const id = `report-f-${i}`;
          const check = proposalChecks.find(c => c.proposalId === id);
          items.push({
            id,
            title: tips[i].tip,
            source: 'detailed_report',
            checked: check?.checked ?? null,
          });
        }
      }
    }

    // 2. 페이스메이커 액션 이행률
    const { monthStart, monthEnd } = this.getMonthRange(month);

    const { data: actions } = await this.supabase.db
      .from('pacemaker_actions')
      .select('id, title, status')
      .eq('user_id', userId)
      .gte('created_at', `${monthStart}T00:00:00Z`)
      .lte('created_at', `${monthEnd}T23:59:59Z`);

    const actionList = actions || [];
    const pacemakerActionTotal = actionList.length;
    const pacemakerActionCompleted = actionList.filter((a: any) => a.status === 'completed').length;
    const pacemakerActionRate = pacemakerActionTotal > 0
      ? Math.round((pacemakerActionCompleted / pacemakerActionTotal) * 100)
      : 0;

    // 전체 이행률
    const checkedItems = items.filter(i => i.checked === true);
    const totalCheckable = items.filter(i => i.checked !== null);
    const completionRate = totalCheckable.length > 0
      ? Math.round((checkedItems.length / totalCheckable.length) * 100)
      : 0;

    return {
      items,
      completionRate,
      pacemakerActionTotal,
      pacemakerActionCompleted,
      pacemakerActionRate,
    };
  }

  // ========== ④ 학습 데이터 수집 ==========

  private async collectLearning(userId: string, month: string): Promise<LearningData> {
    const { monthStart, monthEnd } = this.getMonthRange(month);

    // 이번달 퀴즈 답변
    const { data: answers } = await this.supabase.db
      .from('quiz_answers')
      .select('quiz_id, user_answer, correct, created_at, quiz:quizzes (id, question, choices, correct_answer, category, brief_explanation, detailed_explanation)')
      .eq('user_id', userId)
      .gte('created_at', `${monthStart}T00:00:00Z`)
      .lte('created_at', `${monthEnd}T23:59:59Z`);

    const answerList = answers || [];
    const totalQuizzes = answerList.length;
    const correctCount = answerList.filter((a: any) => a.correct).length;
    const correctRate = totalQuizzes > 0 ? Math.round((correctCount / totalQuizzes) * 1000) / 10 : 0;
    const totalStudyMinutes = Math.round(totalQuizzes * 0.5);  // 퀴즈당 30초

    // 카테고리별 분포 (상위 3개)
    const categoryCount: Record<string, number> = {};
    for (const a of answerList) {
      const cat = (a as any).quiz?.category || '기타';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // 퀴즈 리스트 (오답 먼저, 정답 나중)
    const quizList: QuizItem[] = answerList
      .map((a: any) => ({
        quizId: a.quiz_id,
        question: a.quiz?.question || '',
        category: a.quiz?.category || '기타',
        choices: a.quiz?.choices || [],
        correctAnswer: a.quiz?.correct_answer || 0,
        userAnswer: a.user_answer,
        correct: a.correct,
      }))
      .sort((a: QuizItem, b: QuizItem) => {
        // 오답 먼저 (false < true → 오답이 앞)
        if (a.correct !== b.correct) return a.correct ? 1 : -1;
        return 0;
      });

    // 오답노트
    const { data: wrongNoteData } = await this.supabase.db
      .from('wrong_notes')
      .select('quiz_id, user_answer, quiz:quizzes (id, question, choices, correct_answer, brief_explanation, detailed_explanation, category)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const wrongNotes = (wrongNoteData || []).map((n: any) => ({
      quizId: n.quiz_id,
      question: n.quiz?.question || '',
      choices: n.quiz?.choices || [],
      correctAnswer: n.quiz?.correct_answer || 0,
      userAnswer: n.user_answer,
      briefExplanation: n.quiz?.brief_explanation || '',
      detailedExplanation: n.quiz?.detailed_explanation || '',
      category: n.quiz?.category || '기타',
    }));

    // FQ 금융지수 계산
    const fqScore = this.calculateFQ(totalQuizzes, correctCount, 0);

    // 전월 FQ 비교
    const prevMonth = this.getPrevMonth(month);
    const { data: prevSnapshot } = await this.supabase.db
      .from('monthly_snapshots')
      .select('fq_score')
      .eq('user_id', userId)
      .eq('month', prevMonth)
      .single();

    const prevFqScore = prevSnapshot?.fq_score ?? null;
    const fqChange = prevFqScore !== null ? fqScore - prevFqScore : null;

    return {
      fqScore, prevFqScore, fqChange,
      totalQuizzes, correctCount, correctRate, totalStudyMinutes,
      topCategories, quizList, wrongNotes,
    };
  }

  // ========== ⑤ 배지 판정 ==========

  private async evaluateBadges(
    userId: string,
    month: string,
    spending: SpendingData,
    learning: LearningData,
  ): Promise<BadgeResult[]> {
    const { data: allBadges } = await this.supabase.db
      .from('badges')
      .select('*');

    if (!allBadges) return [];

    const results: BadgeResult[] = [];

    for (const badge of allBadges) {
      let earned = false;
      let progress = '';

      switch (badge.condition_type) {
        case 'no_spend_days':
          earned = spending.noSpendDays >= badge.condition_value;
          progress = `${spending.noSpendDays}/${badge.condition_value}`;
          break;

        case 'streak_days':
          earned = spending.bestStreak >= badge.condition_value;
          progress = `${spending.bestStreak}/${badge.condition_value}`;
          break;

        case 'budget_under':
          earned = spending.spentRate <= 100 && spending.daysTracked > 0;
          progress = earned ? '달성' : `${spending.spentRate}%`;
          break;

        case 'quiz_total':
          earned = learning.totalQuizzes >= badge.condition_value;
          progress = `${learning.totalQuizzes}/${badge.condition_value}`;
          break;

        case 'quiz_accuracy':
          earned = learning.correctRate >= badge.condition_value && learning.totalQuizzes >= 5;
          progress = `${learning.correctRate}%`;
          break;

        case 'fq_increase':
          earned = (learning.fqChange ?? 0) >= badge.condition_value;
          progress = learning.fqChange !== null ? `+${learning.fqChange}` : '첫 달';
          break;

        case 'wrong_clear':
          earned = learning.wrongNotes.length === 0 && learning.totalQuizzes > 0;
          progress = earned ? '클리어!' : `${learning.wrongNotes.length}개 남음`;
          break;

        case 'proposal_check':
          // 제안 이행은 별도 체크 필요 — 여기서는 skip
          progress = '확인 필요';
          break;

        default:
          progress = '-';
      }

      results.push({
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earned,
        progress,
      });
    }

    // 달성한 배지 DB 저장
    const earnedBadges = results.filter(b => b.earned);
    for (const badge of earnedBadges) {
      const { data: badgeRow } = await this.supabase.db
        .from('badges')
        .select('id')
        .eq('code', badge.code)
        .single();

      if (badgeRow) {
        await this.supabase.db
          .from('user_badges')
          .upsert({
            user_id: userId,
            badge_id: badgeRow.id,
            month,
          }, { onConflict: 'user_id,badge_id,month' });
      }
    }

    return results;
  }

  // ========== 스냅샷 저장 ==========

  async saveSnapshot(userId: string, month: string, data: MonthlyReportData) {
    const income = data.spending.fixedCost + data.spending.variableCost + data.spending.surplus;

    await this.supabase.db
      .from('monthly_snapshots')
      .upsert({
        user_id: userId,
        month,
        monthly_income: income,
        monthly_fixed_cost: data.spending.fixedCost,
        monthly_variable_cost: data.spending.variableCost,
        grade: data.grade,
        total_spent: data.spending.totalSpent,
        savings: income - data.spending.totalSpent,
        surplus: data.spending.surplus,
        fq_score: data.learning.fqScore,
        days_tracked: data.spending.daysTracked,
        days_under: data.spending.daysUnder,
        days_over: data.spending.daysOver,
        no_spend_days: data.spending.noSpendDays,
        quiz_total: data.learning.totalQuizzes,
        quiz_correct: data.learning.correctCount,
        best_streak: data.spending.bestStreak,
      }, { onConflict: 'user_id,month' });
  }

  // ========== 제안 항목 조회 (체크 전) ==========

  async getProposalItems(userId: string): Promise<ProposalItem[]> {
    const items: ProposalItem[] = [];

    const { data: reports } = await this.supabase.db
      .from('detailed_reports')
      .select('sections')
      .eq('user_id', userId)
      .eq('report_version', 'v6')
      .order('created_at', { ascending: false })
      .limit(1);

    if (reports && reports.length > 0) {
      const sections = reports[0].sections || [];

      const sectionE = sections.find((s: any) => s.section === 'E');
      if (sectionE?.steps) {
        for (const step of sectionE.steps) {
          items.push({
            id: `report-e-${step.phase}`,
            title: step.goal,
            source: 'detailed_report',
            checked: null,
          });
        }
      }

      const sectionF = sections.find((s: any) => s.section === 'F');
      if (sectionF) {
        const tips = [...(sectionF.fixedCostTips || []), ...(sectionF.variableCostTips || [])];
        for (let i = 0; i < tips.length; i++) {
          items.push({
            id: `report-f-${i}`,
            title: tips[i].tip,
            source: 'detailed_report',
            checked: null,
          });
        }
      }
    }

    return items;
  }

  // ========== 유틸 ==========

  /**
   * FQ(금융지수) 계산:
   * (정답수 × 3) + (풀이수 × 1) + (학습콘텐츠 읽은수 × 2)
   */
  private calculateFQ(totalQuizzes: number, correctCount: number, learnReads: number): number {
    return (correctCount * 3) + (totalQuizzes * 1) + (learnReads * 2);
  }

  /**
   * 또래 대비 percentile 추정 (간이)
   * 유저 잉여비율이 또래 평균보다 높으면 상위, 낮으면 하위
   */
  private calculatePeerPercentile(userRatio: number, peerAvgRatio: number): number | null {
    if (peerAvgRatio <= 0) return null;
    const diff = userRatio - peerAvgRatio;
    // 정규분포 가정, 표준편차 10% 근사
    const zScore = diff / 10;
    // 간이 percentile: 50 - zScore * 20 (상위이므로 작을수록 좋음)
    const percentile = Math.max(1, Math.min(99, Math.round(50 - zScore * 20)));
    return percentile;
  }

  private calculateStreaks(days: any[]): { currentStreak: number; bestStreak: number } {
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

    // 현재 연속: 끝에서부터 역순
    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].status === 'under') currentStreak++;
      else break;
    }

    return { currentStreak, bestStreak: best };
  }

  private getMonthRange(month: string) {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    return {
      monthStart: `${month}-01`,
      monthEnd: `${month}-${String(daysInMonth).padStart(2, '0')}`,
      daysInMonth,
    };
  }

  private getPrevMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }
}
