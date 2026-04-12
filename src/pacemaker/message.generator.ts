import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface MessageContext {
  profile: {
    age: number;
    monthlyIncome: number;
    monthlyInvestment?: number;
    monthlyFixedCost: number;
    grade: string;
    variableCost: { monthly: number; weekly: number; daily: number };
    availableBudget?: { monthly: number; weekly: number; daily: number };
  };
  nickname: string;
  configMap: Record<string, string>;
  recentScraps: any[];
  today: string;
  dayOfWeek: string;
  dayOfWeekIndex: number;
}

export interface MessageCard {
  cardNumber: number;
  emoji: string;
  title: string;
  content: string;
}

export interface GeneratedMessage {
  cards: MessageCard[];
  theme: string;
  quote: string;
}

const DAILY_THEMES: Record<number, { theme: string; guide: string }> = {
  1: { theme: '이번 주 예산 점검', guide: '이번 주 예산을 점검하고 계획을 세우도록 유도해.' },
  2: { theme: '절약 꿀팁', guide: '실생활에서 바로 써먹을 수 있는 절약 팁을 알려줘.' },
  3: { theme: '소비 습관 점검', guide: '소비 습관을 점검하고 개선 방향을 제시해.' },
  4: { theme: '투자/금융 상식', guide: '초보자도 이해할 수 있는 투자/금융 상식을 알려줘.' },
  5: { theme: '주말 소비 경고', guide: '주말에 돈이 많이 새는 패턴을 경고하고 예산을 정하도록 유도해.' },
  6: { theme: '저축/자산 관리 팁', guide: '저축이나 자산 관리에 도움이 되는 실질적인 팁을 알려줘.' },
  0: { theme: '이번 주 회고', guide: '이번 주를 회고하고, 다음 주 목표를 제안해.' },
};

@Injectable()
export class MessageGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generate(context: MessageContext): Promise<GeneratedMessage> {
    const prompt = this.buildPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = text.match(/\{[\s\S]*\}/);
      if (!parsed) return this.getFallback(context);

      const result = JSON.parse(parsed[0]);
      if (!result.cards || !Array.isArray(result.cards)) return this.getFallback(context);

      const cards: MessageCard[] = result.cards.map((card: any, i: number) => ({
        cardNumber: i + 1,
        emoji: card.emoji || '💰',
        title: card.title || '',
        content: this.filterProhibited(card.content || ''),
      }));

