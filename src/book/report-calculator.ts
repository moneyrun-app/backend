import { Injectable } from '@nestjs/common';
import {
  SectionA, SectionB, SectionC, SectionD, SectionE,
  SectionF, SectionG, SectionH, SectionI,
  PeerData, ScoreAxis, Scenario, LifeEvent,
  CostTip, BoostScenario, EducationTopic, CalendarMonth, GlossaryTerm,
} from './report.types';

// ========== 유틸 ==========

function floor1000(n: number): number {
  return Math.floor(n / 1000) * 1000;
}

function compoundFV(pmt: number, rateAnnual: number, years: number): number {
  if (rateAnnual === 0) return floor1000(pmt * years * 12);
  const r = rateAnnual / 100 / 12;
  const n = years * 12;
  return floor1000(pmt * ((Math.pow(1 + r, n) - 1) / r));
}

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function parseJsonConfig(configMap: Record<string, string>, key: string): any {
  try { return JSON.parse(configMap[key] || '{}'); } catch { return {}; }
}

@Injectable()
export class ReportCalculator {

  // ========== Section A: 재무 건강 진단 ==========

  calculateSectionA(profile: any, peer: PeerData): SectionA {
    const income = profile.monthlyIncome;
    const expense = (profile.monthlyFixedCost || 0) + (profile.monthlyVariableCost || 0);
    const surplus = income - expense;
    const expenseRatio = expense / income;
    const surplusRatio = surplus / income;
    const fixedRatio = expense > 0 ? profile.monthlyFixedCost / expense : 0;
    const variableRatio = income > 0 ? (profile.monthlyVariableCost || 0) / income * 100 : 0;
    const investYears = (profile.retirementAge || 55) - (profile.age || 30);

    // 5축 점수 (각 20점)
    const s1 = clampScore((1 - expenseRatio) / 0.7 * 20, 20);       // 지출비율 30% 이하 = 만점
    const s2 = clampScore(surplusRatio / 0.3 * 20, 20);              // 잉여 30% 이상 = 만점
    const s3 = clampScore((1 - fixedRatio) / 0.5 * 20, 20);          // 고정비 50% 이하 = 만점
    const s4 = clampScore(
      variableRatio <= peer.avgVariableRatio ? 20 : (1 - (variableRatio - peer.avgVariableRatio) / 20) * 20,
      20,
    ); // 또래 이하 = 만점
    const s5 = clampScore(investYears / 25 * 20, 20);                // 25년 이상 = 만점

    const scores: ScoreAxis[] = [
      { axis: '지출 비율', score: s1, max: 20 },
      { axis: '잉여자금 비율', score: s2, max: 20 },
      { axis: '고정비 유연성', score: s3, max: 20 },
      { axis: '변동비 여유도', score: s4, max: 20 },
      { axis: '투자 가용 기간', score: s5, max: 20 },
    ];
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

    return {
      section: 'A',
      step: 1,
      title: '재무 건강 진단',
      totalScore,
      maxScore: 100,
      grade: profile.grade,
      scores,
      peerComparison: {
        ageGroup: peer.ageGroupLabel,
        expenseRatio: { user: Math.round(expenseRatio * 100), peer: peer.avgExpenseRatio },
        surplusRatio: { user: Math.round(surplusRatio * 100), peer: peer.avgSurplusRatio },
        variableRatio: { user: Math.round(variableRatio), peer: peer.avgVariableRatio },
      },
      chart: {
        type: 'radar',
        labels: scores.map(s => s.axis),
        data: scores.map(s => s.score),
      },
      ai_narrative: '',
    };
  }

  // ========== Section B: 돈의 흐름 ==========

