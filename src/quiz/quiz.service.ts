import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class QuizService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 유저가 아직 안 푼 퀴즈 10개 배정 (오답 재출제 30% 포함) — 정답 미노출 */
  async getTodayQuizzes(userId: string, count = 10) {
    const result: any[] = [];

    // 1. 오답노트에서 재출제 (30% = 3개)
    const retryCount = Math.ceil(count * 0.3);
    const { data: wrongNotes } = await this.supabase.db
      .from('wrong_notes')
      .select('id, quiz_id, quiz:quizzes (id, question, choices, source, category)')
      .eq('user_id', userId)
      .limit(retryCount * 2);

    const retryQuizzes = (wrongNotes || [])
      .sort(() => Math.random() - 0.5)
      .slice(0, retryCount)
      .map((n: any) => ({
        id: n.quiz?.id,
        question: n.quiz?.question,
        choices: n.quiz?.choices,
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
        .select('id, question, choices, source, category');

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: newQuizzes } = await query;

      const shuffled = (newQuizzes || []).sort(() => Math.random() - 0.5);
      result.push(...shuffled.slice(0, remaining).map((q: any) => ({
        id: q.id,
        question: q.question,
        choices: q.choices,
        source: q.source,
        category: q.category,
      })));
    }

    // 전체 셔플 — correct_answer, brief/detailed_explanation 절대 미포함
    return result.sort(() => Math.random() - 0.5);
  }

  /** 객관식 답변 제출 — 정답/오답 모두 간단+상세 설명 반환 */
  async submitAnswer(userId: string, quizId: string, userAnswer: number) {
    const { data: quiz, error: quizError } = await this.supabase.db
      .from('quizzes')
      .select('id, question, choices, correct_answer, brief_explanation, detailed_explanation, source, category')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new NotFoundException('퀴즈를 찾을 수 없습니다.');
    }

    // 보기 범위 검증
    const choiceCount = (quiz.choices as any[]).length;
    if (userAnswer < 1 || userAnswer > choiceCount) {
      throw new BadRequestException(`보기는 1~${choiceCount}번까지입니다.`);
    }

    const correct = userAnswer === quiz.correct_answer;

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

    // 틀렸으면 오답노트에 자동 저장
    let wrongNoteId: string | null = null;
    if (!correct) {
      const { data: existingNote } = await this.supabase.db
        .from('wrong_notes')
        .select('id')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .single();

      if (!existingNote) {
        const { data: wrongNote } = await this.supabase.db
          .from('wrong_notes')
          .insert({
            user_id: userId,
            quiz_id: quizId,
            user_answer: userAnswer,
            detailed_explanation: quiz.detailed_explanation,
          })
          .select('id')
          .single();

        wrongNoteId = wrongNote?.id || null;
      }
    }

    return {
      correct,
      correctAnswer: quiz.correct_answer,
      userAnswer,
      briefExplanation: quiz.brief_explanation,
      detailedExplanation: quiz.detailed_explanation,
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
        created_at,
        quiz:quizzes (id, question, choices, correct_answer, brief_explanation, detailed_explanation, source, category)
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
      choices: n.quiz?.choices,
      correctAnswer: n.quiz?.correct_answer,
      userAnswer: n.user_answer,
      briefExplanation: n.quiz?.brief_explanation,
      detailedExplanation: n.quiz?.detailed_explanation,
      source: n.quiz?.source,
      category: n.quiz?.category,
      createdAt: n.created_at,
    }));
  }
}
