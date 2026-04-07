// 상세 리포트 v6 타입 정의

// ========== 공통 ==========

export interface ChartData {
  type: string;
  [key: string]: any;
}

export interface PeerData {
  ageGroup: string;
  ageGroupLabel: string;
  avgIncome: number;
  avgSavingsRate: number;
  avgExpenseRatio: number;
  avgFixedRatio: number;
  avgVariableRatio: number;
  avgSurplusRatio: number;
}

export interface UserSnapshot {
  nickname: string;
  age: number;
  retirementAge: number;
  pensionStartAge: number;
  monthlyIncome: number;
  monthlyFixedCost: number;
  monthlyVariableCost: number;
  monthlyExpense: number;
  surplus: number;
  expenseRatio: number;
  grade: string;
  investmentPeriod: number;
  vestingPeriod: number;
}

// ========== Section A: 재무 건강 진단 ==========

export interface ScoreAxis {
  axis: string;
  score: number;
  max: number;
}

export interface PeerComparison {
  ageGroup: string;
  expenseRatio: { user: number; peer: number };
  surplusRatio: { user: number; peer: number };
  variableRatio: { user: number; peer: number };
}

export interface SectionA {
  section: 'A';
  step: 1;
  title: string;
  totalScore: number;
  maxScore: 100;
  grade: string;
  scores: ScoreAxis[];
  peerComparison: PeerComparison;
  chart: ChartData;
  ai_narrative: string;
}

// ========== Section B: 돈의 흐름 ==========

export interface SectionB {
  section: 'B';
  step: 1;
  title: string;
  breakdown: {
    income: number;
    fixedCost: number;
    variableCost: number;
    surplus: number;
  };
  ratios: {
    user: { fixed: number; variable: number; surplus: number };
    peer: { fixed: number; variable: number; surplus: number };
  };
  peerAgeGroup: string;
  charts: {
    waterfall: ChartData;
    comparison: ChartData;
  };
  ai_narrative: string;
}

// ========== Section C: 통합 시뮬레이션 ==========

export interface Scenario {
  name: string;
  rate: number;
  projections: {
    '5y': number;
    '10y': number;
    '20y': number;
    retirement: number;
  };
}

export interface LifeEvent {
  name: string;
  cost: number;
  icon: string;
}

export interface SectionC {
  section: 'C';
  step: 2;
  title: string;
  timeline: {
    currentAge: number;
    retirementAge: number;
    pensionStartAge: number;
    investmentPeriod: number;
    vestingPeriod: number;
  };
  scenarios: Scenario[];
  lifeEvents: LifeEvent[];
  totalEventCost: number;
  netAfterEvents: {
    savings: number;
    investKr: number;
    investGlobal: number;
  };
  retirement: {
    gapFundMin: number;
    gapFundComfort: number;
    nationalPensionMonthly: number;
    monthlyShortfall: number;
    coversGapMin: { savings: boolean; investKr: boolean; investGlobal: boolean };
    coversGapComfort: { savings: boolean; investKr: boolean; investGlobal: boolean };
  };
  charts: {
    assetGrowth: ChartData;
    timeline: ChartData;
    gapBar: ChartData;
  };
  ai_narrative: string;
}

// ========== Section D: 한국의 현실 ==========

export interface GlobalTopic {
  title: string;
  chart: ChartData;
  insight: string;
}

export interface SectionD {
  section: 'D';
  step: 3;
  title: string;
  topics: GlobalTopic[];
  userConnection: string;
  moneyrunDirection: string;
  ai_narrative: string;
}

// ========== Section E: 등급별 로드맵 ==========

export interface RoadmapStep {
  phase: number;
  period: string;
  goal: string;
  targetReduction: number;
}

export interface SectionE {
  section: 'E';
  step: 3;
  title: string;
  current: { grade: string; expenseRatio: number };
  next: { grade: string; targetRatio: number; requiredReduction: number } | null;
  ultimate: { grade: string; targetRatio: number; requiredReduction: number } | null;
  steps: RoadmapStep[];
  chart: ChartData;
  ai_narrative: string;
}

// ========== Section F: 잉여자금 늘리기 ==========

export interface CostTip {
  category: string;
  avgCost: number;
  tip: string;
  potentialSaving: string;
}

export interface BoostScenario {
  extra: number;
  newSurplus: number;
  in10y_savings: number;
  in10y_invest: number;
}

export interface SectionF {
  section: 'F';
  step: 3;
  title: string;
  current: { fixedCost: number; variableCost: number; surplus: number };
  fixedCostTips: CostTip[];
  variableCostTips: CostTip[];
  boostSimulation: BoostScenario[];
  ai_narrative: string;
}

// ========== Section G: 금융 교육 ==========

export interface EducationTopic {
  title: string;
  subtitle: string;
  content: string;
  keyPoints: string[];
  icon: string;
}

export interface SectionG {
  section: 'G';
  step: 3;
  title: string;
  userGrade: string;
  topics: EducationTopic[];
  productRates: Record<string, string>;
  disclaimer: string;
  ai_narrative: string;
}

// ========== Section H: 12개월 캘린더 ==========

export interface CalendarMonth {
  month: number;
  title: string;
  events: string[];
  todo: string;
}

export interface SectionH {
  section: 'H';
  step: 3;
  title: string;
  months: CalendarMonth[];
  ai_narrative: string;
}

// ========== Section I: 금융 용어 사전 ==========

export interface GlossaryTerm {
  term: string;
  definition: string;
  example: string;
}

export interface SectionI {
  section: 'I';
  step: 0;
  title: string;
  message: string;
  userGrade: string;
  terms: GlossaryTerm[];
  ai_narrative: string;
}

// ========== 리포트 전체 ==========

export type ReportSection = SectionA | SectionB | SectionC | SectionD | SectionE | SectionF | SectionG | SectionH | SectionI;

export interface DetailedReportV6 {
  summary: string;
  sections: ReportSection[];
  disclaimer: string;
}