  calculateSectionB(profile: any, peer: PeerData): SectionB {
    const income = profile.monthlyIncome;
    const fixed = profile.monthlyFixedCost || 0;
    const variable = profile.monthlyVariableCost || 0;
    const surplus = income - fixed - variable;

    const userFixed = Math.round(fixed / income * 100 * 10) / 10;
    const userVariable = Math.round(variable / income * 100 * 10) / 10;
    const userSurplus = Math.round(surplus / income * 100 * 10) / 10;

    return {
      section: 'B',
      step: 1,
      title: '돈의 흐름',
      breakdown: {
        income: floor1000(income),
        fixedCost: floor1000(fixed),
        variableCost: floor1000(variable),
        surplus: floor1000(surplus),
      },
      ratios: {
        user: { fixed: userFixed, variable: userVariable, surplus: userSurplus },
        peer: {
          fixed: peer.avgFixedRatio,
          variable: peer.avgVariableRatio,
          surplus: peer.avgSurplusRatio,
        },
      },
      peerAgeGroup: peer.ageGroupLabel,
      charts: {
        waterfall: {
          type: 'waterfall',
          data: [
            { label: '월 소득', value: floor1000(income), type: 'total' },
            { label: '고정비', value: -floor1000(fixed), type: 'decrease' },
            { label: '변동비', value: -floor1000(variable), type: 'decrease' },
            { label: '잉여', value: floor1000(surplus), type: 'result' },
          ],
        },
        comparison: {
          type: 'grouped_bar',
          categories: ['고정비', '변동비', '잉여'],
          series: {
            '나': [userFixed, userVariable, userSurplus],
            '또래 평균': [peer.avgFixedRatio, peer.avgVariableRatio, peer.avgSurplusRatio],
          },
        },
      },
      ai_narrative: '',
    };
  }

  // ========== Section C: 통합 시뮬레이션 ==========

  calculateSectionC(profile: any, configMap: Record<string, string>): SectionC {
    const surplus = profile.monthlyIncome - (profile.monthlyFixedCost || 0) - (profile.monthlyVariableCost || 0);
    const age = profile.age || 30;
    const retAge = profile.retirementAge || 55;
    const penAge = profile.pensionStartAge || 65;
    const investPeriod = retAge - age;
    const vestPeriod = penAge - retAge;

    const savingsRate = parseFloat(configMap['savings_interest_rate'] || '3.5');
    const krRate = parseFloat(configMap['avg_stock_return_kr'] || '8.2');
    const globalRate = parseFloat(configMap['avg_stock_return_global'] || '10.5');

    const calc = (rate: number) => ({
      '5y': compoundFV(surplus, rate, 5),
      '10y': compoundFV(surplus, rate, 10),
      '20y': compoundFV(surplus, rate, 20),
      retirement: compoundFV(surplus, rate, investPeriod),
    });

    const scenarios: Scenario[] = [
      { name: '적금', rate: savingsRate, projections: calc(savingsRate) },
      { name: '투자 (국내)', rate: krRate, projections: calc(krRate) },
      { name: '투자 (글로벌)', rate: globalRate, projections: calc(globalRate) },
    ];

    // 생애 이벤트
    const eventCosts = parseJsonConfig(configMap, 'life_event_costs');
    const lifeEvents: LifeEvent[] = [
      { name: '결혼', cost: eventCosts.wedding || 35000000, icon: 'wedding' },
      { name: '전세 (서울)', cost: eventCosts.jeonse_seoul || 320000000, icon: 'home' },
      { name: '자녀 양육 (0~18세)', cost: eventCosts.child_0_18 || 350000000, icon: 'child' },
      { name: '자동차 (구매+5년)', cost: eventCosts.car_5yr || 50000000, icon: 'car' },
    ];
    const totalEventCost = lifeEvents.reduce((sum, e) => sum + e.cost, 0);

    const netSavings = scenarios[0].projections.retirement - totalEventCost;
    const netKr = scenarios[1].projections.retirement - totalEventCost;
    const netGlobal = scenarios[2].projections.retirement - totalEventCost;

    // 은퇴
    const pensionAvg = parseInt(configMap['national_pension_avg_monthly'] || '600000');
    const minLiving = parseInt(configMap['min_living_cost_retirement'] || '1300000');
    const comfLiving = parseInt(configMap['comfortable_living_cost_retirement'] || '2500000');
    const gapMin = vestPeriod * 12 * minLiving;
    const gapComfort = vestPeriod * 12 * comfLiving;
    const shortfall = comfLiving - pensionAvg;

    return {
      section: 'C',
      step: 2,
      title: '이대로 가면 만나게 될 나의 모습',
      timeline: {
        currentAge: age,
        retirementAge: retAge,
        pensionStartAge: penAge,
        investmentPeriod: investPeriod,
        vestingPeriod: vestPeriod,
      },
      scenarios,
      lifeEvents,
      totalEventCost,
      netAfterEvents: {
        savings: floor1000(netSavings),
        investKr: floor1000(netKr),
        investGlobal: floor1000(netGlobal),
      },
      retirement: {
        gapFundMin: floor1000(gapMin),
        gapFundComfort: floor1000(gapComfort),
        nationalPensionMonthly: pensionAvg,
        monthlyShortfall: shortfall,
        coversGapMin: { savings: netSavings >= gapMin, investKr: netKr >= gapMin, investGlobal: netGlobal >= gapMin },
        coversGapComfort: { savings: netSavings >= gapComfort, investKr: netKr >= gapComfort, investGlobal: netGlobal >= gapComfort },
      },
      charts: {
        assetGrowth: {
          type: 'line',
          xAxis: ['5년', '10년', '20년', '은퇴시'],
          series: {
            '적금': [scenarios[0].projections['5y'], scenarios[0].projections['10y'], scenarios[0].projections['20y'], scenarios[0].projections.retirement],
            '투자 (국내)': [scenarios[1].projections['5y'], scenarios[1].projections['10y'], scenarios[1].projections['20y'], scenarios[1].projections.retirement],
            '투자 (글로벌)': [scenarios[2].projections['5y'], scenarios[2].projections['10y'], scenarios[2].projections['20y'], scenarios[2].projections.retirement],
          },
        },
        timeline: {
          type: 'timeline',
          periods: [
            { from: age, to: retAge, label: `자산 축적기 (${investPeriod}년)`, color: 'green' },
            { from: retAge, to: penAge, label: `공백기 (${vestPeriod}년)`, color: 'red' },
            { from: penAge, to: penAge + 20, label: '연금 수령기', color: 'blue' },
          ],
        },
        gapBar: {
          type: 'stacked_bar',
          data: { '국민연금': pensionAvg, '부족분': shortfall },
          target: comfLiving,
        },
      },
      ai_narrative: '',
    };
  }

