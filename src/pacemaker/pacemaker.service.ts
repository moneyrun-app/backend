import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { MessageGenerator } from './message.generator';
import { QuizService } from '../quiz/quiz.service';
import { FeedbackDto } from './dto/feedback.dto';
import { CreateDailyCheckDto } from './dto/daily-check.dto';

@Injectable()
export class PacemakerService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly messageGenerator: MessageGenerator,
    private readonly quizService: QuizService,
  ) {}

  async getTodayMessage(userId: string) {
    const today = this.getTodayKST();

    // 오늘 이미 생성된 메시지가 있는지 확인
    const { data: cached } = await this.supabase.db
      .from('pacemaker_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1)
      .single();

    if (cached) {
      const quizzes = await this.quizService.getTodayQuizzes(userId, 10);
      return this.formatResponse(cached, quizzes);
    }

    // 없으면 AI로 메시지 1개 생성
    try {
      return await this.generateAndSave(userId, today);
    } catch (e: any) {
      // 동시 요청으로 유니크 제약 위반 시 → 캐시 반환
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
        const { data: retry } = await this.supabase.db
          .from('pacemaker_messages')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .limit(1)
          .single();

        if (retry) {
          const quizzes = await this.quizService.getTodayQuizzes(userId, 10);
          return this.formatResponse(retry, quizzes);
        }
      }
      throw e;
    }
  }

  async completeAction(userId: string, actionId: string) {
    const { data: action, error } = await this.supabase.db
      .from('pacemaker_actions')
      .select('*')
      .eq('id', actionId)
      .eq('user_id', userId)
      .single();

    if (error || !action) {
      throw new NotFoundException('추천 행동을 찾을 수 없습니다.');
    }

    if (action.status === 'completed') {
      throw new HttpException('이미 완료된 행동입니다.', HttpStatus.BAD_REQUEST);
    }

    const { error: updateError } = await this.supabase.db
      .from('pacemaker_actions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    if (updateError) {
      throw new Error(`행동 완료 처리 실패: ${updateError.message}`);
    }

    return {
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
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

  async getHistory(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [messagesRes, countRes] = await Promise.all([
      this.supabase.db
        .from('pacemaker_messages')
        .select('id, date, message, grade')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1),
      this.supabase.db
        .from('pacemaker_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    return {
      items: messagesRes.data || [],
      pagination: {
        page,
        limit,
        total: countRes.count || 0,
      },
    };
  }

  async createDailyCheck(userId: string, dto: CreateDailyCheckDto) {
    // 미래 날짜 차단
    const today = this.getTodayKST();
    if (dto.date > today) {
      throw new HttpException('미래 날짜는 체크할 수 없습니다.', HttpStatus.BAD_REQUEST);
    }

    // 같은 날짜 중복 → 업데이트
    const { data: existing } = await this.supabase.db
      .from('daily_checks')
      .select('id')
      .eq('user_id', userId)
      .eq('date', dto.date)
      .single();

    if (existing) {
      const { data: updated, error } = await this.supabase.db
        .from('daily_checks')
        .update({
          status: dto.status,
          amount: dto.amount ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`일별 체크 수정 실패: ${error.message}`);
      }

      return { id: updated.id, date: updated.date, status: updated.status, amount: updated.amount };
    }

    const { data: saved, error } = await this.supabase.db
      .from('daily_checks')
      .insert({
        user_id: userId,
        date: dto.date,
        status: dto.status,
        amount: dto.amount ?? 0,
      })
      .select()
      .single();

    if (error || !saved) {
      throw new Error(`일별 체크 저장 실패: ${error?.message || 'INSERT 반환값 없음'}`);
    }

    return { id: saved.id, date: saved.date, status: saved.status, amount: saved.amount };
  }

  async getDailyChecks(userId: string, month: string) {
    // month 형식: 2026-04
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${daysInMonth}`;

    const { data, error } = await this.supabase.db
      .from('daily_checks')
      .select('id, date, status, amount')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`일별 체크 조회 실패: ${error.message}`);
    }

    return data || [];
  }

  // ========== Private ==========

  private async generateAndSave(userId: string, today: string) {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const [latestReport, recentScraps, yesterdayActions] = await Promise.all([
      this.supabase.db
        .from('detailed_reports')
        .select('title, summary')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      this.supabase.db
        .from('external_scraps')
        .select('title, channel')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      this.getYesterdayActionStatus(userId),
    ]);

    const contextData = {
      profile,
      configMap,
      latestReport: latestReport.data,
      recentScraps: recentScraps.data || [],
      yesterdayActionCompleted: yesterdayActions,
      today,
      dayOfWeek: this.getDayOfWeekKR(),
    };

    const message = await this.messageGenerator.generate(contextData);

    const spendingStatus = {
      todayRemaining: profile.variableCost.daily,
      weeklyRemaining: profile.variableCost.weekly,
      weeklyUsed: 0,
      level: profile.grade.toLowerCase(),
    };

    // 퀴즈 10개 배정
    const quizzes = await this.quizService.getTodayQuizzes(userId, 10);
    const quizIds = quizzes.map((q: any) => q.id);

    // DB 저장
    const { data: saved, error: saveError } = await this.supabase.db
      .from('pacemaker_messages')
      .insert({
        user_id: userId,
        date: today,
        message,
        grade: profile.grade,
        daily_variable_cost: profile.variableCost.daily,
        spending_status: spendingStatus,
        quiz_ids: quizIds,
        disclaimer: '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      })
      .select()
      .single();

    if (saveError || !saved) {
      console.error('[pacemaker] 메시지 저장 실패:', saveError);
      throw new Error(`메시지 저장 실패: ${saveError?.message || 'INSERT 반환값 없음'}`);
    }

    return this.formatResponse(saved, quizzes);
  }

  private formatResponse(row: any, quizzes: any[]) {
    return {
      id: row.id,
      date: row.date,
      message: row.message,
      grade: row.grade,
      dailyVariableCost: row.daily_variable_cost,
      spendingStatus: row.spending_status || {
        todayRemaining: row.daily_variable_cost,
        weeklyRemaining: 0,
        weeklyUsed: 0,
        level: (row.grade || 'yellow').toLowerCase(),
      },
      quizzes,
      quizCount: quizzes.length,
      disclaimer: row.disclaimer || '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      createdAt: row.created_at,
    };
  }

  private async getYesterdayActionStatus(userId: string): Promise<boolean> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data } = await this.supabase.db
      .from('pacemaker_actions')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', yesterdayStr)
      .limit(1);

    return (data?.length || 0) > 0;
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
