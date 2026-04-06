import { ReportSection, UserSnapshot } from './report.types';

const SYSTEM_PROMPT = `너는 머니런의 AI 재무 분석가야. 금융을 처음 접하는 사람도 바로 이해할 수 있게 설명하는 게 너의 역할이야.

## 말투
- 반말. 찐친이 카페에서 설명해주는 느낌. 유저 이름으로 호칭해.
- 딱딱한 보고서 말고 대화하듯이.
- 예: "지출비율이 72%입니다" ❌ → "벌어오는 돈 100만 원 중에 72만 원이 나가고 있어" ✅

## 핵심 규칙
1. 초등학생도 이해할 수 있게 써. 전문용어가 나오면 바로 옆에 쉬운 말로 풀어줘.
   예: "소득대체율이 31%야" ❌ → "소득대체율, 쉽게 말하면 '은퇴 전에 벌던 돈의 몇 %를 연금으로 받을 수 있냐'인데, 한국은 31%밖에 안 돼. 월급 300만 원 받던 사람이 연금은 93만 원밖에 못 받는다는 뜻이야." ✅
2. 숫자는 내가 주는 것만 사용. 새로운 숫자를 절대 만들지 마.
3. 비유를 적극적으로 써. 돈 관련 숫자를 일상적인 것에 비유해줘.
   예: "월 5만 원이면 커피 하루 한 잔 값이야", "3.4억이면 서울 전세 한 채 값이야"
4. 확정적 투자 권유, 특정 종목/상품 추천 금지. "이런 게 있어, 관심 있으면 알아봐" 톤.
5. 각 섹션의 ai_narrative를 충분히 길게 써. 짧게 요약하지 마. 읽는 사람이 "아 이게 이런 뜻이구나"하고 완전히 이해할 때까지 설명해.

## 분량 가이드
- Section A, B: 각 8~12문장. 점수 하나하나 무슨 뜻인지, 또래랑 비교하면 어떤지 친절하게.
- Section C: 15~20문장. 가장 중요한 섹션. 시나리오별 차이를 일상 비유로, 생애이벤트 빼면 현실이 어떤지, 공백기가 왜 무서운지 차근차근.
- Section D: 10~15문장. 한국이 세계적으로 어떤 상황인지, 왜 스스로 준비해야 하는지.
- Section E: 8~12문장. 등급이 뭔지, 다음 등급까지 구체적으로 뭘 하면 되는지.
- Section F: 8~12문장. 작은 절약이 왜 큰 차이를 만드는지 비유로.
- Section G: 6~10문장. 왜 이 주제들을 알아야 하는지, 하나씩 천천히.
- Section H: 3~5문장. 가볍게.
- Section I: 2~3문장. 따뜻한 마무리.

## 응답 형식 (JSON 배열만, 다른 텍스트 없이)
[
  { "section": "A", "ai_narrative": "..." },
  { "section": "B", "ai_narrative": "..." },
  { "section": "C", "ai_narrative": "..." },
  { "section": "D", "ai_narrative": "..." },
  { "section": "E", "ai_narrative": "..." },
  { "section": "F", "ai_narrative": "..." },
  { "section": "G", "ai_narrative": "..." },
  { "section": "H", "ai_narrative": "..." },
  { "section": "I", "ai_narrative": "..." }
]`;

function formatWon(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.floor(n / 10000).toLocaleString()}만`;
  return n.toLocaleString();
}

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(user: UserSnapshot, sections: ReportSection[]): string {
  const a = sections.find(s => s.section === 'A') as any;
  const b = sections.find(s => s.section === 'B') as any;
  const c = sections.find(s => s.section === 'C') as any;
  const d = sections.find(s => s.section === 'D') as any;
  const e = sections.find(s => s.section === 'E') as any;
  const f = sections.find(s => s.section === 'F') as any;
  const g = sections.find(s => s.section === 'G') as any;

  return `## 유저 정보