  // ========== Section D: 한국의 현실 ==========

  calculateSectionD(configMap: Record<string, string>, profile: any): SectionD {
    const savings = parseJsonConfig(configMap, 'global_savings_rate');
    const debt = parseJsonConfig(configMap, 'global_household_debt_gdp');
    const pension = parseJsonConfig(configMap, 'global_pension_replacement');
    const retAge = parseJsonConfig(configMap, 'global_retirement_age');
    const invest = parseJsonConfig(configMap, 'global_investment_participation');

    return {
      section: 'D',
      step: 3,
      title: '한국의 현실, 그리고 나아갈 방향',
      topics: [
        { title: '가계 저축률', chart: { type: 'horizontal_bar', data: savings, unit: '%', highlight: 'KR' }, insight: '' },
        { title: '가계부채 (GDP 대비)', chart: { type: 'horizontal_bar', data: debt, unit: '%', highlight: 'KR' }, insight: '' },
        { title: '연금 소득대체율', chart: { type: 'horizontal_bar', data: pension, unit: '%', highlight: 'KR' }, insight: '' },
        {
          title: '실질 은퇴 나이',
          chart: {
            type: 'table',
            columns: ['국가', '법정 은퇴', '실제 은퇴', '연금 수령'],
            rows: Object.entries(retAge).map(([code, d]: [string, any]) => [
              code, d.legal, d.actual, d.pension,
            ]),
          },
          insight: '',
        },
        { title: '투자 참여율', chart: { type: 'horizontal_bar', data: invest, unit: '%', highlight: 'KR' }, insight: '' },
      ],
      userConnection: `목표 은퇴 나이 ${profile.retirementAge || 55}세 (한국 실질 은퇴 ${retAge?.KR?.actual || 49}세)`,
      moneyrunDirection: '',
      ai_narrative: '',
    };
  }

  // ========== Section E: 등급별 로드맵 ==========

