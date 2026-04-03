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
  learnContents: any[];
  yesterdayActionCompleted: boolean;
  today: string;
  dayOfWeek: string;
}

interface GeneratedMessage {
  message: string;
  actions: Array<{
    type: string;
    id: string;
    title: string;
    label: string;
  }>;
}

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
        model: 'claude-sonnet-4-6-20260403',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseResponse(text, context.learnContents);
    } catch {
      return this.getFallbackMessage(context.profile, context.dayOfWeek, context.learnContents);
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
      ? '\n어제 추천 행동을 완료했어! 이걸 메시지에 칭찬으로 반영해줘.'
      : '';

    return `너는 "머니런 페이스메이커"야. 유저의 찐친(진짜 친한 친구)처럼 돈 관리를 잔소리해주는 역할이야.

## 유저 데이터
- 나이: ${profile.age}세
- 월 실수령액: ${profile.monthlyIncome.toLocaleString()}원
- 월 고정비: ${profile.monthlyFixedCost.toLocaleString()}원
- 변동비(하루 예산): ${profile.variableCost.daily.toLocaleString()}원
- 변동비(주): ${profile.variableCost.weekly.toLocaleString()}원
- 등급: ${profile.grade}
${contextInfo}${actionFeedback}

## 참고 데이터
- 서울 평균 월세: ${parseInt(configMap['seoul_avg_rent'] || '0').toLocaleString()}원
- 평균 식비: ${parseInt(configMap['avg_food'] || '0').toLocaleString()}원
- 환율: ${configMap['exchange_rate'] || '정보 없음'}원
- 오늘: ${today} (${dayOfWeek})

## 톤 가이드
${toneGuide[profile.grade as keyof typeof toneGuide] || toneGuide.YELLOW}

## 규칙
1. 반말 사용. 찐친처럼 자연스럽게.
2. 메시지는 2-3문장. 짧고 임팩트 있게.
3. 반드시 행동 유도로 끝내기 ("이거 해봐", "이거 읽어봐", "이거 생각해봐").
4. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마.
5. 확정적인 투자 권유, 특정 종목 추천 절대 금지.
6. JSON으로만 응답해.

## 응답 형식 (JSON만)
{
  "message": "오늘의 한마디 메시지"
}`;
  }

  private parseResponse(text: string, learnContents: any[]): GeneratedMessage {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');

      const parsed = JSON.parse(jsonMatch[0]);

      // 금지 표현 필터링
      const filtered = this.filterProhibited(parsed.message);

      // 추천 행동: 등급에 맞는 학습 콘텐츠에서 1개 선택
      const actions: GeneratedMessage['actions'] = [];
      if (learnContents.length > 0) {
        const randomContent = learnContents[Math.floor(Math.random() * learnContents.length)];
        actions.push({
          type: 'learn_content',
          id: randomContent.id,
          title: randomContent.title,
          label: '이거 읽어봐 →',
        });
      }

      return { message: filtered, actions };
    } catch {
      return this.getFallbackMessage(
        { variableCost: { daily: 0 }, grade: 'YELLOW' } as any,
        '',
        learnContents,
      );
    }
  }

  private filterProhibited(message: string): string {
    const prohibited = [
      '반드시 수익',
      '확실한 투자',
      '보장된 수익',
      '무조건 오른다',
      '꼭 사야',
      '지금 당장 투자',
    ];

    let filtered = message;
    for (const word of prohibited) {
      if (filtered.includes(word)) {
        filtered = filtered.replace(word, '고려해볼 만한');
      }
    }
    return filtered;
  }

  private getFallbackMessage(
    profile: any,
    dayOfWeek: string,
    learnContents: any[],
  ): GeneratedMessage {
    const dailyStr = profile.variableCost?.daily
      ? `${profile.variableCost.daily.toLocaleString()}원`
      : '알 수 없는 금액';

    const actions: GeneratedMessage['actions'] = [];
    if (learnContents.length > 0) {
      actions.push({
        type: 'learn_content',
        id: learnContents[0].id,
        title: learnContents[0].title,
        label: '이거 읽어봐 →',
      });
    }

    return {
      message: `오늘도 하루 ${dailyStr}이야. 오늘 하루도 알뜰하게 가보자!`,
      actions,
    };
  }
}
