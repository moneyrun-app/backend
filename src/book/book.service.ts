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
      .select('id, summary, report_version, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return {
      items: (items || []).map((r: any) => ({
        id: r.id,
        title: '시뮬레이터 분석 리포트',
        summary: r.summary,
        reportVersion: r.report_version || 'v1',
        analyzedAt: r.created_at,
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
      title: '시뮬레이터 분석 리포트',
      reportVersion: 'v6',
      analyzedAt: data.created_at,
      grade: data.grade,
      summary: data.summary,
      sections: data.sections,
      userSnapshot: data.user_snapshot,
      disclaimer: data.sections?.[data.sections.length - 1]?.disclaimer || '',
      createdAt: data.created_at,
    };
  }

  /**
   * 상세 리포트 생성 (온보딩 시 호출)
   */
  async generateDetailedReport(userId: string, isFree: boolean): Promise<string> {
    console.log('[리포트] book.service 진입 - userId:', userId);

    const profile = await this.financeService.getFullProfile(userId);
    console.log('[리포트] 프로필 조회 완료 - grade:', profile.grade, 'income:', profile.monthlyIncome);

    const configMap = await this.constantsService.getConfigMap();
    console.log('[리포트] configMap 조회 완료 - 키 개수:', Object.keys(configMap).length);

    const peerData = this.constantsService.getPeerData(configMap, profile.age);
    console.log('[리포트] peerData 조회 완료 - ageGroup:', peerData.ageGroupLabel);

    const report = await this.reportGenerator.generateDetailedReportV6(profile, configMap, peerData);
    console.log('[리포트] v6 생성 완료 - sections:', report.sections.length, '개');

    const userSnapshot = {
      nickname: profile.nickname,
      age: profile.age,
      income: profile.monthlyIncome,
      fixedCost: profile.monthlyFixedCost,
      variableCost: profile.monthlyVariableCost,
      surplus: profile.monthlyIncome - (profile.monthlyFixedCost || 0) - (profile.monthlyVariableCost || 0),
      grade: profile.grade,
      retirementAge: profile.retirementAge,
      pensionStartAge: profile.pensionStartAge,
    };

    console.log('[리포트] DB 저장 시도...');
    const { data: saved, error } = await this.supabase.db
      .from('detailed_reports')
      .insert({
        user_id: userId,
        title: report.title,
        summary: report.summary,
        grade: profile.grade,
        sections: report.sections,
        report_version: 'v6',
        user_snapshot: userSnapshot,
        is_free: isFree,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[리포트] DB 저장 실패:', error);
      throw new Error(`리포트 저장 실패: ${error.message}`);
    }
    console.log('[리포트] DB 저장 완료 - id:', saved!.id);

    // Section I 용어사전 → 마이북 저장
    const glossarySection = report.sections.find((s: any) => s.section === 'I');
    if (glossarySection) {
      await this.supabase.db
        .from('user_glossaries')
        .insert({
          user_id: userId,
          report_id: saved!.id,
          terms: (glossarySection as any).terms,
          grade: profile.grade,
        });
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

  // ========== 월간 리포트 ==========

  async getMonthlyReports(userId: string) {
    const { data } = await this.supabase.db
      .from('monthly_reports')
      .select('id, month, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return (data || []).map((r: any) => ({
      id: r.id,
      month: r.month,
      summary: r.summary,
      createdAt: r.created_at,
    }));
  }

  async createMonthlyReport(userId: string, dto: CreateWeeklyReportDto) {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();

    const month = this.getCurrentMonth();
    const monthStart = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const monthEnd = `${month}-${new Date(y, m, 0).getDate()}`;

    const { data: monthMessages } = await this.supabase.db
      .from('pacemaker_messages')
      .select('message, date')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    // 일별 체크 데이터 포함
    const { data: dailyChecks } = await this.supabase.db
      .from('daily_checks')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    const generated = await this.reportGenerator.generateWeeklyReport(
      profile,
      configMap,
      dto.weekStatus,
      monthMessages || [],
    );

    const { data: saved } = await this.supabase.db
      .from('monthly_reports')
      .insert({
        user_id: userId,
        month,
        summary: generated.summary,
        guide: generated.guide,
        user_input: dto.weekStatus,
        weekly_stats: {
          dailyChecks: dailyChecks || [],
          ...generated.weeklyStats,
        },
      })
      .select()
      .single();

    return {
      id: saved!.id,
      month: saved!.month,
      summary: saved!.summary,
      createdAt: saved!.created_at,
    };
  }

  async getMonthlyReportById(userId: string, id: string) {
    const { data, error } = await this.supabase.db
      .from('monthly_reports')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('월간 리포트를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      month: data.month,
      summary: data.summary,
      guide: data.guide,
      monthlyStats: data.weekly_stats || {},
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

  // ========== 금융 용어 사전 ==========

  async getGlossary(userId: string) {
    const { data } = await this.supabase.db
      .from('user_glossaries')
      .select('id, terms, grade, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return { terms: [], grade: null, message: '아직 리포트를 생성하지 않았어요. 리포트를 생성하면 용어사전이 선물로 저장됩니다!' };
    }

    return {
      terms: data.terms,
      grade: data.grade,
      message: '여기까지 읽어주셔서 감사해요. 금융용어사전을 선물로 마이북에 넣어드렸어요!',
      createdAt: data.created_at,
    };
  }

  // ========== Utils ==========

  private getCurrentMonth(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
