import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

/** 난이도 매핑: 1=초급, 2=심화, 3=마스터 */
const DIFFICULTY_LABELS: Record<number, string> = { 1: '초급', 2: '심화', 3: '마스터' };

/** 퀴즈 본체 기본 SELECT (course_category join 포함) */
const QUIZ_BASE_SELECT =
  'id, quiz_code, question, choices, hint, difficulty_level, total_attempts, correct_count, correct_rate, course_category_id, course_category:course_categories!course_category_id(id, name)';

@Injectable()
export class QuizService {
  constructor(private readonly supabase: SupabaseService) {}

  async getUserLevel(userId: string) {
    return this.supabase.db
      .from('users')
      .select('quiz_level')
      .eq('id', userId)
      .single();
  }

  /** 카테고리 이름 → ID 조회 (필터 최적화용) */
  private async resolveCategoryId(name?: string): Promise<string | null> {
    if (!name) return null;
    const { data } = await this.supabase.db
      .from('course_categories')
      .select('id')
      .eq('name', name)
      .single();
    return data?.id || null;
  }

  private mapQuiz(row: any, overrideSource?: string) {
    const dl = row?.difficulty_level || 1;
    const categoryName = row?.course_category?.name || null;
    return {
      id: row.id,
      quizCode: row.quiz_code,
      question: row.question,
      choices: row.choices,
      hint: row.hint,
      difficultyLevel: dl,
      difficultyLabel: DIFFICULTY_LABELS[dl] || '초급',
      source: overrideSource || null,
      category: categoryName,
      totalAttempts: row.total_attempts || 0,
      correctCount: row.correct_count || 0,
      correctRate: row.correct_rate || 0,
    };
  }

  /** 오늘의 퀴즈 1문제 (유저 레벨 기반, 코스 카테고리 필터) — 이미 풀었으면 null 반환 */
  async getTodayQuiz(userId: string, courseCategory?: string) {
    // 오늘 이미 출석했으면 null
    const today = this.getTodayKST();
    const { data: attendance } = await this.supabase.db
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (attendance) return null;

    // 유저 레벨 조회
    const { data: user } = await this.supabase.db
      .from('users')
      .select('quiz_level')
      .eq('id', userId)
      .single();

    const level = user?.quiz_level || 1;
    const courseCategoryId = await this.resolveCategoryId(courseCategory);

    // 30% 확률로 오답노트에서 재출제
    const useWrongNote = Math.random() < 0.3;
    if (useWrongNote) {
      const { data: wrongNotes } = await this.supabase.db
        .from('wrong_notes')
        .select(`quiz_id, quiz:quizzes (${QUIZ_BASE_SELECT})`)
        .eq('user_id', userId)
        .not('quiz_id', 'is', null)
        .limit(10);

      let filteredNotes = (wrongNotes || []).filter((n: any) => n.quiz);
      if (courseCategoryId && filteredNotes.length > 0) {
        const courseScopedNotes = filteredNotes.filter(
          (n: any) => n.quiz?.course_category_id === courseCategoryId,
        );
        if (courseScopedNotes.length > 0) filteredNotes = courseScopedNotes;
      }

      if (filteredNotes.length > 0) {
        const pick = filteredNotes[Math.floor(Math.random() * filteredNotes.length)];
        return this.mapQuiz(pick.quiz, '오답노트 복습');
      }
    }

    // 유저 레벨에 맞는 새 퀴즈
    const { data: answered } = await this.supabase.db
      .from('quiz_answers')
      .select('quiz_id')
      .eq('user_id', userId);

    const excludeIds = (answered || []).map((a: any) => a.quiz_id).filter(Boolean);

    let query = this.supabase.db
      .from('quizzes')
      .select(QUIZ_BASE_SELECT)
      .eq('difficulty_level', level);

    if (courseCategoryId) {
      query = query.eq('course_category_id', courseCategoryId);
    }

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: quizzes } = await query;

    if (!quizzes || quizzes.length === 0) {
      // 레벨+카테고리 없으면 카테고리만, 그래도 없으면 전체
      let fallbackQuery = this.supabase.db
        .from('quizzes')
        .select(QUIZ_BASE_SELECT);

      if (courseCategoryId) {
        fallbackQuery = fallbackQuery.eq('course_category_id', courseCategoryId);
      }

      if (excludeIds.length > 0) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      let { data: fallback } = await fallbackQuery;

      if ((!fallback || fallback.length === 0) && courseCategoryId) {
        let allQuery = this.supabase.db
          .from('quizzes')
          .select(QUIZ_BASE_SELECT);
        if (excludeIds.length > 0) {
          allQuery = allQuery.not('id', 'in', `(${excludeIds.join(',')})`);
        }
        const allResult = await allQuery;
        fallback = allResult.data;
      }

      if (!fallback || fallback.length === 0) return null;

      const pick = fallback[Math.floor(Math.random() * fallback.length)];
      return this.mapQuiz(pick);
    }

