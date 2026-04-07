import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ReportCalculator } from './report-calculator';
import { DetailedReportV6, ReportSection, PeerData, UserSnapshot } from './report.types';
import { buildSystemPrompt, buildUserPrompt, filterProhibited, DISCLAIMER } from './report-prompts';

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

  constructor(private readonly calculator: ReportCalculator) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ========== v6 상세 리포트 ==========

  async generateDetailedReportV6(
    profile: any,
    configMap: Record<string, string>,
    peer: PeerData,
  ): Promise<DetailedReportV6> {
    console.log('[리포트] generateDetailedReportV6 시작');

    // 1. 서버 계산 — 모든 수치
    console.log('[리포트] 섹션 계산 시작...');
    const sections: ReportSection[] = [
      this.calculator.calculateSectionA(profile, peer),
      this.calculator.calculateSectionB(profile, peer),
      this.calculator.calculateSectionC(profile, configMap),
      this.calculator.calculateSectionD(configMap, profile),
      this.calculator.calculateSectionE(profile),
      this.calculator.calculateSectionF(profile, configMap),
      this.calculator.calculateSectionG(profile, configMap),
      this.calculator.calculateSectionH(),
      this.calculator.calculateSectionI(profile),
    ];

    // 2. 유저 스냅샷
    const user: UserSnapshot = {
      nickname: profile.nickname || '유저',
      age: profile.age || 30,
      retirementAge: profile.retirementAge || 55,
      pensionStartAge: profile.pensionStartAge || 65,
      monthlyIncome: profile.monthlyIncome,
      monthlyFixedCost: profile.monthlyFixedCost || 0,
      monthlyVariableCost: profile.monthlyVariableCost || 0,
      monthlyExpense: (profile.monthlyFixedCost || 0) + (profile.monthlyVariableCost || 0),
      surplus: profile.monthlyIncome - (profile.monthlyFixedCost || 0) - (profile.monthlyVariableCost || 0),
      expenseRatio: ((profile.monthlyFixedCost || 0) + (profile.monthlyVariableCost || 0)) / profile.monthlyIncome,
      grade: profile.grade || 'RED',
      investmentPeriod: (profile.retirementAge || 55) - (profile.age || 30),
      vestingPeriod: (profile.pensionStartAge || 65) - (profile.retirementAge || 55),
    };

    console.log('[리포트] 섹션 계산 완료. AI 호출 시작...');

    // 3. AI 호출 — ai_narrative만 생성
    const narratives = await this.generateNarratives(user, sections);

    // 4. merge + 후처리
    for (const section of sections) {
      const narrative = narratives.find(n => n.section === section.section);
      if (narrative) {
        section.ai_narrative = filterProhibited(narrative.ai_narrative);
      }
    }

    // 5. summary 생성
    const surplus = user.surplus;
    const daily = Math.floor(surplus / 30);
    const f = (n: number) => (Math.floor(n / 1000) * 1000).toLocaleString();

    return {
      summary: `잉여자금 월 ${f(surplus)}원, 하루 ${f(daily)}원 사용 가능. 등급 ${user.grade}.`,
      sections,
      disclaimer: DISCLAIMER,
    };
  }

  private async generateNarratives(
    user: UserSnapshot,
    sections: ReportSection[],
  ): Promise<{ section: string; ai_narrative: string }[]> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildUserPrompt(user, sections) }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('[리포트] AI 응답 길이:', text.length, '자');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[리포트] AI 응답에서 JSON 배열 못 찾음. 응답 앞 200자:', text.substring(0, 200));
        throw new Error('JSON array not found');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[리포트] AI narrative 파싱 완료 -', parsed.length, '개 섹션');
      return parsed;
    } catch (err) {
      console.error('[리포트] AI 호출/파싱 실패, fallback 사용:', err);
      // AI 실패 시 기본 텍스트
      return this.getFallbackNarratives(user);
    }
  }

  private getFallbackNarratives(user: UserSnapshot): { section: string; ai_narrative: string }[] {
    const name = user.nickname;
    return [
      { section: 'A', ai_narrative: `${name}아, 100점 만점에 재무 건강 점수를 매겨봤어. 또래와 비교해서 어떤 부분이 강하고 약한지 확인해봐.` },
      { section: 'B', ai_narrative: `소득이 어디로 흘러가는지 한눈에 볼 수 있어. 또래 평균이랑 비교하면 어디를 줄일 수 있을지 감이 올 거야.` },
      { section: 'C', ai_narrative: `지금 속도로 모으면 은퇴할 때 얼마나 모이는지, 생애 이벤트까지 고려하면 실질적으로 얼마가 남는지 계산해봤어.` },
      { section: 'D', ai_narrative: `한국은 저축은 많이 하지만 부채도 많고, 연금도 부족한 구조야. 그래서 스스로 준비하는 게 중요해.` },
      { section: 'E', ai_narrative: `현재 등급에서 다음 등급으로 가려면 구체적으로 얼마를 줄여야 하는지 정리했어. 단계적으로 가보자.` },
      { section: 'F', ai_narrative: `작은 절약이 10년 후에 큰 차이를 만들어. 고정비랑 변동비에서 줄일 수 있는 방법을 정리했어.` },
      { section: 'G', ai_narrative: `지금 등급에 맞는 금융 지식을 정리했어. 하나씩 알아가면 돼.` },
      { section: 'H', ai_narrative: `매달 하나씩만 체크하면 1년이면 재무 습관이 완전히 달라져.` },
      { section: 'I', ai_narrative: `여기까지 읽어줘서 고마워. 모르는 용어가 있으면 여기서 찾아봐!` },
    ];
  }

  // ========== 월간 리포트 (기존 유지) ==========

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
}