이름: ${user.nickname}
나이: ${user.age}세
등급: ${user.grade}
월 소득: ${formatWon(user.monthlyIncome)}원
고정비: ${formatWon(user.monthlyFixedCost)}원
변동비: ${formatWon(user.monthlyVariableCost)}원
잉여자금: ${formatWon(user.surplus)}원
은퇴 목표: ${user.retirementAge}세
연금 수령: ${user.pensionStartAge}세

---

### Section A: 재무 건강 진단
총점: ${a.totalScore}/100점
5축 점수: ${a.scores.map((s: any) => `${s.axis} ${s.score}/${s.max}`).join(', ')}
또래(${a.peerComparison.ageGroup}) 비교: 지출비율 유저 ${a.peerComparison.expenseRatio.user}% vs 또래 ${a.peerComparison.expenseRatio.peer}%, 잉여비율 유저 ${a.peerComparison.surplusRatio.user}% vs 또래 ${a.peerComparison.surplusRatio.peer}%

→ ai_narrative 작성 가이드:
- 총점이 몇 점이고, 100점 만점 기준으로 어느 정도인지 쉽게 비유해줘 (예: "학교 시험으로 치면 58점, 평균 좀 밑이야")
- 5개 축 중에 제일 잘하는 것과 제일 약한 것을 골라서 "이건 잘하고 있어", "여기는 좀 아쉽다" 식으로
- 또래 비교를 자연스럽게 녹여서 "같은 ${a.peerComparison.ageGroup} 친구들은 보통 이 정도인데 너는 이래" 식으로
- 점수가 뭘 뜻하는지 하나하나 쉽게 풀어줘. "지출 비율 점수가 낮다는 건, 벌어오는 돈 대비 나가는 돈이 많다는 뜻이야"
- 8~12문장.

### Section B: 돈의 흐름
소득 ${formatWon(b.breakdown.income)}원 → 고정비 ${formatWon(b.breakdown.fixedCost)}원 → 변동비 ${formatWon(b.breakdown.variableCost)}원 → 잉여 ${formatWon(b.breakdown.surplus)}원
비율: 고정 ${b.ratios.user.fixed}% / 변동 ${b.ratios.user.variable}% / 잉여 ${b.ratios.user.surplus}%
또래(${b.peerAgeGroup}): 고정 ${b.ratios.peer.fixed}% / 변동 ${b.ratios.peer.variable}% / 잉여 ${b.ratios.peer.surplus}%

→ ai_narrative 작성 가이드:
- "고정비"가 뭔지 먼저 풀어줘 (매달 꼭 나가는 돈: 월세, 보험, 구독 같은 것)
- "변동비"도 풀어줘 (쓰기에 따라 달라지는 돈: 밥값, 쇼핑, 놀러가는 돈)
- 돈이 어디로 많이 빠지는지 구체적으로 짚어줘
- 또래랑 비교: "같은 ${b.peerAgeGroup} 친구들은 잉여가 ${b.ratios.peer.surplus}%인데 너는 ${b.ratios.user.surplus}%야" 식으로 자연스럽게
- 뭘 어떻게 하면 좋아질 수 있는지 가벼운 방향만 (구체적 팁은 Section F에서)
- 8~12문장.

### Section C: 통합 시뮬레이션
투자기간: ${c.timeline.investmentPeriod}년 (${user.age}세→${user.retirementAge}세)
공백기: ${c.timeline.vestingPeriod}년 (${user.retirementAge}세→${user.pensionStartAge}세)
월 잉여 ${formatWon(user.surplus)}원 투자 시 은퇴 시점 자산:
  적금(${c.scenarios[0].rate}%): ${formatWon(c.scenarios[0].projections.retirement)}원
  투자 국내(${c.scenarios[1].rate}%): ${formatWon(c.scenarios[1].projections.retirement)}원
  투자 글로벌(${c.scenarios[2].rate}%): ${formatWon(c.scenarios[2].projections.retirement)}원
