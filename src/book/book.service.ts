import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { ConstantsService } from '../constants/constants.service';
import { ReportGenerator } from './report.generator';
import { ScraperService } from './scraper.service';

@Injectable()
export class BookService {
  // 생성 중인 유저 추적 (메모리)
  private generatingUsers = new Set<string>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly reportGenerator: ReportGenerator,
    private readonly scraperService: ScraperService,
  ) {}

  // ========== 리포트 생성 요청 (비동기) ==========

  async requestGenerateReport(userId: string) {
    // 이미 생성 중인지 확인
    if (this.generatingUsers.has(userId)) {
      return { status: 'generating', message: '리포트 생성 중입니다.' };
    }

    // 온보딩 완료 확인
    const { data: profile } = await this.supabase.db
      .from('finance_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      throw new BadRequestException('온보딩을 먼저 완료해주세요.');
    }

    // 비동기 생성 시작
    this.generatingUsers.add(userId);

    this.generateDetailedReport(userId, true)
      .then(() => {
        console.log('[리포트] 비동기 생성 완료 - userId:', userId);
      })
      .catch((err) => {
        console.error('[리포트] 비동기 생성 실패:', err);
      })
      .finally(() => {
        this.generatingUsers.delete(userId);
      });

    return {
      status: 'generating',
      message: '리포트 생성이 시작되었습니다.',
      estimatedSeconds: 15,
    };
  }

  /** 리포트 생성 상태 확인 */
  async getReportStatus(userId: string) {
    // 생성 중인지 확인
    if (this.generatingUsers.has(userId)) {
      return { status: 'generating' };
    }

    // 리포트 존재 확인
    const { data: report } = await this.supabase.db
      .from('detailed_reports')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (report) {
      return {
        status: 'completed',
        reportId: report.id,
        createdAt: report.created_at,
      };
    }

    return { status: 'none' };
  }

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

  async generateDetailedReport(userId: string, isFree: boolean): Promise<string> {
    const profile = await this.financeService.getFullProfile(userId);
    const configMap = await this.constantsService.getConfigMap();
    const peerData = this.constantsService.getPeerData(configMap, profile.age);

    const report = await this.reportGenerator.generateDetailedReportV6(profile, configMap, peerData);

    const userSnapshot = {
      nickname: profile.nickname,
      age: profile.age,
      income: profile.monthlyIncome,
      fixedCost: profile.monthlyFixedCost,
      variableCost: profile.monthlyVariableCost,
      investment: profile.monthlyInvestment,
      surplus: profile.surplus,
      grade: profile.grade,
      retirementAge: profile.retirementAge,
      pensionStartAge: profile.pensionStartAge,
    };

    const { data: saved, error } = await this.supabase.db
      .from('detailed_reports')
      .insert({
        user_id: userId,
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
      throw new Error(`리포트 저장 실패: ${error.message}`);
    }

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

  // ========== 외부 URL 스크랩 ==========

  async createExternalScrap(userId: string, url: string) {
    // 같은 유저가 같은 URL을 이미 스크랩했는지 확인
    const { data: existing } = await this.supabase.db
      .from('external_scraps')
      .select('id, scrap_count')
      .eq('user_id', userId)
      .eq('url', url)
      .limit(1)
      .single();

    if (existing) {
      throw new BadRequestException('이미 스크랩한 URL입니다.');
    }

    // 전체 스크랩 횟수 (다른 유저 포함)
    const { count: globalCount } = await this.supabase.db
      .from('external_scraps')
      .select('id', { count: 'exact', head: true })
      .eq('url', url);

    const scrapCount = (globalCount || 0) + 1;

    const metadata = await this.scraperService.scrapeUrl(url);

    const { data: saved, error } = await this.supabase.db
      .from('external_scraps')
      .insert({
        user_id: userId,
        url,
        channel: metadata.channel,
        creator: metadata.creator,
        content_date: metadata.contentDate,
        title: metadata.title,
        body_text: metadata.bodyText ? metadata.bodyText.substring(0, 5000) : null,
        og_image_url: metadata.ogImageUrl,
        ai_summary: metadata.aiSummary,
        scrap_count: scrapCount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`스크랩 저장 실패: ${error.message}`);
    }

    return {
      id: saved!.id,
      url: saved!.url,
      channel: saved!.channel,
      creator: saved!.creator,
      contentDate: saved!.content_date,
      title: saved!.title,
      bodyText: saved!.body_text,
      ogImageUrl: saved!.og_image_url,
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
}
