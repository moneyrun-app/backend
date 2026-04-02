import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { ReportGenerator } from './report.generator';
import { CreateWeeklyReportDto } from './dto/create-weekly-report.dto';

@Injectable()
export class BookService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly reportGenerator: ReportGenerator,
  ) {}

  // ========== 상세 리포트 ==========

  async getDetailedReports(userId: string) {
    const { data: items } = await this.supabase.db
      .from('detailed_reports')
      .select('id, title, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 월 1회 제한 체크
    const { canGenerate, nextAvailableDate } =
      await this.checkCanGenerateReport(userId);

    return {
      canGenerate,
      nextAvailableDate,
      items: (items || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        createdAt: r.created_at,
      })),
    };
  }

  async getDetailedReportById(userId: string, id: string) {
    const { data, error } = await this.supabase.db
      .from('detailed_reports')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('상세 리포트를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      grade: data.grade,
      surplus: data.surplus,
      analysis: data.analysis,
      createdAt: data.created_at,
    };
  }

  async checkCanGenerateReport(
    userId: string,
  ): Promise<{ canGenerate: boolean; nextAvailableDate: string | null }> {
    const { data: latest } = await this.supabase.db
      .from('detailed_reports')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latest) {
      return { canGenerate: true, nextAvailableDate: null };
    }

    const lastDate = new Date(latest.created_at);
    const nextDate = new Date(lastDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now >= nextDate) {
      return { canGenerate: true, nextAvailableDate: null };
    }

    return {
      canGenerate: false,
      nextAvailableDate: nextDate.toISOString().split('T')[0],
    };
  }

  async triggerDetailedReport(userId: string) {
    const { canGenerate } = await this.checkCanGenerateReport(userId);
    if (!canGenerate) return;

    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const report = await this.reportGenerator.generateDetailedReport(
      profile,
      configMap,
    );

    await this.supabase.db.from('detailed_reports').insert({
      user_id: userId,
      title: report.title,
      summary: report.summary,
      content: report.content,
      grade: profile.grade,
      surplus: { monthly: profile.surplus.monthly, daily: profile.surplus.daily },
      analysis: report.analysis,
    });
  }

  // ========== 주간 리포트 ==========

  async getWeeklyReports(userId: string) {
    const { data } = await this.supabase.db
      .from('weekly_reports')
      .select('id, week_start, week_end, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return (data || []).map((r: any) => ({
      id: r.id,
      weekStart: r.week_start,
      weekEnd: r.week_end,
      summary: r.summary,
      createdAt: r.created_at,
    }));
  }

  async createWeeklyReport(userId: string, dto: CreateWeeklyReportDto) {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    // 이번 주 페이스메이커 메시지들
    const { weekStart, weekEnd } = this.getCurrentWeekRange();

    const { data: weekMessages } = await this.supabase.db
      .from('pacemaker_messages')
      .select('message, date')
      .eq('user_id', userId)
      .gte('date', weekStart)
      .lte('date', weekEnd);

    const generated = await this.reportGenerator.generateWeeklyReport(
      profile,
      configMap,
      dto.weekStatus,
      weekMessages || [],
    );

    const { data: saved } = await this.supabase.db
      .from('weekly_reports')
      .insert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        summary: generated.summary,
        guide: generated.guide,
        user_input: dto.weekStatus,
      })
      .select()
      .single();

    return {
      id: saved!.id,
      weekStart: saved!.week_start,
      weekEnd: saved!.week_end,
      summary: saved!.summary,
      createdAt: saved!.created_at,
    };
  }

  async getWeeklyReportById(userId: string, id: string) {
    const { data, error } = await this.supabase.db
      .from('weekly_reports')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('주간 리포트를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      weekStart: data.week_start,
      weekEnd: data.week_end,
      summary: data.summary,
      guide: data.guide,
      userInput: data.user_input,
      createdAt: data.created_at,
    };
  }

  // ========== 금융 학습 ==========

  async getLearnContents(userId: string, grade?: string) {
    // 유저 등급 조회 (grade 파라미터 없으면 유저 등급 사용)
    let targetGrade = grade;
    if (!targetGrade) {
      const profile = await this.financeService.getFullProfile(userId);
      targetGrade = profile.grade;
    }

    const { data: contents } = await this.supabase.db
      .from('learn_contents')
      .select('id, title, grade, read_minutes')
      .eq('grade', targetGrade)
      .order('created_at', { ascending: true });

    // 읽음/스크랩 상태 조회
    const [readsRes, scrapsRes] = await Promise.all([
      this.supabase.db
        .from('user_content_reads')
        .select('content_id')
        .eq('user_id', userId),
      this.supabase.db
        .from('user_content_scraps')
        .select('content_id')
        .eq('user_id', userId),
    ]);

    const readIds = new Set(
      (readsRes.data || []).map((r: any) => r.content_id),
    );
    const scrapIds = new Set(
      (scrapsRes.data || []).map((s: any) => s.content_id),
    );

    return (contents || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      grade: c.grade,
      isRead: readIds.has(c.id),
      isScrapped: scrapIds.has(c.id),
      readMinutes: c.read_minutes,
    }));
  }

  async getLearnContentById(userId: string, id: string) {
    const { data: content, error } = await this.supabase.db
      .from('learn_contents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !content) {
      throw new NotFoundException('콘텐츠를 찾을 수 없습니다.');
    }

    // 자동 읽음 처리
    await this.supabase.db
      .from('user_content_reads')
      .upsert(
        { user_id: userId, content_id: id },
        { onConflict: 'user_id,content_id' },
      );

    // 스크랩 여부 확인
    const { data: scrap } = await this.supabase.db
      .from('user_content_scraps')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', id)
      .single();

    return {
      id: content.id,
      title: content.title,
      content: content.content,
      grade: content.grade,
      isRead: true,
      isScrapped: !!scrap,
    };
  }

  // ========== 스크랩 ==========

  async toggleScrap(userId: string, contentId: string) {
    // 기존 스크랩 확인
    const { data: existing } = await this.supabase.db
      .from('user_content_scraps')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();

    if (existing) {
      // 스크랩 해제
      await this.supabase.db
        .from('user_content_scraps')
        .delete()
        .eq('id', existing.id);
      return { isScrapped: false };
    } else {
      // 스크랩 추가
      await this.supabase.db
        .from('user_content_scraps')
        .insert({ user_id: userId, content_id: contentId });
      return { isScrapped: true };
    }
  }

  async getScraps(userId: string) {
    const { data } = await this.supabase.db
      .from('user_content_scraps')
      .select('content_id, created_at, learn_contents(id, title, grade)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return (data || []).map((s: any) => ({
      id: s.learn_contents?.id,
      title: s.learn_contents?.title,
      grade: s.learn_contents?.grade,
      type: 'learn',
      scrappedAt: s.created_at,
    }));
  }

  // ========== 유틸 ==========

  private getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const day = kst.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(kst);
    monday.setUTCDate(kst.getUTCDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0],
    };
  }
}
