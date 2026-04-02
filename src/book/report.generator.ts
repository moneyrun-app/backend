import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface DetailedReportResult {
  title: string;
  summary: string;
  content: string;
  analysis: {
    wellDone: string;
    improvement: string;
    actionPlan: string;
  };
}

interface WeeklyReportResult {
  summary: string;
  guide: string;
}

@Injectable()
export class ReportGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ========== 상세 리포트 ==========

  async generateDetailedReport(
    profile: any,
    configMap: Record<string, string>,
  ): Promise<DetailedReportResult> {
    const prompt = `너는 머니런의 AI 재무 분석가야. 유저의 재무 데이터를 바탕으로 상세한 분석 리포트를 작성해줘.

## 유저 데이터
- 나이: ${profile.age}세
- 월 실수령액: ${profile.monthlyIncome.toLocaleString()}원
- 등급: ${profile.grade}
- 좋은 소비(저축/투자): 월 ${profile.goodSpendingTotal.toLocaleString()}원
  ${profile.goodSpendings.map((g: any) => `- ${g.label}: ${g.amount.toLocaleString()}원`).join('\n  ')}
- 고정 소비: 월 ${profile.fixedExpenseTotal.toLocaleString()}원
  - 월세: ${profile.fixedExpenses.rent.toLocaleString()}원
  - 관리비+공과금: ${profile.fixedExpenses.utilities.toLocaleString()}원
  - 통신비: ${profile.fixedExpenses.phone.toLocaleString()}원
- 잉여자금: 월 ${profile.surplus.monthly.toLocaleString()}원 / 하루 ${profile.surplus.daily.toLocaleString()}원

## 서울 평균 참고
- 평균 월세: ${parseInt(configMap['seoul_avg_rent'] || '0').toLocaleString()}원
- 평균 식비: ${parseInt(configMap['avg_food'] || '0').toLocaleString()}원
- 평균 교통비: ${parseInt(configMap['avg_transport'] || '0').toLocaleString()}원

## 규칙
1. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마.
2. 친근하지만 전문적인 톤.
3. JSON으로만 응답.

## 응답 형식 (JSON만)
{
  "title": "리포트 제목 (예: 4월 재무 분석 리포트)",
  "summary": "1-2줄 요약",
  "content": "마크다운 본문 (상세 분석, 500자 이상)",
  "analysis": {
    "wellDone": "잘하고 있는 점 (1-2문장)",
    "improvement": "개선할 점 (1-2문장)",
    "actionPlan": "구체적 행동 제안 (1-2문장)"
  }
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');

      return JSON.parse(jsonMatch[0]);
    } catch {
      return this.getFallbackDetailedReport(profile);
    }
  }

  // ========== 주간 리포트 ==========

  async generateWeeklyReport(
    profile: any,
    configMap: Record<string, string>,
    weekStatus: { overallFeeling: string; memo?: string },
    weekMessages: any[],
  ): Promise<WeeklyReportResult> {
    const feelingMap: Record<string, string> = {
      good: '잘 보냈다',
      okay: '무난했다',
      tight: '빠듯했다',
      bad: '힘들었다',
    };

    const messagesContext = weekMessages.length > 0
      ? weekMessages.map((m: any) => `- ${m.date}: ${m.message}`).join('\n')
      : '이번 주 메시지 없음';

    const prompt = `너는 머니런 페이스메이커야. 유저의 이번 주 상태를 보고 한 쪽짜리 가이드를 만들어줘.

## 유저 이번 주 상태
- 체감: "${feelingMap[weekStatus.overallFeeling] || weekStatus.overallFeeling}"
- 메모: "${weekStatus.memo || '없음'}"

## 유저 재무 데이터
- 월 실수령액: ${profile.monthlyIncome.toLocaleString()}원
- 하루 사용 가능: ${profile.surplus.daily.toLocaleString()}원
- 등급: ${profile.grade}

## 이번 주 페이스메이커 메시지
${messagesContext}

## 규칙
1. 찐친 톤. 반말 사용.
2. 수치는 주어진 데이터만 사용.
3. "이번 주 이렇게 해봐"라는 구체적 가이드.
4. JSON으로만 응답.

## 응답 형식 (JSON만)
{
  "summary": "이번 주 요약 (1문장)",
  "guide": "마크다운 가이드 본문 (300자 이상, 구체적 행동 제안 포함)"
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');

      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        summary: `이번 주는 ${feelingMap[weekStatus.overallFeeling] || '무난했'}어. 다음 주는 더 잘해보자.`,
        guide: `## 이번 주 돌아보기\n\n이번 주 체감: ${feelingMap[weekStatus.overallFeeling] || weekStatus.overallFeeling}\n\n하루에 ${profile.surplus.daily.toLocaleString()}원 쓸 수 있는데, 다음 주는 좀 더 의식적으로 관리해보자.\n\n### 다음 주 할 일\n\n1. 배달 횟수 줄이기\n2. 점심 도시락 2번 이상\n3. 충동구매 전 24시간 대기`,
      };
    }
  }

  // ========== 폴백 ==========

  private getFallbackDetailedReport(profile: any): DetailedReportResult {
    const now = new Date();
    const month = now.getMonth() + 1;

    return {
      title: `${month}월 재무 분석 리포트`,
      summary: `잉여자금 ${profile.surplus.monthly.toLocaleString()}원, 하루 ${profile.surplus.daily.toLocaleString()}원 사용 가능`,
      content: `## ${month}월 재무 현황\n\n월 실수령액 ${profile.monthlyIncome.toLocaleString()}원 중 저축/투자에 ${profile.goodSpendingTotal.toLocaleString()}원, 고정 소비에 ${profile.fixedExpenseTotal.toLocaleString()}원을 사용하고 있습니다.\n\n남은 잉여자금은 월 ${profile.surplus.monthly.toLocaleString()}원으로, 하루 약 ${profile.surplus.daily.toLocaleString()}원을 사용할 수 있습니다.`,
      analysis: {
        wellDone:
          profile.goodSpendingTotal > 0
            ? '저축/투자를 하고 있는 것 자체가 좋은 시작입니다.'
            : '고정 소비를 파악하고 있는 것이 첫 걸음입니다.',
        improvement: '잉여자금 대비 저축 비율을 점검해보세요.',
        actionPlan: '이번 달 불필요한 지출 항목을 하나 찾아 줄여보세요.',
      },
    };
  }
}
