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
import { FeedbackDto } from './dto/feedback.dto';

@Injectable()
export class PacemakerService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly messageGenerator: MessageGenerator,
  ) {}

  async getTodayMessage(userId: string) {
    const today = this.getTodayKST();

    // 캐시된 메시지 확인 (가장 최근 것)
    const { data: cached } = await this.supabase.db
      .from('pacemaker_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      // 추천 행동 조회
      const actions = await this.getActionsForMessage(cached.id);
      const todayCount = await this.getTodayMessageCount(userId, today);

      return this.formatMessage(cached, actions, todayCount < 2);
    }

    // AI 메시지 생성
    return this.generateAndSaveMessage(userId, today);
  }

  async refreshMessage(userId: string) {
    const today = this.getTodayKST();
    const todayCount = await this.getTodayMessageCount(userId, today);

    if (todayCount >= 2) {
      throw new HttpException(
        '오늘 메시지 새로고침 횟수를 초과했습니다. (최대 2회)',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.generateAndSaveMessage(userId, today);
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

  // ========== Private ==========

  private async generateAndSaveMessage(userId: string, today: string) {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    // 참조 데이터 수집
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

    // 학습 콘텐츠 (추천 행동용)
    const { data: learnContents } = await this.supabase.db
      .from('learn_contents')
      .select('id, title, grade')
      .eq('grade', profile.grade)
      .limit(5);

    const contextData = {
      profile,
      configMap,
      latestReport: latestReport.data,
      recentScraps: recentScraps.data || [],
      learnContents: learnContents || [],
      yesterdayActionCompleted: yesterdayActions,
      today,
      dayOfWeek: this.getDayOfWeekKR(),
    };

    const generated = await this.messageGenerator.generate(contextData);

    // 지출 신호등
    const spendingStatus = {
      todayRemaining: profile.variableCost.daily,
      weeklyRemaining: profile.variableCost.weekly,
      weeklyUsed: 0,
      level: profile.grade.toLowerCase(),
    };

    // DB 저장
    const { data: saved, error: saveError } = await this.supabase.db
      .from('pacemaker_messages')
      .insert({
        user_id: userId,
        date: today,
        message: generated.message,
        grade: profile.grade,
        daily_variable_cost: profile.variableCost.daily,
        spending_status: spendingStatus,
        actions: generated.actions,
        disclaimer: '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      })
      .select()
      .single();

    if (saveError || !saved) {
      console.error('[pacemaker] 메시지 저장 실패:', saveError);
      throw new Error(`메시지 저장 실패: ${saveError?.message || 'INSERT 반환값 없음'}`);
    }

    // 추천 행동 저장
    const savedActions: Array<{ id: string; type: string; contentId: string | null; title: string; label: string; status: string }> = [];
    for (const action of generated.actions) {
      const { data: savedAction } = await this.supabase.db
        .from('pacemaker_actions')
        .insert({
          message_id: saved.id,
          user_id: userId,
          type: action.type,
          content_id: action.id || null,
          title: action.title,
          label: action.label,
          status: 'pending',
        })
        .select()
        .single();

      if (savedAction) {
        savedActions.push({
          id: savedAction.id,
          type: savedAction.type,
          contentId: savedAction.content_id,
          title: savedAction.title,
          label: savedAction.label,
          status: savedAction.status,
        });
      }
    }

    const todayCount = await this.getTodayMessageCount(userId, today);

    return {
      id: saved!.id,
      date: saved!.date,
      message: saved!.message,
      grade: saved!.grade,
      dailyVariableCost: saved!.daily_variable_cost,
      spendingStatus,
      actions: savedActions,
      disclaimer: saved!.disclaimer,
      canRefresh: todayCount < 2,
      createdAt: saved!.created_at,
    };
  }

  private async getActionsForMessage(messageId: string) {
    const { data } = await this.supabase.db
      .from('pacemaker_actions')
      .select('id, type, content_id, title, label, status')
      .eq('message_id', messageId);

    return (data || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      contentId: a.content_id,
      title: a.title,
      label: a.label,
      status: a.status,
    }));
  }

  private async getTodayMessageCount(userId: string, today: string): Promise<number> {
    const { count } = await this.supabase.db
      .from('pacemaker_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', today);

    return count || 0;
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

  private formatMessage(cached: any, actions: any[], canRefresh: boolean) {
    return {
      id: cached.id,
      date: cached.date,
      message: cached.message,
      grade: cached.grade,
      dailyVariableCost: cached.daily_variable_cost,
      spendingStatus: cached.spending_status || {
        todayRemaining: cached.daily_variable_cost,
        weeklyRemaining: 0,
        weeklyUsed: 0,
        level: (cached.grade || 'yellow').toLowerCase(),
      },
      actions,
      disclaimer: cached.disclaimer || '참고용 조언이며, 개인 상황에 따라 다를 수 있어요',
      canRefresh,
      createdAt: cached.created_at,
    };
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