  calculateSectionE(profile: any): SectionE {
    const income = profile.monthlyIncome;
    const expense = (profile.monthlyFixedCost || 0) + (profile.monthlyVariableCost || 0);
    const ratio = Math.round(expense / income * 100);
    const grade = profile.grade || 'RED';

    let next: SectionE['next'] = null;
    let ultimate: SectionE['ultimate'] = null;
    const steps: SectionE['steps'] = [];

    if (grade === 'RED') {
      const toYellow = Math.max(0, expense - Math.floor(income * 0.70));
      const toGreen = Math.max(0, expense - Math.floor(income * 0.50));
      next = { grade: 'YELLOW', targetRatio: 70, requiredReduction: floor1000(toYellow) };
      ultimate = { grade: 'GREEN', targetRatio: 50, requiredReduction: floor1000(toGreen) };
      steps.push(
        { phase: 1, period: '1~2개월', goal: '지출 파악 + 불필요한 고정비 찾기', targetReduction: floor1000(Math.min(toYellow, 50000)) },
        { phase: 2, period: '3~4개월', goal: '변동비 줄이기 습관화', targetReduction: floor1000(Math.min(toYellow, 100000)) },
        { phase: 3, period: '5~6개월', goal: '잉여자금으로 비상금 마련', targetReduction: floor1000(Math.min(toGreen, 150000)) },
      );
    } else if (grade === 'YELLOW') {
      const toGreen = Math.max(0, expense - Math.floor(income * 0.50));
      next = { grade: 'GREEN', targetRatio: 50, requiredReduction: floor1000(toGreen) };
      steps.push(
        { phase: 1, period: '1~2개월', goal: '변동비 추가 절약', targetReduction: floor1000(Math.min(toGreen, 100000)) },
        { phase: 2, period: '3~4개월', goal: '잉여자금 투자 시작', targetReduction: floor1000(Math.min(toGreen, 200000)) },
        { phase: 3, period: '5~6개월', goal: '자동 투자 습관화', targetReduction: floor1000(toGreen) },
      );
    } else {
      // GREEN — 유지 단계
      steps.push(
        { phase: 1, period: '1~3개월', goal: '포트폴리오 점검', targetReduction: 0 },
        { phase: 2, period: '4~6개월', goal: '자산배분 리밸런싱', targetReduction: 0 },
        { phase: 3, period: '7~12개월', goal: '투자 다각화', targetReduction: 0 },
      );
    }

    return {
      section: 'E',
      step: 3,
      title: '등급별 로드맵',
      current: { grade, expenseRatio: ratio },
      next,
      ultimate,
      steps,
      chart: {
        type: 'gauge',
        current: ratio,
        milestones: [
          { value: 70, label: 'YELLOW', color: '#FBBF24' },
          { value: 50, label: 'GREEN', color: '#34D399' },
        ],
      },
      ai_narrative: '',
    };
  }

  // ========== Section F: 잉여자금 늘리기 ==========

  calculateSectionF(profile: any, configMap: Record<string, string>): SectionF {
    const fixed = profile.monthlyFixedCost || 0;
    const variable = profile.monthlyVariableCost || 0;
    const surplus = profile.monthlyIncome - fixed - variable;
    const savingsRate = parseFloat(configMap['savings_interest_rate'] || '3.5');

    const fixedCostTips: CostTip[] = [
      { category: '주거비', avgCost: parseInt(configMap['seoul_avg_rent'] || '730000'), tip: '월세→전세 전환, 주거급여 확인, 공공임대 신청', potentialSaving: '10~30만원' },
      { category: '보험료', avgCost: parseInt(configMap['avg_insurance'] || '150000'), tip: '중복 보험 체크, 불필요한 특약 해지', potentialSaving: '3~10만원' },
      { category: '구독 서비스', avgCost: parseInt(configMap['avg_subscription'] || '50000'), tip: '안 쓰는 구독 해지, 가족 요금제 활용', potentialSaving: '1~5만원' },
      { category: '통신비', avgCost: parseInt(configMap['avg_telecom'] || '65000'), tip: '알뜰폰 전환 시 월 3~4만원 절약', potentialSaving: '2~4만원' },
    ];

    const variableCostTips: CostTip[] = [
      { category: '식비', avgCost: parseInt(configMap['avg_food'] || '420000'), tip: '배달 줄이기, 도시락, 장보기', potentialSaving: '5~15만원' },
      { category: '교통비', avgCost: parseInt(configMap['avg_transport'] || '80000'), tip: '대중교통 정기권, 자전거 출퇴근', potentialSaving: '1~3만원' },
      { category: '쇼핑', avgCost: parseInt(configMap['avg_shopping'] || '150000'), tip: '충동구매 24시간 대기, 위시리스트 관리', potentialSaving: '3~10만원' },
      { category: '여가/문화', avgCost: parseInt(configMap['avg_leisure'] || '220000'), tip: '무료 문화 프로그램, 도서관, 할인 멤버십', potentialSaving: '2~5만원' },
    ];

    const boost = [100000, 200000, 300000].map((extra): BoostScenario => ({
      extra,
      newSurplus: floor1000(surplus + extra),
      in10y_savings: compoundFV(surplus + extra, savingsRate, 10),
      in10y_invest: compoundFV(surplus + extra, 7, 10),
    }));

    return {
      section: 'F',
      step: 3,
      title: '잉여자금 늘리기',
      current: { fixedCost: floor1000(fixed), variableCost: floor1000(variable), surplus: floor1000(surplus) },
      fixedCostTips,
      variableCostTips,
      boostSimulation: boost,
      ai_narrative: '',
    };
  }

