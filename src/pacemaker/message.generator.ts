import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface SpendingData {
  yesterdayAmount: number | null;   // null = 미체크
  yesterdayStatus: string | null;   // 'under' | 'over' | null
  weekTotalSpent: number;
  weekDaysTracked: number;
  weekAdjustedBudget: number;
  currentStreak: number;            // 연속 절약일
}

interface MessageContext {
  profile: {
    age: number;
    monthlyIncome: number;
    monthlyFixedCost: number;
    grade: string;
    variableCost: { monthly: number; weekly: number; daily: number };
  };
  nickname: string;
  configMap: Record<string, string>;
  recentScraps: any[];
  spending: SpendingData;
  today: string;
  dayOfWeek: string;
  dayOfWeekIndex: number; // 0=일, 1=월, ..., 6=토
}

const DAILY_THEMES: Record<number, { theme: string; guide: string }> = {
  1: { theme: '이번 주 예산 점검', guide: '이번 주 예산을 점검하고 계획을 세우도록 유도해.' },
  2: { theme: '절약 꿀팁', guide: '실생활에서 바로 써먹을 수 있는 절약 팁 1개를 알려줘.' },
  3: { theme: '소비 습관 점검', guide: '어제/이번 주 지출 데이터를 바탕으로 소비 습관을 점검해줘.' },
  4: { theme: '투자/금융 상식', guide: '초보자도 이해할 수 있는 투자/금융 상식 1개를 알려줘.' },
  5: { theme: '주말 소비 경고', guide: '주말에 돈이 많이 새는 패턴을 경고하고 예산을 정하도록 유도해.' },
  6: { theme: '저축/자산 관리 팁', guide: '저축이나 자산 관리에 도움이 되는 실질적인 팁을 알려줘.' },
  0: { theme: '이번 주 회고', guide: '이번 주 지출 데이터를 바탕으로 회고하고, 다음 주 목표를 제안해.' },
};

@Injectable()
export class MessageGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generate(context: MessageContext): Promise<{ message: string; theme: string; quote: string }> {
    const prompt = this.buildPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = text.match(/\{[\s\S]*\}/);
      if (!parsed) return this.getFallback(context);

      const result = JSON.parse(parsed[0]);
      if (!result.message) return this.getFallback(context);

      return {
        message: this.filterProhibited(result.message),
        theme: DAILY_THEMES[context.dayOfWeekIndex]?.theme || '오늘의 한마디',
        quote: result.quote || '',
      };
    } catch {
      return this.getFallback(context);
    }
  }

  private buildPrompt(context: MessageContext): string {
    const { profile, nickname, configMap, recentScraps, spending, today, dayOfWeek, dayOfWeekIndex } = context;

    const themeInfo = DAILY_THEMES[dayOfWeekIndex] || DAILY_THEMES[3];

    const toneGuide: Record<string, string> = {
      RED: '직접적이고 유머러스하게. "야 하루에 OO원밖에 못 쓰는데 배달 또 시켜? ㅋㅋ" 스타일.',
      YELLOW: '은근히 찌르는 톤. "저축 하고 있긴 한데... 이 속도면 좀 빡빡하다?" 스타일.',
      GREEN: '격려하면서 다음 단계 제안. "오 꽤 잘하고 있네. 이거 한번 읽어봐 →" 스타일.',
    };

    // 지출 데이터 문자열 구성
    let spendingInfo = '';
    if (spending.yesterdayAmount !== null) {
      const overUnder = spending.yesterdayStatus === 'over' ? '초과' : '절약';
      spendingInfo += `\n어제 지출: ${f(spending.yesterdayAmount)}원 (예산 ${f(profile.variableCost.daily)}원 대비 ${overUnder})`;
    } else {
      spendingInfo += '\n어제 지출: 기록 안 함';
    }
    if (spending.weekDaysTracked > 0) {
      spendingInfo += `\n이번 주 지출: ${f(spending.weekTotalSpent)}원 / ${spending.weekDaysTracked}일 기록 (${spending.weekDaysTracked}일 예산: ${f(spending.weekAdjustedBudget)}원)`;
    }
    if (spending.currentStreak > 0) {
      spendingInfo += `\n연속 절약: ${spending.currentStreak}일째`;
    }

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
- 등급: ${profile.grade}
${spendingInfo}${contextInfo}

## 참고 데이터
- 서울 평균 월세: ${f(parseInt(configMap['seoul_avg_rent'] || '0'))}원
- 평균 식비: ${f(parseInt(configMap['avg_food'] || '0'))}원
- 오늘: ${today} (${dayOfWeek})

## 오늘의 테마: ${themeInfo.theme}
${themeInfo.guide}

## 톤 가이드
${toneGuide[profile.grade] || toneGuide.YELLOW}

## 규칙
1. 반말 사용. 찐친처럼 자연스럽게.
2. 반드시 "${nickname}아" 또는 "${nickname}야"로 시작. 매번 이름을 불러줘.
3. 오늘의 한마디. 2-3문장. 짧고 임팩트 있게.
4. 반드시 행동 유도로 끝내기 ("이거 해봐", "이거 읽어봐", "이거 생각해봐").
5. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마. 금액은 천원 단위까지만 (백원 이하 버림).
6. 확정적인 투자 권유, 특정 종목 추천 절대 금지.
7. 명언 1개를 포함. 오늘의 테마와 관련된 유명한 명언을 골라서 넣어줘. "이름 — 명언" 형식.
8. JSON으로만 응답해. 다른 텍스트 없이.

## 응답 형식 (JSON만)
{ "message": "오늘의 한마디", "quote": "워렌 버핏 — 돈을 잃지 마라. 그게 첫 번째 규칙이다." }`;
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

  private getFallback(context: MessageContext): { message: string; theme: string; quote: string } {
    const daily = context.profile.variableCost?.daily
      ? `${f(context.profile.variableCost.daily)}원`
      : '알 수 없는 금액';
    return {
      message: `${context.nickname}아, 오늘 하루 예산 ${daily}이야. 점심값 아끼면 저녁에 여유 생긴다?`,
      theme: DAILY_THEMES[context.dayOfWeekIndex]?.theme || '오늘의 한마디',
      quote: '벤저민 프랭클린 — 절약은 큰 수입이다.',
    };
  }
}

function f(n: number): string {
  return (Math.floor(n / 1000) * 1000).toLocaleString();
}