생애이벤트 합계: ${formatWon(c.totalEventCost)}원 (${c.lifeEvents.map((e: any) => `${e.name} ${formatWon(e.cost)}원`).join(', ')})
이벤트 차감 후: 적금 ${formatWon(c.netAfterEvents.savings)}원 / 국내 ${formatWon(c.netAfterEvents.investKr)}원 / 글로벌 ${formatWon(c.netAfterEvents.investGlobal)}원
공백기 필요자금: 최소 ${formatWon(c.retirement.gapFundMin)}원 / 적정 ${formatWon(c.retirement.gapFundComfort)}원
국민연금 월 ${formatWon(c.retirement.nationalPensionMonthly)}원, 부족분 월 ${formatWon(c.retirement.monthlyShortfall)}원

→ ai_narrative 작성 가이드 (가장 중요한 섹션!):
- 먼저 "적금이란 은행에 매달 돈을 넣는 거고, 투자란 주식이나 펀드에 돈을 넣어서 불리는 거야" 수준으로 쉽게 깔아줘
- 같은 돈인데 적금 vs 투자가 왜 이렇게 차이 나는지 "복리" 개념을 비유로 설명. "눈덩이가 굴러가면서 점점 커지는 것처럼, 이자에 이자가 붙는 거야"
- 생애이벤트를 빼면 어떻게 되는지 현실감 있게: "결혼하고, 전세 들어가고, 아이 키우고, 차 사면 이만큼이 빠져. 그러면 실제로 남는 건..."
- "공백기"가 뭔지 풀어줘: "은퇴하고 나서 연금 받기 전까지 수입이 0원인 기간"
- 이 기간 동안 최소 얼마가 필요한지, 지금 속도로 모으면 커버가 되는지 안 되는지
- 국민연금이 월 ${formatWon(c.retirement.nationalPensionMonthly)}원인데 적정 생활비가 훨씬 많다는 현실
- 겁만 주는 게 아니라 "그래서 지금부터 준비하면 충분히 바꿀 수 있어"로 마무리
- 15~20문장. 길어도 괜찮아. 이해가 중요해.

### Section D: 한국의 현실
한국 가계저축률 세계 최상위(35.5%), 가계부채 GDP 대비 105%, 연금 소득대체율 31.2%(OECD 하위), 실질 은퇴나이 49세(법정 60세), 투자 참여율 12%
유저 은퇴 목표 ${user.retirementAge}세 (한국 실질 은퇴 49세)

→ ai_narrative 작성 가이드:
- 각 통계가 뭘 뜻하는지 하나하나 풀어줘:
  - "저축률이 높다 = 한국 사람들은 돈을 많이 모아. 근데 이게 좋은 게 아니라, 미래가 불안해서 안 쓰고 모으는 거야"
  - "가계부채 105% = GDP라는 건 나라 전체가 1년 동안 버는 돈인데, 한국 사람들이 진 빚이 그거보다 많다는 뜻"
  - "소득대체율 31% = 일할 때 300만 원 벌었으면 연금은 93만 원밖에 못 받아"
  - "실질 은퇴 49세 = 법으로는 60세까지 일할 수 있다고 하지만, 현실은 49세에 밀려나. 그리고 연금은 65세부터. 16년을 어떻게 살아?"
  - "투자 참여율 12% = 미국은 55%가 투자하는데 한국은 12%. 대부분 적금만 하고 있어"
- 유저 상황이랑 연결: "너의 은퇴 목표는 ${user.retirementAge}세인데..."
- 마지막에 머니런이 이 현실에서 뭘 도와줄 수 있는지 한줄
- 10~15문장.

### Section E: 등급별 로드맵
현재: ${e.current.grade} (지출비율 ${e.current.expenseRatio}%)
${e.next ? `다음 등급(${e.next.grade})까지: 월 ${formatWon(e.next.requiredReduction)}원 절약 필요` : '이미 최고 등급!'}
${e.ultimate ? `최종 등급(${e.ultimate.grade})까지: 월 ${formatWon(e.ultimate.requiredReduction)}원 절약 필요` : ''}

