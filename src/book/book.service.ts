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
import { MonthlyReportCollector } from './monthly-report.collector';
import { MonthlyReportGenerator } from './monthly-report.generator';
import { CreateMonthlyReportDto } from './dto/create-monthly-report.dto';

@Injectable()
export class BookService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly constantsService: ConstantsService,
    private readonly reportGenerator: ReportGenerator,
    private readonly scraperService: ScraperService,
    private readonly monthlyCollector: MonthlyReportCollector,
    private readonly monthlyGenerator: MonthlyReportGenerator,
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

  // ========== 월간 리포트 v2 ==========

  async getMonthlyReports(userId: string) {
    // 생성된 리포트
    const { data: reports } = await this.supabase.db
      .from('monthly_reports')
      .select('id, month, summary, badges_earned, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const createdItems = (reports || []).map((r: any) => ({
      id: r.id,
      month: this.fromMonthDate(r.month),
      summary: r.summary,
      status: 'created' as const,
      badgesEarned: r.badges_earned || [],
      createdAt: r.created_at,
    }));

    const createdMonths = new Set(createdItems.map(r => r.month));  // "YYYY-MM" 형식

    // 확정됨 + 리포트 미생성 + 소멸 안 됨 → pending
    const { data: finalizations } = await this.supabase.db
      .from('monthly_finalizations')
      .select('month, finalized_at')
      .eq('user_id', userId)
      .eq('expired', false);

    const pendingItems = (finalizations || [])
      .filter((f: any) => !createdMonths.has(f.month))
      .map((f: any) => ({
        id: null,
        month: f.month,
        summary: null,
        status: 'pending' as const,
        badgesEarned: [],
        createdAt: f.finalized_at,
      }));

    // 합치고 월 역순 정렬
    return [...createdItems, ...pendingItems]
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  async createMonthlyReport(userId: string, dto: CreateMonthlyReportDto) {
    const month = dto.month || this.getCurrentMonth();

    // 확정된 월에만 리포트 생성 가능
    const { data: finalization } = await this.supabase.db
      .from('monthly_finalizations')
      .select('id, expired')
      .eq('user_id', userId)
      .eq('month', month)
      .single();

    if (!finalization || finalization.expired) {
      throw new HttpException(
        '소비가 확정되지 않은 월입니다. 먼저 확정해주세요.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 이미 생성된 리포트 확인
    const { data: existingReport } = await this.supabase.db
      .from('monthly_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('month', this.toMonthDate(month))
      .single();

    if (existingReport) {
      throw new HttpException(
        '이미 해당 월 리포트가 생성되었습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. 데이터 수집 (소비, 제안 이행, 퀴즈, 배지)
    const reportData = await this.monthlyCollector.collect(
      userId,
      month,
      dto.proposalChecks || [],
    );

    // 2. AI narrative 생성
    const narratives = await this.monthlyGenerator.generateNarratives(
      reportData,
      { overallFeeling: dto.overallFeeling, memo: dto.memo },
    );

    // 3. 섹션 조립
    const sections = {
      spending: {
        ...reportData.spending,
        ai_narrative: narratives.spending,
      },
      proposals: {
        ...reportData.proposals,
        ai_narrative: narratives.proposals,
      },
      goals: {
        challenge: narratives.goals,
        badges: reportData.badges,
        ai_narrative: narratives.goals,
      },
      learning: {
        ...reportData.learning,
        ai_narrative: narratives.learning,
      },
      rewards: {
        earnedBadges: reportData.badges.filter(b => b.earned),
        levelUpKit: {
          available: reportData.learning.wrongNotes.length > 0,
          wrongQuizCount: reportData.learning.wrongNotes.length,
        },
        ai_narrative: narratives.rewards,
      },
    };

    // 4. 요약 생성
    const f = (n: number) => (Math.floor(n / 1000) * 1000).toLocaleString();
    const earnedCount = reportData.badges.filter(b => b.earned).length;
    const summary = `${month} 총 지출 ${f(reportData.spending.totalSpent)}원, FQ ${reportData.learning.fqScore}점, 배지 ${earnedCount}개 달성.`;

    // 5. DB 저장
    const { data: saved, error } = await this.supabase.db
      .from('monthly_reports')
      .insert({
        user_id: userId,
        month: this.toMonthDate(month),
        summary,
        guide: narratives.spending,  // 하위 호환용
        user_input: {
          overallFeeling: dto.overallFeeling,
          memo: dto.memo || null,
        },
        sections,
        badges_earned: reportData.badges.filter(b => b.earned).map(b => ({
          code: b.code,
          name: b.name,
          icon: b.icon,
        })),
        proposal_checks: dto.proposalChecks || [],
      })
      .select()
      .single();

    if (error) {
      throw new Error(`월간 리포트 저장 실패: ${error.message}`);
    }

    // 6. 스냅샷 저장 (다음달 전월 비교용)
    await this.monthlyCollector.saveSnapshot(userId, month, reportData);

    return {
      id: saved!.id,
      month: this.fromMonthDate(saved!.month),
      summary: saved!.summary,
      badgesEarned: saved!.badges_earned,
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
      month: this.fromMonthDate(data.month),
      summary: data.summary,
      sections: data.sections || {},
      badgesEarned: data.badges_earned || [],
      proposalChecks: data.proposal_checks || [],
      userInput: data.user_input,
      createdAt: data.created_at,
    };
  }

  /** 제안 항목 조회 (리포트 생성 전, 유저가 OX 체크할 목록) */
  async getProposalItems(userId: string) {
    return this.monthlyCollector.getProposalItems(userId);
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

  private getCurrentMonth(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /** DB의 month 컬럼이 DATE 타입이므로 "2026-01" → "2026-01-01" 변환 */
  private toMonthDate(month: string): string {
    return month.length === 7 ? `${month}-01` : month;
  }

  /** DB에서 읽은 DATE를 "YYYY-MM" 형식으로 변환 */
  private fromMonthDate(dateStr: string): string {
    return dateStr.substring(0, 7);
  }
}
