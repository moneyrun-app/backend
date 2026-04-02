import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { MessageGenerator } from './message.generator';

@Injectable()
export class PacemakerService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly messageGenerator: MessageGenerator,
  ) {}

  async getTodayMessage(userId: string) {
    // KST 기준 오늘 날짜
    const today = this.getTodayKST();

    // 1. 캐시된 메시지 확인
    const { data: cached } = await this.supabase.db
      .from('pacemaker_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (cached) {
      return {
        id: cached.id,
        date: cached.date,
        message: cached.message,
        grade: cached.grade,
        dailySurplus: cached.daily_surplus,
        actions: cached.actions,
        createdAt: cached.created_at,
      };
    }

    // 2. AI 메시지 생성
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    // 참조 데이터 수집
    const [latestReport, latestWeekly, recentScraps] = await Promise.all([
      this.supabase.db
        .from('detailed_reports')
        .select('title, summary')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      this.supabase.db
        .from('weekly_reports')
        .select('summary')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      this.supabase.db
        .from('user_content_scraps')
        .select('content_id, learn_contents(title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // 학습 콘텐츠 목록 (추천 행동용)
    const { data: learnContents } = await this.supabase.db
      .from('learn_contents')
      .select('id, title, grade')
      .eq('grade', profile.grade)
      .limit(5);

    const contextData = {
      profile,
      configMap,
      latestReport: latestReport.data,
      latestWeekly: latestWeekly.data,
      recentScraps: recentScraps.data || [],
      learnContents: learnContents || [],
      today,
      dayOfWeek: this.getDayOfWeekKR(),
    };

    const generated = await this.messageGenerator.generate(contextData);

    // 3. DB 저장
    const { data: saved } = await this.supabase.db
      .from('pacemaker_messages')
      .insert({
        user_id: userId,
        date: today,
        message: generated.message,
        grade: profile.grade,
        daily_surplus: profile.surplus.daily,
        actions: generated.actions,
      })
      .select()
      .single();

    return {
      id: saved!.id,
      date: saved!.date,
      message: saved!.message,
      grade: saved!.grade,
      dailySurplus: saved!.daily_surplus,
      actions: saved!.actions,
      createdAt: saved!.created_at,
    };
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