      return {
        cards,
        theme: DAILY_THEMES[context.dayOfWeekIndex]?.theme || '오늘의 한마디',
        quote: result.quote || '',
      };
    } catch {
      return this.getFallback(context);
    }
  }

  private buildPrompt(context: MessageContext): string {
    const { profile, nickname, configMap, recentScraps, today, dayOfWeek, dayOfWeekIndex } = context;

    const themeInfo = DAILY_THEMES[dayOfWeekIndex] || DAILY_THEMES[3];

    const toneGuide: Record<string, string> = {
      RED: '직접적이고 유머러스하게. "야 하루에 OO원밖에 못 쓰는데 배달 또 시켜? ㅋㅋ" 스타일.',
      YELLOW: '은근히 찌르는 톤. "저축 하고 있긴 한데... 이 속도면 좀 빡빡하다?" 스타일.',
      GREEN: '격려하면서 다음 단계 제안. "오 꽤 잘하고 있네. 이거 한번 읽어봐 →" 스타일.',
    };

    const investmentInfo = profile.monthlyInvestment
      ? `\n월 투자액: ${f(profile.monthlyInvestment)}원`
      : '';

    const availableBudgetInfo = profile.availableBudget
      ? `\n사용 가능 예산(일): ${f(profile.availableBudget.daily)}원 / 예산(주): ${f(profile.availableBudget.weekly)}원`
      : '';

    let contextInfo = '';
    if (recentScraps.length > 0) {
      const scrapTitles = recentScraps.map((s: any) => s.title).filter(Boolean).join(', ');
      if (scrapTitles) {
        contextInfo += `\n유저가 스크랩한 콘텐츠: ${scrapTitles}`;
      }
    }

    return `너는 "머니런 페이스메이커"야. 유저의 찐친(진짜 친한 친구)처럼 돈 관리를 잔소리해주는 역할이야.

## 유저 데이터
- 이름: ${nickname}
- 나이: ${profile.age}세
- 월 실수령액: ${f(profile.monthlyIncome)}원
- 월 고정비: ${f(profile.monthlyFixedCost)}원
- 변동비(하루 예산): ${f(profile.variableCost.daily)}원
- 변동비(주): ${f(profile.variableCost.weekly)}원
- 등급: ${profile.grade}${investmentInfo}${availableBudgetInfo}${contextInfo}

## 참고 데이터
- 서울 평균 월세: ${f(parseInt(configMap['seoul_avg_rent'] || '0'))}원
- 평균 식비: ${f(parseInt(configMap['avg_food'] || '0'))}원
- 오늘: ${today} (${dayOfWeek})

## 오늘의 테마: ${themeInfo.theme}
${themeInfo.guide}

## 톤 가이드
${toneGuide[profile.grade] || toneGuide.YELLOW}

## 규칙
1. 반말 사용. 찐친처럼 자연스럽게. 반드시 "${nickname}아" 또는 "${nickname}야"로 시작.
2. **카드 5장** 형식으로 작성해. 각 카드는 하나의 주제를 깊이 있게 다뤄.
3. 각 카드는 5~8문장으로 구체적이고 상세하게 작성해. 숫자 예시, 비유, 실생활 팁을 풍부하게 넣어. 최소 150자 이상.
4. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마. 금액은 천원 단위까지만.
5. 확정적인 투자 권유, 특정 종목 추천 절대 금지.
6. 마지막에 명언 1개를 포함.
7. JSON으로만 응답해. 다른 텍스트 없이.

## 카드 구성 가이드 (각 카드 150자 이상, 상세하게)
- 카드 1: 인사 + 오늘의 핵심 메시지 (유저 상황 진단, 공감 포인트, 현실적인 이야기)
- 카드 2: 구체적인 숫자로 현실 파악 (유저 데이터 기반 분석, 또래 비교, 비율 계산)
- 카드 3: 오늘의 테마에 맞는 실전 팁 (바로 써먹을 수 있는 구체적 방법 2-3가지)
- 카드 4: 미래 시뮬레이션 (이대로 가면 N년 후 / 이렇게 바꾸면 N년 후, 구체적 금액 비교)
- 카드 5: 오늘의 행동 제안 + 응원 (구체적인 행동 1가지 + 동기부여 멘트)

## 응답 형식 (JSON만)
{
  "cards": [
    { "emoji": "👋", "title": "카드 제목", "content": "상세 내용 5~8문장. 150자 이상. 구체적 숫자와 비유 포함." },
    { "emoji": "📊", "title": "카드 제목", "content": "상세 내용 5~8문장. 150자 이상. 데이터 분석과 비교." },
    { "emoji": "💡", "title": "카드 제목", "content": "상세 내용 5~8문장. 150자 이상. 실전 팁 2-3가지." },
    { "emoji": "🔮", "title": "카드 제목", "content": "상세 내용 5~8문장. 150자 이상. 미래 시뮬레이션." },
    { "emoji": "🔥", "title": "카드 제목", "content": "상세 내용 5~8문장. 150자 이상. 행동 제안 + 응원." }
  ],
  "quote": "워렌 버핏 — 돈을 잃지 마라. 그게 첫 번째 규칙이다."
}`;
  }

  private filterProhibited(message: string): string {
    const prohibited = [
      '반드시 수익', '확실한 투자', '보장된 수익',
      '무조건 오른다', '꼭 사야', '지금 당장 투자',
    ];

    let filtered = message;
    for (const word of prohibited) {
      if (filtered.includes(word)) {
        filtered = filtered.replace(word, '고려해볼 만한');
      }
    }
    return filtered;
  }

  private getFallback(context: MessageContext): GeneratedMessage {
    const daily = context.profile.variableCost?.daily
      ? `${f(context.profile.variableCost.daily)}원`
      : '알 수 없는 금액';

    return {
      cards: [
        { cardNumber: 1, emoji: '👋', title: '안녕!', content: `${context.nickname}아, 오늘 하루 예산 ${daily}이야. 잘 지켜보자!` },
        { cardNumber: 2, emoji: '📊', title: '오늘의 예산', content: `하루 ${daily}이면 점심 만원, 교통비 빼면 나머지로 버텨야 해.` },
        { cardNumber: 3, emoji: '💡', title: '꿀팁', content: '오늘 점심은 도시락 싸가면 만원 절약이야. 그 만원이 한 달이면 30만원이거든.' },
        { cardNumber: 4, emoji: '🔮', title: '한 달 후', content: '매일 만원씩만 아껴도 한 달에 30만원, 1년이면 360만원이야.' },
        { cardNumber: 5, emoji: '🔥', title: '오늘의 미션', content: '오늘 하나만 해봐. 카페 대신 텀블러 들고 다니기! 화이팅!' },
      ],
      theme: DAILY_THEMES[context.dayOfWeekIndex]?.theme || '오늘의 한마디',
      quote: '벤저민 프랭클린 — 절약은 큰 수입이다.',
    };
  }
}

function f(n: number): string {
  return (Math.floor(n / 1000) * 1000).toLocaleString();
}
