import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface MessageContext {
  profile: {
    age: number;
    monthlyIncome: number;
    monthlyFixedCost: number;
    grade: string;
    variableCost: { monthly: number; weekly: number; daily: number };
  };
  configMap: Record<string, string>;
  latestReport: any;
  recentScraps: any[];
  yesterdayActionCompleted: boolean;
  today: string;
  dayOfWeek: string;
}

@Injectable()
export class MessageGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generate(context: MessageContext): Promise<string> {
    const prompt = this.buildPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = text.match(/\{[\s\S]*\}/);
      if (!parsed) return this.getFallback(context);

      const { message } = JSON.parse(parsed[0]);
      if (!message) return this.getFallback(context);

      return this.filterProhibited(message);
    } catch {
      return this.getFallback(context);
    }
  }

  private buildPrompt(context: MessageContext): string {
    const { profile, configMap, latestReport, recentScraps, yesterdayActionCompleted, today, dayOfWeek } = context;

    const toneGuide = {
      RED: '직접적이고 유머러스하게. "야 하루에 OO원밖에 못 쓰는데 배달 또 시켜? ㅋㅋ" 스타일.',
      YELLOW: '은근히 찌르는 톤. "저축 하고 있긴 한데... 이 속도면 좀 빡빡하다?" 스타일.',
      GREEN: '격려하면서 다음 단계 제안. "오 꽤 잘하고 있네. 이거 한번 읽어봐 →" 스타일.',
    };

    let contextInfo = '';
    if (latestReport) {
      contextInfo += `\n최근 상세 리포트: "${latestReport.title}" - ${latestReport.summary || ''}`;
    }
    if (recentScraps.length > 0) {
      const scrapTitles = recentScraps.map((s: any) => s.title).filter(Boolean).join(', ');
      if (scrapTitles) {
        contextInfo += `\n유저가 스크랩한 콘텐츠: ${scrapTitles}`;
      }
    }

    const actionFeedback = yesterdayActionCompleted
      ? '\n어제 추천 행동을 완료했어! 칭찬을 반영해줘.'
      : '';

    const f = (n: number) => (Math.floor(n / 1000) * 1000).toLocaleString();

    return `너는 "머니런 페이스메이커"야. 유저의 찐친(진짜 친한 친구)처럼 돈 관리를 잔소리해주는 역할이야.

## 유저 데이터
- 나이: ${profile.age}세
- 월 실수령액: ${f(profile.monthlyIncome)}원
- 월 고정비: ${f(profile.monthlyFixedCost)}원
- 변동비(하루 예산): ${f(profile.variableCost.daily)}원
- 변동비(주): ${f(profile.variableCost.weekly)}원
- 등급: ${profile.grade}
${contextInfo}${actionFeedback}

## 참고 데이터
- 서울 평균 월세: ${f(parseInt(configMap['seoul_avg_rent'] || '0'))}원
- 평균 식비: ${f(parseInt(configMap['avg_food'] || '0'))}원
- 환율: ${configMap['exchange_rate'] || '정보 없음'}원
- 오늘: ${today} (${dayOfWeek})

## 톤 가이드
${toneGuide[profile.grade as keyof typeof toneGuide] || toneGuide.YELLOW}

## 규칙
1. 반말 사용. 찐친처럼 자연스럽게.
2. 오늘의 한마디. 2-3문장. 짧고 임팩트 있게. 하루를 시작하며 새겨야 할 한 문장.
3. 반드시 행동 유도로 끝내기 ("이거 해봐", "이거 읽어봐", "이거 생각해봐").
4. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마. 금액은 천원 단위까지만 (백원 이하 버림).
5. 확정적인 투자 권유, 특정 종목 추천 절대 금지.
6. JSON으로만 응답해. 다른 텍스트 없이.

## 응답 형식 (JSON만)
{ "message": "오늘의 한마디" }`;
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

  private getFallback(context: MessageContext): string {
    const daily = context.profile.variableCost?.daily
      ? `${(Math.floor(context.profile.variableCost.daily / 1000) * 1000).toLocaleString()}원`
      : '알 수 없는 금액';
    return `오늘 하루 예산 ${daily}이야. 점심값 아끼면 저녁에 여유 생긴다?`;
  }
}
