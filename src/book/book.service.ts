import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { ReportGenerator } from './report.generator';
import { ScraperService } from './scraper.service';
import { CreateWeeklyReportDto } from './dto/create-weekly-report.dto';

@Injectable()
export class BookService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly reportGenerator: ReportGenerator,
    private readonly scraperService: ScraperService,
  ) {}

  // ========== AI 상세 리포트 ==========

  async getDetailedReports(userId: string) {
    const { data: items } = await this.supabase.db
      .from('detailed_reports')
      .select('id, title, summary, pdf_url, is_free, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: freeReport } = await this.supabase.db
      .from('detailed_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('is_free', true)
      .limit(1)
      .single();

    return {
      canGenerateFree: !freeReport,
      items: (items || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        pdfUrl: r.pdf_url,
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
      analysis: data.analysis,
      pdfUrl: data.pdf_url,
      isFree: data.is_free,
      createdAt: data.created_at,
    };
  }

  /**
   * 상세 리포트 생성 (온보딩 시 호출)
   * @returns 생성된 리포트 ID
   */
  async generateDetailedReport(userId: string, isFree: boolean): Promise<string> {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const report = await this.reportGenerator.generateDetailedReport(profile, configMap);

    const { data: saved, error } = await this.supabase.db
      .from('detailed_reports')
      .insert({
        user_id: userId,
        title: report.title,
        summary: report.summary,
        content: report.content,
        grade: profile.grade,
        analysis: report.analysis,
        is_free: isFree,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`리포트 저장 실패: ${error.message}`);
    }

    return saved!.id;
  }

  /**
   * 유료 리포트 재생성 (또는 첫 무료 생성)
   */
  async generateReportWithPayment(userId: string, paymentToken?: string) {
    // 최초 무료 여부 확인
    const { data: freeReport } = await this.supabase.db
      .from('detailed_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('is_free', true)
      .limit(1)
      .single();

    const isFree = !freeReport;

    if (!isFree && !paymentToken) {
      throw new HttpException(
        '유료 리포트 생성은 결제가 필요합니다.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // TODO: 유료인 경우 PG 결제 검증 (paymentToken)
    // 결제 이력 저장은 payment 모듈에서 처리

    const reportId = await this.generateDetailedReport(userId, isFree);

    return {
      id: reportId,
      status: 'generating',
    };
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
        weekly_stats: generated.weeklyStats || {},
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
      weeklyStats: data.weekly_stats || {},
      userInput: data.user_input,
      createdAt: data.created_at,
    };
  }

  // ========== 외부 URL 스크랩 ==========

  async createExternalScrap(userId: string, url: string) {
    // URL 메타데이터 + AI 요약
    const metadata = await this.scraperService.scrapeUrl(url);

    // 동일 URL scrap_count 조회
    const { data: existing } = await this.supabase.db
      .from('external_scraps')
      .select('scrap_count')
      .eq('url', url)
      .limit(1)
      .single();

    const scrapCount = (existing?.scrap_count || 0) + 1;

    // 저장
    const { data: saved, error } = await this.supabase.db
      .from('external_scraps')
      .insert({
        user_id: userId,
        url,
        channel: metadata.channel,
        creator: metadata.creator,
        content_date: metadata.contentDate,
        title: metadata.title,
        ai_summary: metadata.aiSummary,
        scrap_count: scrapCount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`스크랩 저장 실패: ${error.message}`);
    }

    // 전체 URL scrap_count 업데이트
    if (existing) {
      await this.supabase.db
        .from('external_scraps')
        .update({ scrap_count: scrapCount })
        .eq('url', url);
    }

    return {
      id: saved!.id,
      url: saved!.url,
      channel: saved!.channel,
      creator: saved!.creator,
      contentDate: saved!.content_date,
      title: saved!.title,
      aiSummary: saved!.ai_summary,
      scrapCount,
      createdAt: saved!.created_at,
    };
  }

  async getExternalScraps(userId: string) {
    const { data } = await this.supabase.db
      .from('external_scraps')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return (data || []).map((s: any) => ({
      id: s.id,
      url: s.url,
      channel: s.channel,
      creator: s.creator,
      contentDate: s.content_date,
      title: s.title,
      aiSummary: s.ai_summary,
      scrapCount: s.scrap_count,
      createdAt: s.created_at,
    }));
  }

  async deleteExternalScrap(userId: string, id: string) {
    const { error } = await this.supabase.db
      .from('external_scraps')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new NotFoundException('스크랩을 찾을 수 없습니다.');
    }
  }

  // ========== 금융 학습 ==========

  async getLearnContents(userId: string, grade?: string) {
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

    const readIds = new Set((readsRes.data || []).map((r: any) => r.content_id));
    const scrapIds = new Set((scrapsRes.data || []).map((s: any) => s.content_id));

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

  async toggleLearnScrap(userId: string, contentId: string) {
    const { data: existing } = await this.supabase.db
      .from('user_content_scraps')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();

    if (existing) {
      await this.supabase.db
        .from('user_content_scraps')
        .delete()
        .eq('id', existing.id);
      return { isScrapped: false };
    } else {
      await this.supabase.db
        .from('user_content_scraps')
        .insert({ user_id: userId, content_id: contentId });
      return { isScrapped: true };
    }
  }

  // ========== Utils ==========

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
