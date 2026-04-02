import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface MessageContext {
  profile: {
    age: number;
    monthlyIncome: number;
    grade: string;
    goodSpendings: any[];
    goodSpendingTotal: number;
    fixedExpenses: any;
    fixedExpenseTotal: number;
    surplus: { monthly: number; weekly: number; daily: number };
  };
  configMap: Record<string, string>;
  latestReport: any;
  latestWeekly: any;
  recentScraps: any[];
  learnContents: any[];
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
    const { profile, configMap, latestReport, latestWeekly, recentScraps, learnContents, today, dayOfWeek } = context;

    const prompt = this.buildPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseResponse(text, learnContents);
    } catch (error) {
      // AI 실패 시 기본 메시지 반환
      return this.getFallbackMessage(profile, dayOfWeek, learnContents);
    }
  }

  private buildPrompt(context: MessageContext): string {
    const { profile, configMap, latestReport, latestWeekly, recentScraps, today, dayOfWeek } = context;

    const toneGuide = {
      RED: '직접적이고 유머러스하게. "야 진짜 이러면 안 된다 ㅋㅋ" 스타일.',
      YELLOW: '은근히 찌르는 톤. "하고 있긴 한데... 좀 더 해야 하지 않아?" 스타일.',
      GREEN: '격려하면서 다음 단계 제안. "오 잘하고 있네! 이것도 해볼래?" 스타일.',
    };

    let contextInfo = '';
    if (latestReport) {
      contextInfo += `\n최근 상세 리포트: "${latestReport.title}" - ${latestReport.summary || ''}`;
    }
    if (latestWeekly) {
      contextInfo += `\n최근 주간 리포트: ${latestWeekly.summary || ''}`;
    }
    if (recentScraps.length > 0) {
      const scrapTitles = recentScraps
        .map((s: any) => s.learn_contents?.title)
        .filter(Boolean)
        .join(', ');
      if (scrapTitles) {
        contextInfo += `\n유저가 스크랩한 콘텐츠: ${scrapTitles}`;
      }
    }

    return `너는 "머니런 페이스메이커"야. 유저의 찐친(진짜 친한 친구)처럼 돈 관리를 잔소리해주는 역할이야.

## 유저 데이터
- 나이: ${profile.age}세
- 월 실수령액: ${profile.monthlyIncome.toLocaleString()}원
- 좋은 소비(저축/투자): 월 ${profile.goodSpendingTotal.toLocaleString()}원
- 고정 소비: 월 ${profile.fixedExpenseTotal.toLocaleString()}원
- 잉여자금: 월 ${profile.surplus.monthly.toLocaleString()}원 / 하루 ${profile.surplus.daily.toLocaleString()}원
- 등급: ${profile.grade}
${contextInfo}

## 참고 데이터
- 서울 평균 월세: ${parseInt(configMap['seoul_avg_rent'] || '0').toLocaleString()}원
- 평균 식비: ${parseInt(configMap['avg_food'] || '0').toLocaleString()}원
- 오늘: ${today} (${dayOfWeek})

## 톤 가이드
${toneGuide[profile.grade as keyof typeof toneGuide] || toneGuide.YELLOW}

## 규칙
1. 반말 사용. 찐친처럼 자연스럽게.
2. 메시지는 2-3문장. 짧고 임팩트 있게.
3. 반드시 행동 유도로 끝내기 ("이거 해봐", "이거 읽어봐", "이거 생각해봐").
4. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마.
5. JSON으로만 응답해.

## 응답 형식 (JSON만)
{
  "message": "오늘의 한마디 메시지"
}`;
  }

  private parseResponse(
    text: string,
    learnContents: any[],
  ): GeneratedMessage {
    try {
      // JSON 블록 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');

      const parsed = JSON.parse(jsonMatch[0]);

      // 추천 행동: 등급에 맞는 학습 콘텐츠에서 1개 선택
      const actions: GeneratedMessage['actions'] = [];
      if (learnContents.length > 0) {
        const randomContent =
          learnContents[Math.floor(Math.random() * learnContents.length)];
        actions.push({
          type: 'learn_content',
          id: randomContent.id,
          title: randomContent.title,
          label: '이거 읽어봐 →',
        });
      }

      return {
        message: parsed.message,
        actions,
      };
    } catch {
      return this.getFallbackMessage(
        { surplus: { daily: 0 }, grade: 'YELLOW' } as any,
        '',
        learnContents,
      );
    }
  }

  private getFallbackMessage(
    profile: any,
    dayOfWeek: string,
    learnContents: any[],
  ): GeneratedMessage {
    const dailyStr = profile.surplus?.daily
      ? `${profile.surplus.daily.toLocaleString()}원`
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
