import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { MonthlyReportData } from './monthly-report.collector';

/**
 * 월간 리포트 v2 — AI narrative 생성기
 * 상세리포트 v6 패턴과 동일: 서버가 모든 수치 계산 → AI는 narrative만 생성
 */

export interface MonthlyNarratives {
  spending: string;
  proposals: string;
  goals: string;
  learning: string;
  rewards: string;
}

const PROHIBITED_PATTERNS = [
  /반드시.*투자/g,
  /무조건.*수익/g,
  /확실.*보장/g,
  /원금.*보장/g,
  /손실.*없/g,
];

function filterProhibited(text: string): string {
  let filtered = text;
  for (const pattern of PROHIBITED_PATTERNS) {
    filtered = filtered.replace(pattern, '[표현 수정됨]');
  }
  return filtered;
}

@Injectable()
export class MonthlyReportGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateNarratives(
    data: MonthlyReportData,
    userInput: { overallFeeling: string; memo?: string },
  ): Promise<MonthlyNarratives> {
    const feelingMap: Record<string, string> = {
      good: '잘 보냈다',
      okay: '무난했다',
      tight: '빠듯했다',
      bad: '힘들었다',
    };

    const f = (n: number) => n.toLocaleString();

    const prompt = `너는 머니런 월간 리포트 작성자야. 유저의 이번 달 데이터를 보고 5개 섹션의 narrative를 작성해줘.

## 유저 정보
- 닉네임: ${data.nickname}
- 등급: ${data.grade}
- 월: ${data.month}
- 이번 달 체감: "${feelingMap[userInput.overallFeeling] || userInput.overallFeeling}"
- 메모: "${userInput.memo || '없음'}"

## [섹션1] 소비 데이터 (spending)
- 고정비: ${f(data.spending.fixedCost)}원 (${data.spending.fixedRatio}%)
- 변동비: ${f(data.spending.variableCost)}원 (${data.spending.variableRatio}%)
- 잉여자금: ${f(data.spending.surplus)}원 (${data.spending.surplusRatio}%)
- 이번달 총 지출: ${f(data.spending.totalSpent)}원
- 기록일수: ${data.spending.daysTracked}일
- 절약일: ${data.spending.daysUnder}일 / 초과일: ${data.spending.daysOver}일
- 무지출일: ${data.spending.noSpendDays}일
- 예산 소진율: ${data.spending.spentRate}%
- 최대 연속 절약: ${data.spending.bestStreak}일
${data.spending.prevTotalSpent !== null ? `- 전월 지출: ${f(data.spending.prevTotalSpent!)}원 (변화율: ${data.spending.spendingChangeRate}%)` : '- 전월 데이터: 첫 달'}
${data.spending.prevSavings !== null ? `- 전월 저축: ${f(data.spending.prevSavings!)}원 (변화율: ${data.spending.savingsChangeRate}%)` : ''}
- 다음달 예상 하루 생활비: ${f(data.spending.nextDailyBudget)}원
- 다음달 예상 등급: ${data.spending.nextGrade}
- 또래(${data.spending.peerAgeGroup}) 비교: 상위 ${data.spending.peerPercentile ?? '??'}%

## [섹션2] 제안 이행 (proposals)
- 상세리포트 제안 총 ${data.proposals.items.length}개
${data.proposals.items.map(i => `  - "${i.title}" → ${i.checked === true ? '✅ 달성' : i.checked === false ? '❌ 미달성' : '⬜ 미체크'}`).join('\n')}
- 이행률: ${data.proposals.completionRate}%
- 페이스메이커 액션: ${data.proposals.pacemakerActionCompleted}/${data.proposals.pacemakerActionTotal}개 완료 (${data.proposals.pacemakerActionRate}%)

## [섹션3] 배지 현황 (goals/badges)
${data.badges.map(b => `- ${b.icon} ${b.name}: ${b.earned ? '✅ 달성' : '⬜ 미달성'} (${b.progress})`).join('\n')}

## [섹션4] 학습 데이터 (learning)
- FQ(금융지수): ${data.learning.fqScore}점
${data.learning.fqChange !== null ? `- 전월 대비: ${data.learning.fqChange > 0 ? '+' : ''}${data.learning.fqChange}점` : '- 첫 달 기록'}
- 퀴즈: ${data.learning.totalQuizzes}개 풀이 / 정답 ${data.learning.correctCount}개 (${data.learning.correctRate}%)
- 학습시간: 약 ${data.learning.totalStudyMinutes}분
- 주요 학습 주제: ${data.learning.topCategories.join(', ') || '없음'}
- 오답노트: ${data.learning.wrongNotes.length}개 남음

## 작성 규칙
1. **찐친 톤, 반말 사용**. 따뜻하지만 날카로운 피드백.
2. **수치는 위 데이터만 사용**. 절대 수치를 만들어내지 마.
3. **금액은 천원 단위**까지만 표시.
4. 확정적인 투자 권유 절대 금지.
5. 각 섹션 200~400자.
6. 마크다운 형식 (##, -, ** 등 사용).
7. JSON으로만 응답.

## 섹션별 톤 가이드
- **spending**: 이번달 소비를 냉정하게 돌아보되, 잘한 점 인정. 전월 비교가 있으면 변화 강조. 또래 비교로 동기부여. "한달 한달의 소비행동이 인생을 바꾼다" 뉘앙스.
- **proposals**: 지킨 것은 칭찬 + 기회비용 환산("이 절약이 N년 후 얼마가 된다"). 못 지킨 것은 아쉬움 + 기회비용("이걸 줄였으면 N원 더 모았을 텐데").
- **goals**: 다음 달 구체적 챌린지 1개 제시 + 달성 시 효과. 배지 진행 상황 언급.
- **learning**: 배운 내용이 실제 경제 뉴스나 생활에서 어떻게 도움되는지 연결. FQ 변화 강조.
- **rewards**: 달성한 배지 축하. 미달성 배지는 "조금만 더 하면" 응원. 오답 키트 활용 유도.

## 응답 형식 (JSON만)
{
  "spending": "마크다운 narrative",
  "proposals": "마크다운 narrative",
  "goals": "마크다운 narrative",
  "learning": "마크다운 narrative",
  "rewards": "마크다운 narrative"
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found in AI response');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        spending: filterProhibited(parsed.spending || ''),
        proposals: filterProhibited(parsed.proposals || ''),
        goals: filterProhibited(parsed.goals || ''),
        learning: filterProhibited(parsed.learning || ''),
        rewards: filterProhibited(parsed.rewards || ''),
      };
    } catch (err) {
      console.error('[월간리포트] AI narrative 생성 실패, fallback 사용:', err);
      return this.getFallbackNarratives(data);
    }
  }

  private getFallbackNarratives(data: MonthlyReportData): MonthlyNarratives {
    const name = data.nickname;
    const f = (n: number) => n.toLocaleString();

    return {
      spending: `## 이번 달 소비 돌아보기\n\n${name}아, 이번 달 총 ${f(data.spending.totalSpent)}원 썼어. 절약한 날이 ${data.spending.daysUnder}일이나 돼. ${data.spending.peerPercentile ? `같은 ${data.spending.peerAgeGroup} 중에서 상위 ${data.spending.peerPercentile}%야!` : ''}\n\n하루 적정 생활비는 ${f(data.spending.dailyBudget)}원이었는데, 다음 달은 ${f(data.spending.nextDailyBudget)}원으로 조정해볼까?`,
      proposals: `## 제안 이행 체크\n\n이번 달 이행률 ${data.proposals.completionRate}%. ${data.proposals.completionRate >= 50 ? '절반 이상 해냈어, 대단해!' : '다음 달은 하나라도 더 해보자!'}\n\n페이스메이커 액션은 ${data.proposals.pacemakerActionCompleted}/${data.proposals.pacemakerActionTotal}개 완료했어.`,
      goals: `## 다음 달 목표\n\n이번 달 패턴을 보면, 다음 달은 변동비를 조금 더 줄여서 잉여자금을 늘려볼 수 있어.\n\n### 이번 달 배지 현황\n${data.badges.filter(b => b.earned).map(b => `- ${b.icon} ${b.name} 달성!`).join('\n') || '- 아직 달성한 배지가 없어. 다음 달 도전해보자!'}`,
      learning: `## 이번 달 학습\n\nFQ 점수: ${data.learning.fqScore}점. 퀴즈 ${data.learning.totalQuizzes}개를 풀었고 정답률 ${data.learning.correctRate}%야.\n\n${data.learning.topCategories.length > 0 ? `주로 ${data.learning.topCategories.join(', ')} 분야를 공부했어.` : '다음 달은 퀴즈를 풀어보자!'}`,
      rewards: `## 배지 & 보상\n\n${data.badges.filter(b => b.earned).length > 0 ? `축하해! ${data.badges.filter(b => b.earned).map(b => `${b.icon} ${b.name}`).join(', ')}를 달성했어!` : '아직 달성한 배지가 없지만 다음 달 도전해보자!'}\n\n${data.learning.wrongNotes.length > 0 ? `오답 ${data.learning.wrongNotes.length}개가 남아있어. 복습하면 '완전 정복' 배지를 받을 수 있어!` : ''}`,
    };
  }
}