  // ========== Section G: 금융 교육 ==========

  calculateSectionG(profile: any, configMap: Record<string, string>): SectionG {
    const grade = profile.grade || 'RED';

    const topicsByGrade: Record<string, EducationTopic[]> = {
      RED: [
        { title: '비상금', subtitle: '갑자기 돈이 필요할 때를 위한 안전망', content: '', keyPoints: ['최소 월 생활비 3개월분 권장', '입출금 자유 통장에 보관', '투자 자금과 분리'], icon: 'shield' },
        { title: '적금 vs 예금', subtitle: '매달 넣기 vs 한꺼번에 넣기', content: '', keyPoints: ['적금: 매월 일정액 납입', '예금: 목돈 일정 기간 예치', '현재 적금 이율 약 연 3~4.5%'], icon: 'piggybank' },
        { title: 'CMA', subtitle: '증권사 현금관리 통장', content: '', keyPoints: ['입출금 자유 + 이자', '은행 예금보다 높은 이율', '증권사 앱에서 개설 가능'], icon: 'wallet' },
        { title: '파킹통장', subtitle: '하루만 넣어도 이자', content: '', keyPoints: ['입출금 자유', '일복리 적용', '비상금 보관에 적합'], icon: 'parking' },
      ],
      YELLOW: [
        { title: '연금저축', subtitle: '세금도 아끼고 노후도 준비', content: '', keyPoints: ['연 400만 원까지 16.5% 세액공제', '55세부터 연금 수령', '증권사 연금저축펀드로 ETF 투자 가능'], icon: 'pension' },
        { title: '청년도약계좌', subtitle: '정부가 돈을 얹어주는 적금', content: '', keyPoints: ['만 19~34세, 소득 7,500만 원 이하', '월 최대 70만 원 납입', '정부 기여금 + 비과세'], icon: 'rocket' },
        { title: '복리', subtitle: '이자에 이자가 붙는 마법', content: '', keyPoints: ['시간이 돈을 벌어줌', '빨리 시작할수록 유리', '수익 재투자가 핵심'], icon: 'chart' },
        { title: '세액공제', subtitle: '낸 세금 돌려받는 방법', content: '', keyPoints: ['연금저축 + IRP 합산 연 700만 원', '체크카드 공제율 신용카드의 2배', '의료비/교육비 영수증 챙기기'], icon: 'receipt' },
      ],
      GREEN: [
        { title: 'ETF', subtitle: '주식 묶음에 분산 투자', content: '', keyPoints: ['개별 주식보다 위험 분산', 'KODEX 200, TIGER S&P500 등', '연금저축에서 매수 가능'], icon: 'chart' },
        { title: '자산배분', subtitle: '계란을 한 바구니에 담지 마', content: '', keyPoints: ['주식 + 채권 + 현금 비율', '나이에 따라 비율 조절', '리스크 관리의 기본'], icon: 'pie' },
        { title: '리밸런싱', subtitle: '정기적으로 비율 맞추기', content: '', keyPoints: ['연 1~2회 포트폴리오 점검', '오른 자산 일부 매도 → 내린 자산 매수', '장기 수익률 안정화'], icon: 'balance' },
        { title: '해외 투자', subtitle: '글로벌 시장에 투자', content: '', keyPoints: ['S&P500: 미국 500대 기업', '환율 변동 주의', '연금저축으로 절세 투자 가능'], icon: 'globe' },
      ],
    };

    return {
      section: 'G',
      step: 3,
      title: '금융 교육',
      userGrade: grade,
      topics: topicsByGrade[grade] || topicsByGrade['RED'],
      productRates: {
        parking: configMap['product_parking_rate'] || '1.5~3.0',
        savings: configMap['product_savings_rate'] || '3.0~4.5',
        cma: configMap['product_cma_rate'] || '2.0~3.5',
        youthAccount: configMap['product_youth_account_rate'] || '6.0',
        pensionFund: configMap['product_pension_fund_return'] || '7~10',
      },
      disclaimer: '본 내용은 일반적인 금융 교육 목적이며, 특정 금융 상품을 추천하는 것이 아닙니다. 투자 결정은 본인의 판단과 책임하에 이루어져야 합니다.',
      ai_narrative: '',
    };
  }