    const pick = quizzes[Math.floor(Math.random() * quizzes.length)];
    return this.mapQuiz(pick);
  }

  private getTodayKST(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  }

  /** 유저가 아직 안 푼 퀴즈 N개 배정 (오답 재출제 30% 포함) — 정답 미노출 */
  async getTodayQuizzes(userId: string, count = 10) {
    const result: any[] = [];

    // 1. 오답노트에서 재출제 (30%)
    const retryCount = Math.ceil(count * 0.3);
    const { data: wrongNotes } = await this.supabase.db
      .from('wrong_notes')
      .select(`id, quiz_id, quiz:quizzes (${QUIZ_BASE_SELECT})`)
      .eq('user_id', userId)
      .not('quiz_id', 'is', null)
      .limit(retryCount * 2);

    const retryQuizzes = (wrongNotes || [])
      .filter((n: any) => n.quiz)
      .sort(() => Math.random() - 0.5)
      .slice(0, retryCount)
      .map((n: any) => ({
        ...this.mapQuiz(n.quiz, '오답노트 복습'),
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
        .select(QUIZ_BASE_SELECT);

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: newQuizzes } = await query;

      const shuffled = (newQuizzes || []).sort(() => Math.random() - 0.5);
      result.push(...shuffled.slice(0, remaining).map((q: any) => this.mapQuiz(q)));
    }

    return result.sort(() => Math.random() - 0.5);
  }

  /** 객관식 답변 제출 — 정답/오답 모두 간단+상세 설명 반환 */
  async submitAnswer(userId: string, quizId: string, userAnswer: number) {
    const { data: quiz, error: quizError } = await this.supabase.db
      .from('quizzes')
      .select('id, question, choices, correct_answer, brief_explanation, detailed_explanation, course_category:course_categories!course_category_id(name)')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      throw new NotFoundException('퀴즈를 찾을 수 없습니다.');
    }

    const choiceCount = (quiz.choices as any[]).length;
    if (userAnswer < 0 || userAnswer >= choiceCount) {
      throw new BadRequestException(`보기는 0~${choiceCount - 1}번까지입니다.`);
    }

    const dbAnswer = userAnswer + 1; // 0-indexed → 1-indexed
    const correct = dbAnswer === quiz.correct_answer;

    if (correct) {
      await this.supabase.db
        .from('wrong_notes')
        .delete()
        .eq('user_id', userId)
        .eq('quiz_id', quizId);
    }

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
      correctAnswer: quiz.correct_answer - 1,
      userAnswer,
      briefExplanation: quiz.brief_explanation,
      detailedExplanation: quiz.detailed_explanation,
      ...(wrongNoteId ? { wrongNoteId } : {}),
    };
  }

  // ========== v2: 답변 + 출석 자동 체크 ==========

  async submitAnswerV2(userId: string, quizId: string, userAnswer: number) {
    const result = await this.submitAnswer(userId, quizId, userAnswer);
    const today = this.getTodayKST();

    let attendanceChecked = false;
    const { data: existingAttendance } = await this.supabase.db
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (!existingAttendance) {
      await this.supabase.db
        .from('attendance_records')
        .insert({
          user_id: userId,
          date: today,
          quiz_id: quizId,
          is_correct: result.correct,
        });
      attendanceChecked = true;
    }

    const streak = await this.calculateStreak(userId, today);
    await this.checkAndAwardBadges(userId, streak, today);

    const { data: user } = await this.supabase.db
      .from('users')
      .select('quiz_level')
      .eq('id', userId)
      .single();

    const currentLevel = user?.quiz_level || 1;
    let suggestLevelChange: 'up' | 'down' | null = null;
    if (result.correct && currentLevel < 3) suggestLevelChange = 'up';
    if (!result.correct && currentLevel > 1) suggestLevelChange = 'down';

    return {
      ...result,
      attendanceChecked,
      currentStreak: streak,
      suggestLevelChange,
    };
  }

  // ========== 난이도 변경 ==========

  async changeQuizLevel(userId: string, level: number) {
    const clamped = Math.max(1, Math.min(3, Math.round(level)));

    await this.supabase.db
      .from('users')
      .update({ quiz_level: clamped })
      .eq('id', userId);

    return { newLevel: clamped, newLevelLabel: DIFFICULTY_LABELS[clamped] || '초급' };
  }

  // ========== 출석 현황 ==========

  async getAttendanceStreak(userId: string) {
    const today = this.getTodayKST();
    const currentStreak = await this.calculateStreak(userId, today);

    const { data: allRecords } = await this.supabase.db
      .from('attendance_records')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    let longestStreak = 0;
    let tempStreak = 1;
    const dates = (allRecords || []).map((r: any) => r.date);

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00Z');
      const curr = new Date(dates[i] + 'T00:00:00Z');
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    if (dates.length === 0) longestStreak = 0;

    const { count: totalDays } = await this.supabase.db
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const monthStart = today.substring(0, 7) + '-01';
    const { count: thisMonthDays } = await this.supabase.db
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', today);

    const { data: badges } = await this.supabase.db
      .from('user_badges')
      .select('badge:badges (code, name, icon), earned_at')
      .eq('user_id', userId);

    return {
      currentStreak,
      longestStreak,
      totalDays: totalDays || 0,
      thisMonthDays: thisMonthDays || 0,
      badges: (badges || []).map((b: any) => ({
        code: b.badge?.code,
        name: b.badge?.name,
        icon: b.badge?.icon,
        earnedAt: b.earned_at,
      })),
    };
  }

  async getAttendanceHistory(userId: string, month: string) {
    const startDate = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const { data: records } = await this.supabase.db
      .from('attendance_records')
      .select('date, is_correct, quiz:quizzes (difficulty_level)')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    return {
      month,
      records: (records || []).map((r: any) => {
        const dl = r.quiz?.difficulty_level || 1;
        return {
          date: r.date,
          isCorrect: r.is_correct,
          quizLevel: dl,
          quizLevelLabel: DIFFICULTY_LABELS[dl] || '초급',
        };
      }),
    };
  }

  // ========== 퀴즈 스크랩 ==========

  async toggleQuizScrap(userId: string, quizId: string, note?: string) {
    const { data: existing } = await this.supabase.db
      .from('user_quiz_scraps')
      .select('id')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .single();

    if (existing) {
      await this.supabase.db
        .from('user_quiz_scraps')
        .delete()
        .eq('id', existing.id);
      return { scrapped: false, scrapId: null };
    }

    const { data: saved } = await this.supabase.db
      .from('user_quiz_scraps')
      .insert({ user_id: userId, quiz_id: quizId, note: note || null })
      .select('id')
      .single();

    return { scrapped: true, scrapId: saved?.id || null };
  }

  // ========== Private helpers ==========

  private async calculateStreak(userId: string, today: string): Promise<number> {
    const { data: records } = await this.supabase.db
      .from('attendance_records')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(365);

    if (!records || records.length === 0) return 0;

    const dates = new Set(records.map((r: any) => r.date));
    let streak = 0;
    let checkDate = today;

    if (!dates.has(checkDate)) {
      checkDate = this.addDays(checkDate, -1);
    }

    while (dates.has(checkDate)) {
      streak++;
      checkDate = this.addDays(checkDate, -1);
    }

    return streak;
  }

  private async checkAndAwardBadges(userId: string, streak: number, today: string) {
    const streakBadges: Array<{ code: string; value: number }> = [
      { code: 'streak_7', value: 7 },
      { code: 'streak_30', value: 30 },
      { code: 'streak_180', value: 180 },
    ];

    const { count: totalDays } = await this.supabase.db
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalBadges: Array<{ code: string; value: number }> = [
      { code: 'total_30', value: 30 },
      { code: 'total_100', value: 100 },
    ];

    const month = today.substring(0, 7);
    const allBadgeCodes = [
      ...streakBadges.filter(b => streak >= b.value).map(b => b.code),
      ...totalBadges.filter(b => (totalDays || 0) >= b.value).map(b => b.code),
    ];

    for (const code of allBadgeCodes) {
      const { data: badge } = await this.supabase.db
        .from('badges')
        .select('id')
        .eq('code', code)
        .single();

      if (!badge) continue;

      const { data: existing } = await this.supabase.db
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badge.id)
        .single();

      if (!existing) {
        await this.supabase.db
          .from('user_badges')
          .insert({
            user_id: userId,
            badge_id: badge.id,
            month,
            earned_at: new Date().toISOString(),
          });
      }
    }
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  /** 오답노트 목록 조회 (데일리 + 진단퀴즈 통합) */
  async getWrongNotes(userId: string) {
    const { data, error } = await this.supabase.db
      .from('wrong_notes')
      .select(`
        id,
        user_answer,
        created_at,
        quiz:quizzes (id, question, choices, correct_answer, brief_explanation, detailed_explanation, course_category:course_categories!course_category_id(name)),
        diagnostic_quiz:diagnostic_quizzes (id, question, choices, correct_answer, brief_explanation, detailed_explanation, course_category:course_categories!course_category_id(name))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`오답노트 조회 실패: ${error.message}`);
    }

    return (data || []).map((n: any) => {
      const isDiagnostic = !!n.diagnostic_quiz;
      const q = isDiagnostic ? n.diagnostic_quiz : n.quiz;
      const category = q?.course_category?.name || null;

      return {
        id: n.id,
        quizId: q?.id,
        question: q?.question,
        choices: q?.choices,
        correctAnswer: q?.correct_answer,
        userAnswer: n.user_answer,
        briefExplanation: q?.brief_explanation,
        detailedExplanation: q?.detailed_explanation || q?.brief_explanation,
        source: isDiagnostic ? '진단퀴즈' : '데일리',
        category,
        type: isDiagnostic ? 'diagnostic' : 'daily',
        createdAt: n.created_at,
      };
    });
  }
}