→ ai_narrative 작성 가이드:
- 등급이 뭔지 쉽게: "RED는 벌어오는 돈의 70% 이상이 나가고 있다는 뜻이야. 비상금 모으기도 힘든 상태."
- YELLOW는: "지출은 좀 줄였지만 아직 투자할 여유는 부족한 단계"
- GREEN은: "생활비 쓰고도 돈이 남아서 투자를 시작할 수 있는 단계"
- 다음 등급까지 구체적으로: "월 ${e.next ? formatWon(e.next.requiredReduction) : '0'}원이면 커피 하루 한 잔 아끼면 돼" 식으로 일상 비유
- 단계별로 뭘 하면 되는지 (steps 내용 참고해서 살을 붙여줘)
- "한 번에 다 바꾸려고 하지 마. 한 달에 하나씩만 바꿔보자"로 동기부여
- 8~12문장.

### Section F: 잉여자금 늘리기
현재 잉여: ${formatWon(f.current.surplus)}원
+10만원 → 10년 후 투자 시 ${formatWon(f.boostSimulation[0].in10y_invest)}원
+20만원 → 10년 후 투자 시 ${formatWon(f.boostSimulation[1].in10y_invest)}원
+30만원 → 10년 후 투자 시 ${formatWon(f.boostSimulation[2].in10y_invest)}원

→ ai_narrative 작성 가이드:
- "잉여자금"을 풀어줘: "매달 쓰고 남는 돈. 이게 미래를 바꾸는 씨앗돈이야"
- 월 10만 원 = 하루 3,300원. "편의점 도시락 하나 값이야. 그걸 10년 모으면..." 식의 비유
- 적금 vs 투자 차이를 다시 한번 느끼게: "같은 10만 원인데 어디에 넣느냐에 따라 10년 후에 이만큼 차이 나"
- 고정비/변동비 어디서 줄일 수 있는지 가벼운 방향 (위에 팁 리스트가 있으니까 거기 참고하라고)
- 8~12문장.

### Section G: 금융 교육
등급: ${g.userGrade}
교육 주제: ${g.topics.map((t: any) => t.title).join(', ')}

→ ai_narrative 작성 가이드:
- "이거 다 외울 필요 없어. 하나씩 궁금할 때 찾아보면 돼"로 부담 내려주기
- 왜 이 주제들이 지금 등급에서 중요한지 한마디씩
- 예: RED라면 "지금은 투자보다 비상금부터. 비상금이 왜 중요하냐면..."
- 6~10문장.

### Section H: 12개월 재무 캘린더

→ ai_narrative 작성 가이드:
- 가볍고 긍정적으로. "매달 딱 하나씩만 체크해봐. 1년이면 완전히 달라져 있을 거야"
- 3~5문장.

### Section I: 금융 용어 사전
등급(${user.grade})에 맞는 용어 10개를 선물로 드립니다.

→ ai_narrative 작성 가이드:
- 따뜻하게 마무리. "여기까지 읽어줘서 고마워. 모르는 단어 나올 때마다 여기서 찾아봐. 처음엔 다 어려워. 근데 하나씩 알아가다 보면 돈이 보이기 시작해."
- 2~3문장.`;
}

// 금지 표현 필터
const PROHIBITED_PATTERNS = [
  /반드시\s*(투자|매수|매도)/,
  /확실한\s*수익/,
  /보장된\s*수익률/,
  /지금\s*당장\s*(사|투자|매수)/,
  /손해\s*볼\s*일\s*(없|이\s*없)/,
  /무조건\s*(이득|수익|오른)/,
];

export function filterProhibited(text: string): string {
  let filtered = text;
  for (const pattern of PROHIBITED_PATTERNS) {
    filtered = filtered.replace(pattern, '[표현 수정됨]');
  }
  return filtered;
}

export const DISCLAIMER = '본 리포트는 일반적인 재무 교육 목적으로 제공되며, 특정 금융 상품이나 투자를 추천하는 것이 아닙니다. 모든 투자 결정은 본인의 판단과 책임하에 이루어져야 하며, 필요 시 공인된 재무 상담사와 상담하시기 바랍니다.';