  // ========== Section H: 12개월 캘린더 ==========

  calculateSectionH(): SectionH {
    const months: CalendarMonth[] = [
      { month: 1, title: '1월', events: ['연말정산 간소화 서비스 오픈'], todo: '연말정산 서류 다운로드, 공제 항목 확인' },
      { month: 2, title: '2월', events: ['설날 특별지출 시즌'], todo: '명절 예산 미리 잡기, 보너스는 비상금으로' },
      { month: 3, title: '3월', events: ['건강보험료 정산', '자동차세 연납 할인'], todo: '건보료 정산 확인, 자동차세 연납 시 10% 할인' },
      { month: 4, title: '4월', events: ['종합소득세 신고 준비'], todo: '프리랜서/부수입 있으면 종소세 준비 시작' },
      { month: 5, title: '5월', events: ['종합소득세 신고·납부'], todo: '5/31까지 신고, 환급은 6월 입금' },
      { month: 6, title: '6월', events: ['상반기 재무 점검'], todo: '1~6월 지출 돌아보기, 하반기 예산 조정' },
      { month: 7, title: '7월', events: ['건강보험료 조정', '여름 휴가 시즌'], todo: '휴가 예산 미리 잡기' },
      { month: 8, title: '8월', events: ['추석 준비 시즌'], todo: '추석 선물/교통 예산 미리 계획' },
      { month: 9, title: '9월', events: ['추석 특별지출'], todo: '추석 지출 정산, 카드 청구서 확인' },
      { month: 10, title: '10월', events: ['연말정산 미리보기'], todo: '올해 공제 항목 점검, 연금저축 부족분 확인' },
      { month: 11, title: '11월', events: ['연금저축 납입 마감 임박'], todo: '연금저축/IRP 연간 한도 채우기' },
      { month: 12, title: '12월', events: ['연금저축 납입 마감', '연말 정리'], todo: '12/31까지 연금저축·IRP 납입, 올해 재무 총정리' },
    ];

    return {
      section: 'H',
      step: 3,
      title: '12개월 재무 캘린더',
      months,
      ai_narrative: '',
    };
  }

  // ========== Section I: 금융 용어 사전 ==========

