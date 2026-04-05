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

interface MonthlyReportResult {
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
    const f = (n: number) => (Math.floor(n / 1000) * 1000).toLocaleString();

    const prompt = `너는 머니런의 AI 재무 분석가야. 유저의 재무 데이터를 바탕으로 시뮬레이터 분석 리포트를 작성해줘.

## 유저 데이터
- 나이: ${profile.age}세
- 은퇴 예정 나이: ${profile.retirementAge}세
- 연금 수령 나이: ${profile.pensionStartAge}세
- 월 실수령액: ${f(profile.monthlyIncome)}원
- 월 고정비: ${f(profile.monthlyFixedCost)}원
- 월 변동비: ${f(profile.monthlyVariableCost || 0)}원
- 월 총지출: ${f((profile.monthlyFixedCost || 0) + (profile.monthlyVariableCost || 0))}원
- 잉여자금(월): ${f(profile.surplus || profile.variableCost?.monthly || 0)}원
- 잉여자금(일): ${f(profile.variableCost?.daily || 0)}원
- 등급: ${profile.grade}

## 경제 환경
- 서울 평균 월세: ${f(parseInt(configMap['seoul_avg_rent'] || '0'))}원
- 평균 식비: ${f(parseInt(configMap['avg_food'] || '0'))}원
- 인플레이션율: ${configMap['inflation_rate'] || '0.025'}
- 환율: ${configMap['exchange_rate'] || '정보 없음'}원

## 규칙
1. 수치는 내가 준 데이터만 사용. 새로운 수치를 만들지 마. 금액은 천원 단위까지만.
2. 친근하지만 전문적인 톤.
3. 확정적인 투자 권유, 특정 종목 추천 절대 금지.
4. summary는 시뮬레이션 결과 기반 한줄 요약. 예: "잉여자금 월 50만 원, 하루 16,000원 사용 가능"
5. JSON으로만 응답.

## 응답 형식 (JSON만)
{
  "title": "시뮬레이터 분석 리포트",
  "summary": "시뮬레이션 결과 기반 한줄 요약",
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
    messages: any[],
  ): Promise<MonthlyReportResult> {
    const feelingMap: Record<string, string> = {
      good: '잘 보냈다',
      okay: '무난했다',
      tight: '빠듯했다',
      bad: '힘들었다',
    };

    const messagesContext = messages.length > 0
      ? messages.map((m: any) => `- ${m.date}: ${m.message}`).join('\n')
      : '이번 달 메시지 없음';

    const prompt = `너는 머니런 페이스메이커야. 유저의 이번 달 상태를 보고 월간 가이드를 만들어줘.

## 유저 이번 달 상태
- 체감: "${feelingMap[weekStatus.overallFeeling] || weekStatus.overallFeeling}"
- 메모: "${weekStatus.memo || '없음'}"

## 유저 재무 데이터
- 월 실수령액: ${(Math.floor(profile.monthlyIncome / 1000) * 1000).toLocaleString()}원
- 하루 사용 가능: ${(Math.floor((profile.variableCost?.daily || 0) / 1000) * 1000).toLocaleString()}원
- 등급: ${profile.grade}

## 이번 달 페이스메이커 메시지
${messagesContext}

## 규칙
1. 찐친 톤. 반말 사용.
2. 수치는 주어진 데이터만 사용. 금액은 천원 단위까지만.
3. "이번 달 이렇게 해봐"라는 구체적 가이드.
4. 확정적인 투자 권유 금지.
5. JSON으로만 응답.

## 응답 형식 (JSON만)
{
  "summary": "이번 달 요약 (1문장)",
  "guide": "마크다운 가이드 본문 (300자 이상, 구체적 행동 제안 포함)"
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        summary: `이번 달은 ${feelingMap[weekStatus.overallFeeling] || '무난했'}어. 다음 달은 더 잘해보자.`,
        guide: `## 이번 달 돌아보기\n\n체감: ${feelingMap[weekStatus.overallFeeling] || weekStatus.overallFeeling}\n\n하루에 ${(Math.floor((profile.variableCost?.daily || 0) / 1000) * 1000).toLocaleString()}원 쓸 수 있는데, 다음 달은 좀 더 의식적으로 관리해보자.\n\n### 다음 달 할 일\n\n1. 배달 횟수 줄이기\n2. 점심 도시락 2번 이상\n3. 충동구매 전 24시간 대기`,
      };
    }
  }

  private getFallbackDetailedReport(profile: any): DetailedReportResult {
    const f = (n: number) => (Math.floor(n / 1000) * 1000).toLocaleString();
    const surplus = profile.surplus || profile.variableCost?.monthly || 0;
    const daily = profile.variableCost?.daily || 0;

    return {
      title: '시뮬레이터 분석 리포트',
      summary: `잉여자금 월 ${f(surplus)}원, 하루 ${f(daily)}원 사용 가능`,
      content: `## 재무 현황\n\n월 실수령액 ${f(profile.monthlyIncome)}원 중 고정비 ${f(profile.monthlyFixedCost)}원, 변동비 ${f(profile.monthlyVariableCost || 0)}원을 사용하고 있습니다.\n\n남은 잉여자금은 월 ${f(surplus)}원으로, 하루 약 ${f(daily)}원을 사용할 수 있습니다.\n\n## 등급: ${profile.grade}\n\n현재 총지출 대비 소득 비율을 기준으로 판정되었습니다.`,
      analysis: {
        wellDone: '재무 현황을 파악하고 관리하기 시작한 것이 첫 걸음입니다.',
        improvement: '변동비 대비 저축 비율을 점검해보세요.',
        actionPlan: '이번 달 불필요한 지출 항목을 하나 찾아 줄여보세요.',
      },
    };
  }
}
