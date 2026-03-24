import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase/supabase.service.js';
import { AiService } from '../ai/ai.service.js';
import { CreateScrapDto, GetScrapsDto, SetKeywordsDto } from './dto/mybook.dto.js';

/** 요약 최대 재시도 횟수 */
const MAX_SUMMARY_RETRIES = 3;

/**
 * 마이북 서비스.
 * 스크랩, AI 요약, 관심 키워드, 추천 콘텐츠, 배너를 담당한다.
 */
@Injectable()
export class MybookService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────────
  // 스크랩
  // ─────────────────────────────────────────────

  /**
   * URL을 스크랩한다.
   * 채널 자동 판별 → 메타데이터 추출 → AI 요약 비동기 시작.
   * @param userId - 유저 ID
   * @param dto - 스크랩 요청 데이터
   * @returns 생성된 스크랩
   */
  async createScrap(
    userId: string,
    dto: CreateScrapDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();
    const channel = this.detectChannel(dto.url);

    // 만료일 설정: 3개월 후 (추후 유료 구독이면 null)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    // 기존 요약 캐시 확인
    const { data: cached } = await client
      .from('summary_cache')
      .select('summary_short, summary_full')
      .eq('url', dto.url)
      .maybeSingle();

    const hasCachedSummary = !!cached;

    const { data, error } = await client
      .from('scraps')
      .insert({
        user_id: userId,
        url: dto.url,
        channel,
        source_method: dto.sourceMethod,
        content_title: this.extractTitleFromUrl(dto.url),
        summary_short: cached ? (cached as Record<string, unknown>).summary_short : null,
        summary_full: cached ? (cached as Record<string, unknown>).summary_full : null,
        summary_status: hasCachedSummary ? 'completed' : 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`스크랩 저장 실패: ${error.message}`, undefined, 'MybookService');
      throw error;
    }

    // 캐시가 없으면 비동기 요약 시작
    if (!hasCachedSummary) {
      this.generateSummaryAsync(
        (data as Record<string, unknown>).id as string,
        dto.url,
        channel,
      );
    }

    this.logger.log(`스크랩 저장: 유저=${userId}, 채널=${channel}`, 'MybookService');
    return data as Record<string, unknown>;
  }

  /**
   * 스크랩 목록을 조회한다.
   * @param userId - 유저 ID
   * @param dto - 조회 조건
   * @returns 스크랩 목록 + 전체 건수
   */
  async getScraps(
    userId: string,
    dto: GetScrapsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const client = this.supabaseService.getClient();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = client
      .from('scraps')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dto.channel) {
      query = query.eq('channel', dto.channel);
    }

    if (dto.search) {
      query = query.or(
        `content_title.ilike.%${dto.search}%,summary_short.ilike.%${dto.search}%,creator_name.ilike.%${dto.search}%`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`스크랩 조회 실패: ${error.message}`, undefined, 'MybookService');
      throw error;
    }

    return {
      data: (data ?? []) as Record<string, unknown>[],
      total: count ?? 0,
    };
  }

  /**
   * 스크랩 상세를 조회한다.
   * @param userId - 유저 ID
   * @param scrapId - 스크랩 ID
   * @returns 스크랩 상세
   */
  async getScrapDetail(
    userId: string,
    scrapId: string,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('scraps')
      .select('*')
      .eq('id', scrapId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      this.logger.error(`스크랩 상세 조회 실패: ${error.message}`, undefined, 'MybookService');
      throw error;
    }

    if (!data) {
      throw new NotFoundException('스크랩을 찾을 수 없습니다.');
    }

    return data as Record<string, unknown>;
  }

  /**
   * 스크랩을 삭제한다 (soft delete).
   */
  async deleteScrap(userId: string, scrapId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    await client
      .from('scraps')
      .update({ is_deleted: true })
      .eq('id', scrapId)
      .eq('user_id', userId);
  }

  /**
   * 스크랩을 북마크(영구 보존)한다.
   */
  async toggleBookmark(
    userId: string,
    scrapId: string,
  ): Promise<{ bookmarked: boolean }> {
    const client = this.supabaseService.getClient();

    const { data: scrap } = await client
      .from('scraps')
      .select('is_bookmarked')
      .eq('id', scrapId)
      .eq('user_id', userId)
      .single();

    const current = (scrap as Record<string, unknown>)?.is_bookmarked as boolean;
    const newValue = !current;

    await client
      .from('scraps')
      .update({
        is_bookmarked: newValue,
        expires_at: newValue ? null : undefined, // 북마크하면 만료 없음
      })
      .eq('id', scrapId)
      .eq('user_id', userId);

    return { bookmarked: newValue };
  }

  // ─────────────────────────────────────────────
  // 관심 키워드
  // ─────────────────────────────────────────────

  /**
   * 관심 키워드를 설정한다 (기존 것을 교체).
   */
  async setKeywords(userId: string, dto: SetKeywordsDto): Promise<string[]> {
    const client = this.supabaseService.getClient();

    // 기존 키워드 삭제
    await client.from('user_keywords').delete().eq('user_id', userId);

    // 새 키워드 저장
    if (dto.keywords.length > 0) {
      const rows = dto.keywords.map((keyword) => ({
        user_id: userId,
        keyword,
      }));

      await client.from('user_keywords').insert(rows);
    }

    return dto.keywords;
  }

  /**
   * 관심 키워드를 조회한다.
   */
  async getKeywords(userId: string): Promise<string[]> {
    const client = this.supabaseService.getClient();

    const { data } = await client
      .from('user_keywords')
      .select('keyword')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    return ((data ?? []) as { keyword: string }[]).map((d) => d.keyword);
  }

  // ─────────────────────────────────────────────
  // 배너
  // ─────────────────────────────────────────────

  /**
   * 메인 배너 목록을 조회한다.
   * 유저 스크랩(A)과 머니런 추천(B)을 교차 배치.
   * @param userId - 유저 ID
   * @returns 배너 목록
   */
  async getBannerItems(userId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    // (A) 최근 3개월 이내 스크랩
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: scraps } = await client
      .from('scraps')
      .select('id, url, content_title, thumbnail_url, channel')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('created_at', threeMonthsAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    // (B) 추천 콘텐츠
    const { data: recommendations } = await client
      .from('recommended_contents')
      .select('id, title, url, thumbnail_url, category')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    // 교차 배치
    const scrapList = (scraps ?? []) as Record<string, unknown>[];
    const recList = (recommendations ?? []) as Record<string, unknown>[];
    const banner: Record<string, unknown>[] = [];

    const maxLen = Math.max(scrapList.length, recList.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < scrapList.length) {
        banner.push({ ...scrapList[i], type: 'scrap' });
      }
      if (i < recList.length) {
        banner.push({ ...recList[i], type: 'recommendation' });
      }
    }

    return banner;
  }

  // ─────────────────────────────────────────────
  // 크론: 매일 자정 — 만료 스크랩 soft delete
  // ─────────────────────────────────────────────

  @Cron('10 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleExpiredScraps(): Promise<void> {
    const client = this.supabaseService.getClient();

    const now = new Date().toISOString();

    const { error } = await client
      .from('scraps')
      .update({ is_deleted: true })
      .eq('is_deleted', false)
      .eq('is_bookmarked', false)
      .lte('expires_at', now);

    if (error) {
      this.logger.error(`만료 스크랩 처리 실패: ${error.message}`, undefined, 'MybookService');
    } else {
      this.logger.log('만료 스크랩 soft delete 완료', 'MybookService');
    }
  }

  // ─────────────────────────────────────────────
  // 순수 헬퍼 메서드
  // ─────────────────────────────────────────────

  /**
   * URL에서 채널을 자동 판별한다.
   * @param url - 콘텐츠 URL
   * @returns 채널 종류
   */
  detectChannel(url: string): 'youtube' | 'threads' | 'etc' {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('threads.net')) return 'threads';
    return 'etc';
  }

  /**
   * URL에서 간단한 제목을 추출한다.
   * (실제로는 메타데이터 크롤링이 필요하지만 MVP에서는 도메인명 사용)
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url.substring(0, 100);
    }
  }

  /**
   * 스크랩의 AI 요약을 비동기로 생성한다.
   */
  private async generateSummaryAsync(
    scrapId: string,
    url: string,
    channel: string,
  ): Promise<void> {
    try {
      const systemPrompt = `너는 콘텐츠 요약 전문가야. 주어진 URL의 콘텐츠를 요약해줘.
짧은 요약(1~2줄)과 상세 요약(3~5줄)을 JSON으로 반환해.
형식: {"short": "짧은 요약", "full": "상세 요약"}`;

      const userMessage = `이 ${channel} 콘텐츠를 요약해줘: ${url}`;

      const response = await this.aiService.generateText(systemPrompt, userMessage, 500);

      let summaryShort = response.content;
      let summaryFull = response.content;

      try {
        const parsed = JSON.parse(response.content) as { short: string; full: string };
        summaryShort = parsed.short;
        summaryFull = parsed.full;
      } catch {
        // JSON 파싱 실패 시 전체를 요약으로 사용
      }

      const client = this.supabaseService.getClient();

      await client
        .from('scraps')
        .update({
          summary_short: summaryShort,
          summary_full: summaryFull,
          summary_status: 'completed',
        })
        .eq('id', scrapId);

      // 캐시에도 저장
      await client.from('summary_cache').upsert(
        { url, summary_short: summaryShort, summary_full: summaryFull },
        { onConflict: 'url' },
      );
    } catch (err) {
      this.logger.error(`요약 생성 실패: ${(err as Error).message}`, undefined, 'MybookService');

      const client = this.supabaseService.getClient();

      // 재시도 횟수 증가
      const { data: scrap } = await client
        .from('scraps')
        .select('summary_retry_count')
        .eq('id', scrapId)
        .single();

      const retryCount = ((scrap as Record<string, unknown>)?.summary_retry_count as number) ?? 0;

      await client
        .from('scraps')
        .update({
          summary_retry_count: retryCount + 1,
          summary_status: retryCount + 1 >= MAX_SUMMARY_RETRIES ? 'failed' : 'pending',
        })
        .eq('id', scrapId);
    }
  }
}