  calculateSectionI(profile: any): SectionI {
    const grade = profile.grade || 'RED';

    const termsByGrade: Record<string, GlossaryTerm[]> = {
      RED: [
        { term: '비상금', definition: '갑작스러운 지출에 대비해 별도로 준비해두는 자금', example: '월 생활비 150만 원이면 비상금은 최소 450만 원(3개월분)' },
        { term: '복리', definition: '이자에 다시 이자가 붙는 방식', example: '100만 원을 연 5% 복리로 30년 → 약 432만 원' },
        { term: '인플레이션', definition: '물가가 지속적으로 올라 돈의 실질 가치가 떨어지는 현상', example: '연 2.5%면 10년 후 100만 원의 실질 가치는 약 78만 원' },
        { term: 'CMA', definition: '증권사에서 관리하는 현금관리계좌, 입출금 자유 + 이자', example: '비상금 500만 원을 CMA에 넣으면 연 2~3% 이자' },
        { term: '적금', definition: '매월 일정 금액을 넣고 만기에 원금+이자를 받는 저축', example: '월 30만 원 × 12개월 적금 (연 4%) → 만기 약 374만 원' },
        { term: '예금', definition: '목돈을 일정 기간 맡기고 이자를 받는 저축', example: '1,000만 원 정기예금 (연 3.5%, 1년) → 만기 약 1,035만 원' },
        { term: '파킹통장', definition: '하루만 넣어도 이자가 붙는 자유입출금 통장', example: '카카오뱅크, 토스뱅크 등에서 제공' },
        { term: '자동이체', definition: '정해진 날짜에 자동으로 돈을 옮기는 설정', example: '월급일에 적금·비상금 자동이체 설정하면 강제 저축 효과' },
        { term: '소득대체율', definition: '은퇴 전 소득 대비 연금 수령액의 비율', example: '월급 300만 원이었는데 연금 90만 원이면 소득대체율 30%' },
        { term: '72의 법칙', definition: '투자금이 2배 되는 기간을 간단히 계산하는 법칙', example: '72 ÷ 수익률(%) = 2배 되는 년수. 연 7%면 약 10년' },
      ],
      YELLOW: [
        { term: '연금저축', definition: '개인이 가입하는 노후 대비 저축, 세액공제 혜택', example: '연 400만 원 납입 시 66만 원 세금 환급 (16.5%)' },
        { term: 'IRP', definition: '개인형 퇴직연금, 연금저축과 합산 700만 원까지 공제', example: '연금저축 400만 + IRP 300만 = 최대 115만 원 환급' },
        { term: '세액공제', definition: '계산된 세금에서 일정 금액을 직접 빼주는 것', example: '연금저축 400만 원 → 66만 원 세금 돌려받음' },
        { term: '소득공제', definition: '과세 대상 소득을 줄여주는 것 (세액공제와 다름)', example: '체크카드 사용 30% 소득공제 (신용카드는 15%)' },
        { term: '청년도약계좌', definition: '정부가 기여금을 얹어주는 청년 전용 적금', example: '월 70만 원 × 5년 + 정부 기여금 = 5,000만 원+' },
        { term: '원리금균등상환', definition: '매달 같은 금액(원금+이자)을 갚는 방식', example: '대출 1억, 연 4%, 30년 → 월 약 47만 원 고정' },
        { term: '원금균등상환', definition: '매달 같은 원금 + 줄어드는 이자를 갚는 방식', example: '처음엔 부담 크지만 갈수록 줄어듦' },
        { term: '신용등급', definition: '개인의 대출 상환 능력을 점수화한 것 (1~1000점)', example: '신용점수 높으면 대출 금리 낮아짐' },
        { term: 'DSR', definition: '총부채원리금상환비율, 소득 대비 대출 상환액 비율', example: 'DSR 40%면 연소득 5,000만 원일 때 연 2,000만 원까지 상환' },
        { term: '금리', definition: '돈을 빌리거나 맡길 때 적용되는 이자의 비율', example: '기준금리 3.5% → 대출금리·예금금리에 영향' },
      ],
      GREEN: [
        { term: 'ETF', definition: '여러 주식/채권을 묶어 거래소에서 사고파는 펀드', example: 'KODEX 200 = 한국 상위 200개 기업에 분산 투자' },
        { term: '자산배분', definition: '주식·채권·현금 등에 비율을 나눠 투자하는 전략', example: '주식 60% + 채권 30% + 현금 10%' },
        { term: '리밸런싱', definition: '정해둔 자산배분 비율로 되돌리는 작업', example: '주식 비중이 70%로 올랐으면 일부 매도 → 채권 매수' },
        { term: 'S&P 500', definition: '미국 상위 500개 기업으로 구성된 주가지수', example: '지난 30년 연평균 수익률 약 10%' },
        { term: 'TDF', definition: '은퇴 시점에 맞춰 자동으로 자산배분하는 펀드', example: 'TDF 2055 = 2055년 은퇴 예정자용 (지금은 주식 비중 높음)' },
        { term: '배당', definition: '기업이 이익의 일부를 주주에게 나눠주는 것', example: '삼성전자 1주 보유 시 연 약 1,400원 배당' },
        { term: '환헤지', definition: '환율 변동 위험을 줄이는 전략', example: '해외 ETF 투자 시 (H) 붙은 상품은 환헤지 적용' },
        { term: '인플레이션 헤지', definition: '물가 상승에 대비해 자산 가치를 보존하는 전략', example: '부동산, 원자재, 물가연동채권 등' },
        { term: '매수/매도', definition: '사는 것(매수)과 파는 것(매도)', example: 'ETF 1주를 10,000원에 매수, 12,000원에 매도 → 2,000원 수익' },
        { term: '분산투자', definition: '여러 자산에 나눠 투자해 위험을 줄이는 것', example: '한국 주식만 → 한국+미국+채권으로 분산' },
      ],
    };

    return {
      section: 'I',
      step: 0,
      title: '금융 용어 사전',
      message: '여기까지 읽어주셔서 감사해요. 금융용어사전을 선물로 마이북에 넣어드렸어요!',
      userGrade: grade,
      terms: termsByGrade[grade] || termsByGrade['RED'],
      ai_narrative: '',
    };
  }
}
