import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class QuizService {
  private ai: Anthropic;

  constructor(private readonly supabase: SupabaseService) {
    this.ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /** 유저가 아직 안 푼 퀴즈 10개 배정 (오답 재출제 30% 포함) */
  async getTodayQuizzes(userId: string, count = 10) {
    const result: any[] = [];

    // 1. 오답노트에서 재출제 (30% = 3개)
    const retryCount = Math.ceil(count * 0.3);
    const { data: wrongNotes } = await this.supabase.db
      .from('wrong_notes')
      .select('id, quiz_id, quiz:quizzes (id, question, answer, explanation, source, category)')
      .eq('user_id', userId)
      .limit(retryCount * 2); // 여유있게 가져옴

    const retryQuizzes = (wrongNotes || [])
      .sort(() => Math.random() - 0.5)
      .slice(0, retryCount)
      .map((n: any) => ({
        id: n.quiz?.id,
        question: n.quiz?.question,
        answer: n.quiz?.answer,
        explanation: n.quiz?.explanation,
        source: '오답노트 복습',
        category: n.quiz?.category,
        wrongNoteId: n.id,
      }));

    result.push(...retryQuizzes);
    const retryQuizIds = retryQuizzes.map((q: any) => q.id);

    // 2. 나머지는 안 푼 새 퀴즈
    const remaining = count - result.length;
    if (remaining > 0) {
      const { data: answered } = await this.supabase.db
        .from('quiz_answers')
        .select('quiz_id')
        .eq('user_id', userId);

      const excludeIds = [
        ...(answered || []).map((a: any) => a.quiz_id),
        ...retryQuizIds,
      ].filter(Boolean);

      let query = this.supabase.db
        .from('quizzes')
        .select('id, question, answer, explanation, source, category');

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: newQuizzes } = await query;

      const shuffled = (newQuizzes || []).sort(() => Math.random() - 0.5);
      result.push(...shuffled.slice(0, remaining).map((q: any) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        explanation: q.explanation,
        source: q.source,
        category: q.category,
      })));
    }

    // 전체 셔플
    return result.sort(() => Math.random() - 0.5);
  }

  /** OX 답변 제출 — 틀리면 AI 상세 설명 생성 + 오답노트 저장 */
  async submitAnswer(userId: string, quizId: string, userAnswer: boolean) {
    const { data: quiz, error: quizError } = await this.supabase.db
      .from('quizzes')
      .select('id, question, answer, explanation, source, category')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new NotFoundException('퀴즈를 찾을 수 없습니다.');
    }

    const correct = userAnswer === quiz.answer;

    // 재출제 퀴즈에서 맞추면 오답노트에서 삭제
    if (correct) {
      await this.supabase.db
        .from('wrong_notes')
        .delete()
        .eq('user_id', userId)
        .eq('quiz_id', quizId);
    }

    // 이미 답변했는지 확인 (재출제가 아닌 경우)
    const { data: existing } = await this.supabase.db
      .from('quiz_answers')
      .select('id')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .single();

    if (!existing) {
      await this.supabase.db
        .from('quiz_answers')
        .insert({
          user_id: userId,
          quiz_id: quizId,
          user_answer: userAnswer,
          correct,
        });
    }

    // 틀렸으면 오답노트에 자동 저장 + AI 상세 설명
    let wrongNoteId: string | null = null;
    if (!correct) {
      // 이미 오답노트에 있는지 확인
      const { data: existingNote } = await this.supabase.db
        .from('wrong_notes')
        .select('id')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .single();

      if (!existingNote) {
        const detailedExplanation = await this.generateDetailedExplanation(quiz);

        const { data: wrongNote } = await this.supabase.db
          .from('wrong_notes')
          .insert({
            user_id: userId,
            quiz_id: quizId,
            user_answer: userAnswer,
            detailed_explanation: detailedExplanation,
          })
          .select('id')
          .single();

        wrongNoteId = wrongNote?.id || null;
      }
    }

    return {
      correct,
      explanation: correct
        ? `맞아요! ${quiz.explanation}`
        : `아쉽! ${quiz.explanation}`,
      ...(wrongNoteId ? { wrongNoteId } : {}),
    };
  }

  /** 오답노트 목록 조회 */
  async getWrongNotes(userId: string) {
    const { data, error } = await this.supabase.db
      .from('wrong_notes')
      .select(`
        id,
        user_answer,
        detailed_explanation,
        created_at,
        quiz:quizzes (id, question, answer, explanation, source, category)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`오답노트 조회 실패: ${error.message}`);
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      quizId: n.quiz?.id,
      question: n.quiz?.question,
      correctAnswer: n.quiz?.answer,
      userAnswer: n.user_answer,
      explanation: n.quiz?.explanation,
      detailedExplanation: n.detailed_explanation,
      source: n.quiz?.source,
      category: n.quiz?.category,
      createdAt: n.created_at,
    }));
  }

  /** AI로 상세 설명 생성 */
  private async generateDetailedExplanation(quiz: any): Promise<string> {
    try {
      const response = await this.ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `다음 경제/금융 퀴즈에 대해 초보자가 이해할 수 있도록 상세하게 설명해줘. 마크다운 형식으로, 3~5문장으로 작성해.

퀴즈: "${quiz.question}"
정답: ${quiz.answer ? 'O' : 'X'}
간단 설명: ${quiz.explanation}
카테고리: ${quiz.category}

규칙:
1. 친근한 톤. 반말.
2. 핵심 용어는 **볼드** 처리.
3. 실생활 예시 1개 포함.
4. 마크다운 텍스트만 응답. JSON 아님.`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return text.trim() || quiz.explanation;
    } catch {
      return quiz.explanation;
    }
  }
}
