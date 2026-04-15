import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class CourseBookGenerator {
  private anthropic: Anthropic;

  constructor(private readonly supabase: SupabaseService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /** 진행 상태 DB 업데이트 */
  private async updateProgress(
    purchaseId: string,
    step: string,
    percent: number,
    chaptersDone: number,
    totalChapters: number,
  ) {
    await this.supabase.db
      .from('user_purchases')
      .update({
        generation_progress: {
          step,
          percent,
          chaptersDone,
          totalChapters,
          updatedAt: new Date().toISOString(),
        },
      })
      .eq('id', purchaseId);
  }

  /** 코스 마이북 + 미션 비동기 생성 */
  async generateCourseBook(
    purchaseId: string,
    userId: string,
    courseId: string,
    financeData: Record<string, any>,
    courseExtraData: Record<string, any>,
    diagnosticAnswers: any[],
    onboardingProgressId?: string,
  ) {
    console.log(`[코스북] AI 생성 시작 (purchaseId=${purchaseId})`);

    try {
      // 1. 코스 정보 조회
      const { data: course, error: courseError } = await this.supabase.db
        .from('courses')
        .select('id, category, level, title, description, chapter_count')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new Error('코스를 찾을 수 없습니다.');
      }

      const chapterCount = course.chapter_count || 5;

      // 2. 목차 생성 (10%)
      await this.updateProgress(purchaseId, '목차 구성 중', 10, 0, chapterCount);

      const outlinePrompt = this.buildOutlinePrompt(course, financeData, courseExtraData);
      const outlineResponse = await this.callClaude(outlinePrompt);
      let outline: { chapters: Array<{ title: string; focus: string }> };

      try {
        outline = JSON.parse(outlineResponse);
      } catch {
        outline = {
          chapters: Array.from({ length: chapterCount }, (_, i) => ({
            title: `${i + 1}장`,
            focus: `${course.category} ${course.level} 과정 ${i + 1}장`,
          })),
        };
      }

      // 3. 챕터별 콘텐츠 + 미션 병렬 생성
      const chapters = outline.chapters.slice(0, chapterCount);
      const personalizedChapters: any[] = new Array(chapters.length);

      // 2개씩 병렬로 생성 (API 부하 분산)
      for (let batch = 0; batch < chapters.length; batch += 2) {
        const batchChapters = chapters.slice(batch, batch + 2);
        const batchPromises = batchChapters.map(async (chapter, batchIdx) => {
          const i = batch + batchIdx;
          const chapterNum = i + 1;

          console.log(`[코스북] 챕터 ${chapterNum} 생성 중: ${chapter.title}`);

          // 콘텐츠 + 미션 동시 생성
          const [content, missionResponse] = await Promise.all([
            this.callClaude(this.buildChapterPrompt(course, chapter, chapterNum, financeData, courseExtraData)),
            this.callClaude(this.buildMissionPrompt(course, chapter, chapterNum, financeData)),
          ]);

          personalizedChapters[i] = {
            chapterIndex: i,
            chapterOrder: chapterNum,
            title: chapter.title,
            content,
          };

          // 미션 파싱 + DB 저장
          let missions: Array<{ type: string; title: string; description: string }>;
          try {
            missions = JSON.parse(missionResponse);
          } catch {
            missions = [
              { type: 'read', title: `${chapter.title} 핵심 내용 복습하기`, description: `${chapterNum}장의 핵심 내용을 다시 읽고 정리해보세요.` },
              { type: 'action', title: `${chapter.title} 실천하기`, description: `${chapterNum}장에서 배운 내용을 실제로 적용해보세요.` },
            ];
          }

          for (let j = 0; j < missions.length; j++) {
            const m = missions[j];
            await this.supabase.db
              .from('course_missions')
              .upsert({
                course_id: courseId,
                chapter_number: chapterNum,
                mission_order: j + 1,
                type: m.type || 'action',
                title: m.title,
                description: m.description,
              }, { onConflict: 'course_id,chapter_number,mission_order' });
          }
        });

        await Promise.all(batchPromises);

        // 배치 완료 후 진행률 업데이트
        const done = Math.min(batch + 2, chapters.length);
        const percent = Math.round(10 + (done / chapters.length) * 85);
        await this.updateProgress(purchaseId, `챕터 ${done}/${chapters.length} 생성 완료`, percent, done, chapters.length);
      }

      // 4. 완료
      const now = new Date().toISOString();
      await this.supabase.db
        .from('user_purchases')
        .update({
          personalized_chapters: personalizedChapters,
          status: 'completed',
          completed_at: now,
          generation_progress: {
            step: '완료',
            percent: 100,
            chaptersDone: chapters.length,
            totalChapters: chapters.length,
            updatedAt: now,
          },
        })
        .eq('id', purchaseId);

      // 5. onboarding_progress 업데이트 (온보딩 경유 시에만)
      if (onboardingProgressId) {
        await this.supabase.db
          .from('onboarding_progress')
          .update({
            generation_status: 'completed',
            updated_at: now,
          })
          .eq('id', onboardingProgressId);
      }

      console.log(`[코스북] AI 생성 완료 (purchaseId=${purchaseId}, ${chapters.length}챕터)`);
    } catch (err) {
      console.error(`[코스북] AI 생성 실패:`, err);

      await this.supabase.db
        .from('user_purchases')
        .update({
          status: 'failed',
          generation_progress: {
            step: '생성 실패',
            percent: 0,
            chaptersDone: 0,
            totalChapters: 0,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('id', purchaseId);

      if (onboardingProgressId) {
        await this.supabase.db
          .from('onboarding_progress')
          .update({
            generation_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', onboardingProgressId);
      }
    }
  }

  private buildOutlinePrompt(
    course: any,
    financeData: Record<string, any>,
    courseExtraData: Record<string, any>,
  ): string {
    return `당신은 금융 교육 전문가입니다. 아래 유저 정보와 코스를 기반으로 개인화된 책의 목차를 구성해주세요.

## 코스 정보
- 카테고리: ${course.category}
- 레벨: ${course.level}
- 제목: ${course.title}
- 설명: ${course.description}

## 유저 재무 데이터
${JSON.stringify(financeData, null, 2)}

## 코스별 추가 데이터
${JSON.stringify(courseExtraData || {}, null, 2)}

## 요구사항
- ${course.chapter_count || 5}개 챕터로 구성
- 각 챕터에 title과 focus(핵심 주제) 포함
- 유저의 재무 상황에 맞는 실용적인 구성
- 레벨(${course.level})에 맞는 난이도

## 응답 형식 (JSON만 출력)
{"chapters":[{"title":"챕터 제목","focus":"이 챕터의 핵심 주제 한 줄 설명"}]}`;
  }

  private buildChapterPrompt(
    course: any,
    chapter: { title: string; focus: string },
    chapterNumber: number,
    financeData: Record<string, any>,
    courseExtraData: Record<string, any>,
  ): string {
    const nickname = financeData.nickname || '유저';
    return `당신은 ${nickname}님만을 위한 금융 교육 콘텐츠를 작성하는 전문가입니다.

## 코스: ${course.title} (${course.level})
## 챕터 ${chapterNumber}: ${chapter.title}
## 핵심 주제: ${chapter.focus}

## ${nickname}님의 재무 데이터
- 나이: ${financeData.age}세
- 월 실수령액: ${financeData.monthlyIncome?.toLocaleString()}원
- 월 투자액: ${financeData.monthlyInvestment?.toLocaleString()}원
- 월 고정비: ${financeData.monthlyFixedCost?.toLocaleString()}원
- 월 변동비: ${financeData.monthlyVariableCost?.toLocaleString()}원
- 은퇴 예정 나이: ${financeData.retirementAge}세
${courseExtraData ? `\n## 추가 데이터\n${JSON.stringify(courseExtraData, null, 2)}` : ''}

## 작성 규칙
1. ${nickname}님의 실제 수치를 반영하여 구체적으로 작성
2. AI가 수치를 만들지 않음 — 유저 데이터 직접 사용, 분석/서술만
3. 마크다운 형식으로 작성 (## 소제목, **강조**, 목록 등)
4. 2000~3000자 분량
5. 레벨(${course.level})에 맞는 난이도와 설명 깊이
6. 금지: 특정 종목 추천, 확정 수익 보장, "반드시/무조건"
7. 마지막에 "⚠️ 본 콘텐츠는 정보 제공 목적이며, 투자 권유가 아닙니다." 면책 삽입

콘텐츠만 출력하세요 (JSON 아님, 마크다운 텍스트).`;
  }

  private buildMissionPrompt(
    course: any,
    chapter: { title: string; focus: string },
    chapterNumber: number,
    financeData: Record<string, any>,
  ): string {
    return `금융 교육 미션을 생성해주세요.

## 코스: ${course.title} (${course.level})
## 챕터 ${chapterNumber}: ${chapter.title} — ${chapter.focus}
## 유저 나이: ${financeData.age}세, 월 수입: ${financeData.monthlyIncome?.toLocaleString()}원

## 요구사항
- 2~3개 미션 생성
- 미션 유형: action(실제 행동), read(읽기/학습), calculate(계산/시뮬레이션)
- 유저가 실제로 수행할 수 있는 구체적인 미션
- 이 챕터의 핵심 내용과 직접 관련

## 응답 형식 (JSON 배열만 출력)
[{"type":"action","title":"미션 제목","description":"미션 상세 설명"}]`;
  }

  private async callClaude(prompt: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
