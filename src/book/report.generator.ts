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
  weeklyStats?: {
    budgetComplianceRate?: number;
    biggestCategory?: string;
    savedCategory?: string;
  };
}

@Injectable()
export class ReportGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateDetailedReport(
    profile: any,
    configMap: Record<string, string>,
  ): Promise<DetailedReportResult> {
    const prompt = `너는 머니런의 AI 재무 분석가야. 유저의 재무 데이터를 바탕으로 상세한 분석 리포트를 작성해줘.

## 유저 데이터
- 나이: ${profile.age}세
- 월 실수령액: ${profile.monthlyIncome.toLocaleString()}원
- 월 고정비: ${profile.monthlyFixedCost.toLocaleString()}원
- 월 변동비: ${profile.variableCost.monthly.toLocaleString()}원
- 일 변동비(하루 예산): ${profile.variableCost.daily.toLocaleString()}원
- 등급: ${profile.grade}
- 연평균 수익률: ${profile.expectedReturn}%
- 투자기간: ${profile.investmentYears}년

## 경제 환경
- 서울 평균 월세: ${parseInt(configMap['seoul_avg_rent'] || '0').toLocaleString()}원
- 평균 식비: ${parseInt(configMap['avg_food'] || '0').toLocaleString()}원
- 평균 교통비: ${parseInt(configMap['avg_transport'] || '0').toLocaleString()}원
- 인플레이션율: ${configMap['inflation_rate'] || '0.025'}
- 환율: ${configMap['exchange_rate'] || '정보 없음'}원
- 유가: ${configMap['oil_price'] || '정보 없음'}

## 규칙
1. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마.
2. 친근하지만 전문적인 톤.
3. 확정적인 투자 권유, 특정 종목 추천 절대 금지.
4. JSON으로만 응답.

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
        model: 'claude-sonnet-4-6-20260403',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return this.getFallbackDetailedReport(profile);
    }
  }

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
- 하루 사용 가능: ${profile.variableCost.daily.toLocaleString()}원
- 등급: ${profile.grade}

## 이번 주 페이스메이커 메시지
${messagesContext}

## 규칙
1. 찐친 톤. 반말 사용.
2. 수치는 주어진 데이터만 사용.
3. "이번 주 이렇게 해봐"라는 구체적 가이드.
4. 확정적인 투자 권유 금지.
5. JSON으로만 응답.

## 응답 형식 (JSON만)
{
  "summary": "이번 주 요약 (1문장)",
  "guide": "마크다운 가이드 본문 (300자 이상, 구체적 행동 제안 포함)"
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6-20260403',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        summary: `이번 주는 ${feelingMap[weekStatus.overallFeeling] || '무난했'}어. 다음 주는 더 잘해보자.`,
        guide: `## 이번 주 돌아보기\n\n이번 주 체감: ${feelingMap[weekStatus.overallFeeling] || weekStatus.overallFeeling}\n\n하루에 ${profile.variableCost.daily.toLocaleString()}원 쓸 수 있는데, 다음 주는 좀 더 의식적으로 관리해보자.\n\n### 다음 주 할 일\n\n1. 배달 횟수 줄이기\n2. 점심 도시락 2번 이상\n3. 충동구매 전 24시간 대기`,
      };
    }
  }

  private getFallbackDetailedReport(profile: any): DetailedReportResult {
    const now = new Date();
    const month = now.getMonth() + 1;

    return {
      title: `${month}월 재무 분석 리포트`,
      summary: `변동비 ${profile.variableCost.monthly.toLocaleString()}원, 하루 ${profile.variableCost.daily.toLocaleString()}원 사용 가능`,
      content: `## ${month}월 재무 현황\n\n월 실수령액 ${profile.monthlyIncome.toLocaleString()}원 중 고정비에 ${profile.monthlyFixedCost.toLocaleString()}원을 사용하고 있습니다.\n\n남은 변동비는 월 ${profile.variableCost.monthly.toLocaleString()}원으로, 하루 약 ${profile.variableCost.daily.toLocaleString()}원을 사용할 수 있습니다.\n\n## 등급: ${profile.grade}\n\n현재 변동비 비율은 ${Math.round((profile.variableCost.monthly / profile.monthlyIncome) * 100)}%입니다.`,
      analysis: {
        wellDone: '고정비를 파악하고 관리하고 있는 것이 첫 걸음입니다.',
        improvement: '변동비 대비 저축 비율을 점검해보세요.',
        actionPlan: '이번 달 불필요한 지출 항목을 하나 찾아 줄여보세요.',
      },
    };
  }
}
