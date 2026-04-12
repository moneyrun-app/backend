import {
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { MessageGenerator } from './message.generator';
import { QuizService } from '../quiz/quiz.service';
import { FeedbackDto } from './dto/feedback.dto';

@Injectable()
export class PacemakerService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly messageGenerator: MessageGenerator,
    private readonly quizService: QuizService,
  ) {}

  async getTodayMessage(userId: string, nickname: string) {
    const today = this.getTodayKST();

    // 온보딩 완료 확인
    const { data: profile } = await this.supabase.db
      .from('finance_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      // 온보딩 전이면 퀴즈 + 출석만 반환
      const todayQuiz = await this.quizService.getTodayQuiz(userId);
      const attendance = await this.getAttendanceInfo(userId, today);
      return {
        id: null,
        date: today,
        cards: [],
        grade: null,
        theme: null,
        quote: null,
        todayQuiz,
        attendance,
        disclaimer: null,
        createdAt: null,
        needsOnboarding: true,
      };
    }

    const { data: cached } = await this.supabase.db
      .from('pacemaker_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1)
      .single();

    if (cached) {
      const todayQuiz = await this.quizService.getTodayQuiz(userId);
      const attendance = await this.getAttendanceInfo(userId, today);
      return this.formatResponse(cached, todayQuiz, attendance);
    }

    try {
      return await this.generateAndSave(userId, nickname, today);
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
        const { data: retry } = await this.supabase.db
          .from('pacemaker_messages')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .limit(1)
          .single();

        if (retry) {
          const todayQuiz = await this.quizService.getTodayQuiz(userId);
          const attendance = await this.getAttendanceInfo(userId, today);
          return this.formatResponse(retry, todayQuiz, attendance);
        }
      }
      throw e;
    }
  }

  async submitFeedback(userId: string, dto: FeedbackDto) {
    const { error } = await this.supabase.db
      .from('pacemaker_feedback')
      .insert({
        message_id: dto.messageId,
        user_id: userId,
        type: dto.type,
        content: dto.content || null,
      });

    if (error) {
      throw new Error(`피드백 저장 실패: ${error.message}`);
    }

    return { message: '피드백이 접수되었습니다.' };
  }

  // ========== Private: 메시지 생성 ==========

  private async generateAndSave(userId: string, nickname: string, today: string) {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const recentScraps = await this.supabase.db
      .from('external_scraps')
      .select('title, channel')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    const contextData = {
      profile,
      nickname,
      configMap,
      recentScraps: recentScraps.data || [],
      today,
      dayOfWeek: this.getDayOfWeekKR(),
      dayOfWeekIndex: kst.getUTCDay(),
    };

    const { cards, theme, quote } = await this.messageGenerator.generate(contextData);

    const { data: saved, error: saveError } = await this.supabase.db
      .from('pacemaker_messages')
      .insert({
        user_id: userId,
        date: today,
        message: JSON.stringify(cards),
        grade: profile.grade,
        daily_variable_cost: profile.variableCost.daily,
        theme,
        quote,
        disclaimer: '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      })
      .select()
      .single();

    if (saveError || !saved) {
      console.error('[pacemaker] 메시지 저장 실패:', saveError);
      throw new Error(`메시지 저장 실패: ${saveError?.message || 'INSERT 반환값 없음'}`);
    }

    const todayQuiz = await this.quizService.getTodayQuiz(userId);
    const attendance = await this.getAttendanceInfo(userId, today);

    return this.formatResponse(saved, todayQuiz, attendance);
  }

  private async getAttendanceInfo(userId: string, today: string) {
    // 오늘 출석 여부
    const { data: todayRecord } = await this.supabase.db
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    // 연속 출석일 계산
    const { data: records } = await this.supabase.db
      .from('attendance_records')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(365);

    let currentStreak = 0;
    if (records && records.length > 0) {
      const dates = new Set(records.map((r: any) => r.date));
      let checkDate = today;

      // 오늘 출석했으면 오늘부터, 아니면 어제부터 카운트
      if (!dates.has(checkDate)) {
        checkDate = this.addDays(checkDate, -1);
      }

      while (dates.has(checkDate)) {
        currentStreak++;
        checkDate = this.addDays(checkDate, -1);
      }
    }

    // 누적 출석일
    const { count } = await this.supabase.db
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      checkedToday: !!todayRecord,
      currentStreak,
      totalDays: count || 0,
    };
  }

  private parseCards(message: any): any[] {
    if (Array.isArray(message)) return message;
    if (typeof message === 'string') {
      try { return JSON.parse(message); } catch { return []; }
    }
    return [];
  }

  private formatResponse(row: any, todayQuiz: any, attendance: any) {
    return {
      id: row.id,
      date: row.date,
      cards: this.parseCards(row.message),
      grade: row.grade,
      theme: row.theme || null,
      quote: row.quote || null,
      todayQuiz,
      attendance,
      disclaimer: row.disclaimer || '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      createdAt: row.created_at,
    };
  }

  // ========== 유틸 ==========

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  private getTodayKST(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  }

  private getDayOfWeekKR(): string {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return days[kst.getUTCDay()] + '요일';
  }
}
