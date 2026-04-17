import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class DiagnosticService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 카테고리 이름 → ID */
  private async resolveCategoryId(name: string): Promise<string> {
    const { data, error } = await this.supabase.db
      .from('course_categories')
      .select('id')
      .eq('name', name)
      .single();

    if (error || !data) {
      throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${name}`);
    }
    return data.id;
  }

  /** 카테고리별 진단퀴즈 10문제 조회 (힌트 포함) */
  async getQuestions(category: string) {
    const categoryId = await this.resolveCategoryId(category);

    const { data: questions, error } = await this.supabase.db
      .from('diagnostic_quizzes')
      .select('id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint')
      .eq('course_category_id', categoryId)
      .order('difficulty_weight', { ascending: true })
      .limit(10);

    if (error) {
      throw new Error(`진단퀴즈 조회 실패: ${error.message}`);
    }

    return (questions || []).map((q: any) => ({
      id: q.id,
      question: q.question,
      choices: q.choices,
      hint: q.hint || null,
    }));
  }

  /** 진단퀴즈 답변 채점 + 레벨 배정 + 오답 → wrong_notes 저장
   *  레벨 배정: 가중점수(difficulty_weight) 비율 기준
   *    ≤30% 기초 / ≤70% 심화 / >70% 마스터
   */
  async evaluateAndAssignLevel(
    userId: string,
    category: string,
    answers: Array<{ questionId: string; answer: number }>,
  ) {
    const questionIds = answers.map((a) => a.questionId);
    const { data: questions, error } = await this.supabase.db
      .from('diagnostic_quizzes')
      .select('id, correct_answer, difficulty_weight, brief_explanation, detailed_explanation')
      .in('id', questionIds);

    if (error || !questions || questions.length === 0) {
      throw new BadRequestException('진단퀴즈를 찾을 수 없습니다.');
    }

    const questionMap = new Map(questions.map((q: any) => [q.id, q]));

    let totalWeight = 0;
    let earnedWeight = 0;
    let correctCount = 0;
    const wrongAnswers: Array<{ questionId: string; userAnswer: number; explanation: string | null }> = [];

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) continue;

      totalWeight += question.difficulty_weight;

      if (answer.answer + 1 === question.correct_answer) {
        earnedWeight += question.difficulty_weight;
        correctCount++;
      } else {
        wrongAnswers.push({
          questionId: answer.questionId,
          userAnswer: answer.answer,
          explanation: question.detailed_explanation || question.brief_explanation,
        });
      }
    }

    if (wrongAnswers.length > 0) {
      for (const w of wrongAnswers) {
        const { data: existing } = await this.supabase.db
          .from('wrong_notes')
          .select('id')
          .eq('user_id', userId)
          .eq('diagnostic_quiz_id', w.questionId)
          .maybeSingle();

        if (!existing) {
          await this.supabase.db
            .from('wrong_notes')
            .insert({
              user_id: userId,
              diagnostic_quiz_id: w.questionId,
              user_answer: w.userAnswer,
              detailed_explanation: w.explanation,
            });
        }
      }
    }

    const scoreRatio = totalWeight > 0 ? earnedWeight / totalWeight : 0;

    // 가중점수 비율 기준 레벨 배정
    let assignedLevel: string;
    if (scoreRatio <= 0.3) {
      assignedLevel = '기초';
    } else if (scoreRatio <= 0.7) {
      assignedLevel = '심화';
    } else {
      assignedLevel = '마스터';
    }

    return {
      assignedLevel,
      scoreRatio: Math.round(scoreRatio * 100),
      correctCount,
      totalCount: answers.length,
      wrongQuestionIds: wrongAnswers.map((w) => w.questionId),
    };
  }
}
