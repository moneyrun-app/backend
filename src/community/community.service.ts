import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase/supabase.service.js';
import { CreatePostDto, UpdatePostDto, CreateCommentDto, GetPostsDto } from './dto/community.dto.js';

/** 익명 닉네임 형용사 목록 */
const ADJECTIVES = [
  '빠른', '느긋한', '부지런한', '씩씩한', '재빠른', '든든한',
  '현명한', '당당한', '용감한', '차분한', '꼼꼼한', '활발한',
];

/** 익명 닉네임 명사 목록 */
const NOUNS = [
  '러너', '다람쥐', '고양이', '펭귄', '코끼리', '부엉이',
  '여우', '사자', '토끼', '돌고래', '판다', '호랑이',
];

/**
 * 커뮤니티 비즈니스 로직 서비스.
 * 게시글 CRUD, 좋아요, 댓글, 익명 프로필, 트렌딩, Top Creators를 담당한다.
 */
@Injectable()
export class CommunityService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────────
  // 게시글 CRUD
  // ─────────────────────────────────────────────

  /**
   * 게시글을 작성한다.
   * 유저의 소득 그룹 + 신호등 등급으로 방을 자동 배정한다.
   * @param userId - 유저 ID
   * @param dto - 게시글 내용
   * @returns 생성된 게시글
   */
  async createPost(
    userId: string,
    dto: CreatePostDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 유저의 소득 그룹 + 신호등 등급 조회
    const { incomeGroup, signalGrade } = await this.getUserRoom(userId);

    // 태그 자동 추출
    const tags = this.extractTags(dto.content);

    const { data, error } = await client
      .from('community_posts')
      .insert({
        user_id: userId,
        income_group: incomeGroup,
        signal_grade: signalGrade,
        content: dto.content,
        tags,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`게시글 작성 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    this.logger.log(`게시글 작성: 유저=${userId}`, 'CommunityService');
    return data as Record<string, unknown>;
  }

  /**
   * 게시글 목록을 조회한다.
   * @param dto - 조회 조건 (소득 그룹, 신호등 등급, 페이지네이션)
   * @returns 게시글 목록 + 전체 건수
   */
  async getPosts(
    dto: GetPostsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const client = this.supabaseService.getClient();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = client
      .from('community_posts')
      .select('*, anonymous_profiles(anonymous_nickname, avatar_index)', {
        count: 'exact',
      })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dto.incomeGroup) {
      query = query.eq('income_group', dto.incomeGroup);
    }
    if (dto.signalGrade) {
      query = query.eq('signal_grade', dto.signalGrade);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`게시글 조회 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    return {
      data: (data ?? []) as Record<string, unknown>[],
      total: count ?? 0,
    };
  }

  /**
   * 게시글을 수정한다. 본인 게시글만 수정 가능.
   * @param userId - 유저 ID
   * @param postId - 게시글 ID
   * @param dto - 수정 내용
   * @returns 수정된 게시글
   */
  async updatePost(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();
    const tags = this.extractTags(dto.content);

    const { data, error } = await client
      .from('community_posts')
      .update({ content: dto.content, tags })
      .eq('id', postId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      this.logger.error(`게시글 수정 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    return data as Record<string, unknown>;
  }

  /**
   * 게시글을 삭제한다 (soft delete). 본인 게시글만 삭제 가능.
   * @param userId - 유저 ID
   * @param postId - 게시글 ID
   */
  async deletePost(userId: string, postId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('community_posts')
      .update({ is_deleted: true })
      .eq('id', postId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`게시글 삭제 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // 좋아요
  // ─────────────────────────────────────────────

  /**
   * 게시글에 좋아요를 토글한다.
   * 이미 좋아요 → 취소, 아직 안 했으면 → 좋아요.
   * @param userId - 유저 ID
   * @param postId - 게시글 ID
   * @returns 좋아요 상태 (liked: true/false)
   */
  async toggleLike(
    userId: string,
    postId: string,
  ): Promise<{ liked: boolean }> {
    const client = this.supabaseService.getClient();

    // 기존 좋아요 확인
    const { data: existing } = await client
      .from('community_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (existing) {
      // 좋아요 취소
      await client
        .from('community_likes')
        .delete()
        .eq('id', (existing as Record<string, unknown>).id);

      await this.updateLikeCount(postId, -1);
      return { liked: false };
    } else {
      // 좋아요
      await client
        .from('community_likes')
        .insert({ user_id: userId, post_id: postId });

      await this.updateLikeCount(postId, 1);
      return { liked: true };
    }
  }

  // ─────────────────────────────────────────────
  // 댓글
  // ─────────────────────────────────────────────

  /**
   * 게시글에 댓글을 작성한다.
   * @param userId - 유저 ID
   * @param postId - 게시글 ID
   * @param dto - 댓글 내용
   * @returns 생성된 댓글
   */
  async createComment(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('community_comments')
      .insert({
        user_id: userId,
        post_id: postId,
        content: dto.content,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`댓글 작성 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    // 게시글 댓글 수 증가
    await this.updateCommentCount(postId, 1);

    return data as Record<string, unknown>;
  }

  /**
   * 게시글의 댓글 목록을 조회한다.
   * @param postId - 게시글 ID
   * @returns 댓글 배열
   */
  async getComments(postId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('community_comments')
      .select('*, anonymous_profiles(anonymous_nickname, avatar_index)')
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`댓글 조회 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  // ─────────────────────────────────────────────
  // 익명 프로필
  // ─────────────────────────────────────────────

  /**
   * 유저의 익명 프로필을 조회하거나, 없으면 자동 생성한다.
   * @param userId - 유저 ID
   * @returns 익명 프로필
   */
  async getOrCreateAnonymousProfile(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data: existing } = await client
      .from('anonymous_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return existing as Record<string, unknown>;

    const nickname = this.generateAnonymousNickname();
    const avatarIndex = Math.floor(Math.random() * 12);

    const { data, error } = await client
      .from('anonymous_profiles')
      .insert({
        user_id: userId,
        anonymous_nickname: nickname,
        avatar_index: avatarIndex,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`익명 프로필 생성 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    return data as Record<string, unknown>;
  }

  // ─────────────────────────────────────────────
  // Top Creators
  // ─────────────────────────────────────────────

  /**
   * Top Creators 목록을 조회한다.
   * @param limit - 상위 N명
   * @returns Top Creators 목록
   */
  async getTopCreators(
    limit: number = 10,
  ): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('top_creators')
      .select('*, anonymous_profiles(anonymous_nickname, avatar_index)')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Top Creators 조회 실패: ${error.message}`, undefined, 'CommunityService');
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * 매일 자정에 Top Creators를 재산정한다.
   * 점수 = 게시글 수×1 + 받은 좋아요×2 + 받은 댓글×3
   */
  @Cron('5 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleTopCreatorsCalculation(): Promise<void> {
    this.logger.log('Top Creators 재산정 시작', 'CommunityService');

    const client = this.supabaseService.getClient();

    // 최근 30일 기준
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    // 최근 30일 게시글이 있는 유저 조회
    const { data: posts } = await client
      .from('community_posts')
      .select('user_id, like_count, comment_count')
      .eq('is_deleted', false)
      .gte('created_at', since);

    if (!posts || posts.length === 0) return;

    // 유저별 집계
    const userStats = new Map<
      string,
      { postCount: number; totalLikes: number; totalComments: number }
    >();

    for (const post of posts as {
      user_id: string;
      like_count: number;
      comment_count: number;
    }[]) {
      const stats = userStats.get(post.user_id) ?? {
        postCount: 0,
        totalLikes: 0,
        totalComments: 0,
      };
      stats.postCount++;
      stats.totalLikes += post.like_count;
      stats.totalComments += post.comment_count;
      userStats.set(post.user_id, stats);
    }

    // 점수 계산 및 저장
    for (const [userId, stats] of userStats) {
      const score = this.calculateCreatorScore(
        stats.postCount,
        stats.totalLikes,
        stats.totalComments,
      );

      await client.from('top_creators').upsert(
        {
          user_id: userId,
          post_count: stats.postCount,
          total_likes: stats.totalLikes,
          total_comments: stats.totalComments,
          score,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    }

    this.logger.log(
      `Top Creators 재산정 완료: ${userStats.size}명`,
      'CommunityService',
    );
  }

  /**
   * 매시간 트렌딩 게시글을 판정한다.
   * 최근 24시간 내 좋아요+댓글이 10 이상인 게시글을 트렌딩으로 표시.
   */
  @Cron('0 * * * *', { timeZone: 'Asia/Seoul' })
  async handleTrendingDetection(): Promise<void> {
    const client = this.supabaseService.getClient();

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const since = twentyFourHoursAgo.toISOString();

    // 기존 트렌딩 해제
    await client
      .from('community_posts')
      .update({ is_trending: false })
      .eq('is_trending', true);

    // 새 트렌딩 판정 (좋아요+댓글 합 >= 10)
    const { data: hotPosts } = await client
      .from('community_posts')
      .select('id, like_count, comment_count')
      .eq('is_deleted', false)
      .gte('created_at', since);

    if (!hotPosts) return;

    const trendingIds = (
      hotPosts as { id: string; like_count: number; comment_count: number }[]
    )
      .filter((p) => p.like_count + p.comment_count >= 10)
      .map((p) => p.id);

    if (trendingIds.length > 0) {
      await client
        .from('community_posts')
        .update({ is_trending: true })
        .in('id', trendingIds);
    }
  }

  // ─────────────────────────────────────────────
  // 커뮤니티 배정 정보
  // ─────────────────────────────────────────────

  /**
   * 유저의 소속 커뮤니티(방) 정보를 조회한다.
   * 소속 방에서만 글 작성/수정/삭제 가능, 비소속 방은 조회/좋아요/댓글만 가능.
   * @param userId - 유저 ID
   * @returns 커뮤니티 정보 (소득 그룹, 신호등 등급, 방 이름, 글쓰기 권한)
   */
  async getCommunityInfo(
    userId: string,
    targetIncomeGroup?: string,
    targetSignalGrade?: string,
  ): Promise<Record<string, unknown>> {
    const { incomeGroup, signalGrade } = await this.getUserRoom(userId);
    const roomName = this.getRoomName(signalGrade);

    const canWrite =
      (!targetIncomeGroup || targetIncomeGroup === incomeGroup) &&
      (!targetSignalGrade || targetSignalGrade === signalGrade);

    return {
      incomeGroup,
      signalGrade,
      roomName,
      canWrite,
    };
  }

  // ─────────────────────────────────────────────
  // 순수 헬퍼 메서드
  // ─────────────────────────────────────────────

  /**
   * Top Creator 점수를 계산한다.
   * 게시글 수×1 + 좋아요×2 + 댓글×3
   */
  calculateCreatorScore(
    postCount: number,
    totalLikes: number,
    totalComments: number,
  ): number {
    return postCount * 1 + totalLikes * 2 + totalComments * 3;
  }

  /**
   * 게시글 내용에서 키워드 태그를 추출한다.
   * 한글 명사 위주로 2글자 이상 단어를 추출. 최소 3개 ~ 최대 15개.
   * @param content - 게시글 내용
   * @returns 태그 배열
   */
  extractTags(content: string): string[] {
    // 한글 2글자 이상 단어 추출
    const words = content.match(/[가-힣]{2,}/g) ?? [];
    // 불용어 제거
    const stopWords = new Set([
      '이것', '저것', '그것', '이번', '하지만', '그리고', '그래서',
      '그런데', '그러나', '때문에', '대해서', '위해서', '통해서',
    ]);
    const unique = [...new Set(words.filter((w) => !stopWords.has(w)))];
    // 3개~15개 반환
    return unique.slice(0, 15).length >= 3
      ? unique.slice(0, 15)
      : unique.slice(0, Math.max(unique.length, 0));
  }

  /**
   * 익명 닉네임을 생성한다.
   * "형용사 + 명사 + 숫자" 형태.
   * @returns 랜덤 익명 닉네임
   */
  generateAnonymousNickname(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${noun}${num}`;
  }

  /**
   * 신호등 등급에 해당하는 커뮤니티 방 이름을 반환한다.
   * @param grade - 신호등 등급
   * @returns 방 이름
   */
  getRoomName(grade: string): string {
    const names: Record<string, string> = {
      red: '불난방',
      yellow: '허리띠방',
      green: '투자방',
    };
    return names[grade] ?? '미배정';
  }

  /**
   * 유저의 소득 그룹과 신호등 등급을 조회한다.
   * 신호등 등급이 없으면 기본값 yellow를 사용한다.
   */
  private async getUserRoom(
    userId: string,
  ): Promise<{ incomeGroup: string; signalGrade: string }> {
    const client = this.supabaseService.getClient();

    const { data: profile } = await client
      .from('user_profiles')
      .select('income_group')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();

    const incomeGroup = profile
      ? ((profile as Record<string, unknown>).income_group as string)
      : 'middle';

    const { data: signal } = await client
      .from('signal_grades')
      .select('grade')
      .eq('user_id', userId)
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const signalGrade = signal
      ? ((signal as Record<string, unknown>).grade as string)
      : 'yellow';

    return { incomeGroup, signalGrade };
  }

  /** 게시글 좋아요 수 업데이트 */
  private async updateLikeCount(
    postId: string,
    delta: number,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: post } = await client
      .from('community_posts')
      .select('like_count')
      .eq('id', postId)
      .single();

    if (post) {
      const currentCount = (post as Record<string, unknown>).like_count as number;
      await client
        .from('community_posts')
        .update({ like_count: Math.max(0, currentCount + delta) })
        .eq('id', postId);
    }
  }

  /** 게시글 댓글 수 업데이트 */
  private async updateCommentCount(
    postId: string,
    delta: number,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: post } = await client
      .from('community_posts')
      .select('comment_count')
      .eq('id', postId)
      .single();

    if (post) {
      const currentCount = (post as Record<string, unknown>).comment_count as number;
      await client
        .from('community_posts')
        .update({ comment_count: Math.max(0, currentCount + delta) })
        .eq('id', postId);
    }
  }
}
