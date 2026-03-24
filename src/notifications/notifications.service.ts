import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { SupabaseService } from '../common/supabase/supabase.service.js';
import { GetNotificationsDto } from './dto/notifications.dto.js';

/** 알림 유형 */
export type NotificationType =
  | 'expense_alert'
  | 'badge_earned'
  | 'grade_changed'
  | 'scrap_summary'
  | 'community_like'
  | 'community_comment'
  | 'system';

/**
 * 알림 서비스.
 * 알림 생성, 조회, 읽음 처리를 담당한다.
 * 앱 출시 후 FCM/APNs 푸시 발송 연동 예정.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * 알림을 생성한다.
   * 다른 모듈에서 이벤트 발생 시 호출한다.
   * @param userId - 유저 ID
   * @param type - 알림 유형
   * @param title - 알림 제목
   * @param body - 알림 내용
   * @param data - 추가 데이터 (optional)
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { error } = await client.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: data ?? null,
    });

    if (error) {
      this.logger.error(`알림 생성 실패: ${error.message}`, undefined, 'NotificationsService');
      return; // 알림 실패는 메인 로직에 영향을 주지 않도록
    }

    // TODO: 앱 출시 후 FCM/APNs 푸시 발송 추가
    this.logger.log(`알림 생성: 유저=${userId}, 유형=${type}`, 'NotificationsService');
  }

  /**
   * 알림 목록을 조회한다.
   * @param userId - 유저 ID
   * @param dto - 조회 조건
   * @returns 알림 목록 + 전체 건수
   */
  async getNotifications(
    userId: string,
    dto: GetNotificationsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number; unreadCount: number }> {
    const client = this.supabaseService.getClient();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const { data, error, count } = await client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`알림 조회 실패: ${error.message}`, undefined, 'NotificationsService');
      throw error;
    }

    // 미읽은 알림 수
    const { count: unreadCount } = await client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return {
      data: (data ?? []) as Record<string, unknown>[],
      total: count ?? 0,
      unreadCount: unreadCount ?? 0,
    };
  }

  /**
   * 특정 알림을 읽음 처리한다.
   * @param userId - 유저 ID
   * @param notificationId - 알림 ID
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
  }

  /**
   * 모든 알림을 읽음 처리한다.
   * @param userId - 유저 ID
   */
  async markAllAsRead(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    await client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    this.logger.log(`전체 알림 읽음 처리: 유저=${userId}`, 'NotificationsService');
  }

  /**
   * 미읽은 알림 수를 조회한다.
   * @param userId - 유저 ID
   * @returns 미읽은 알림 수
   */
  async getUnreadCount(userId: string): Promise<number> {
    const client = this.supabaseService.getClient();

    const { count } = await client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return count ?? 0;
  }

  // ─────────────────────────────────────────────
  // 편의 메서드 — 다른 모듈에서 호출
  // ─────────────────────────────────────────────

  /**
   * 일 예산 초과 알림을 생성한다.
   */
  async notifyExpenseAlert(
    userId: string,
    spent: number,
    budget: number,
  ): Promise<void> {
    await this.create(
      userId,
      'expense_alert',
      '일 예산 초과',
      `오늘 ${spent.toLocaleString()}원을 지출해서 일 예산(${budget.toLocaleString()}원)을 초과했어요.`,
      { spent, budget },
    );
  }

  /**
   * 뱃지 획득 알림을 생성한다.
   */
  async notifyBadgeEarned(
    userId: string,
    badgeLabel: string,
  ): Promise<void> {
    await this.create(
      userId,
      'badge_earned',
      '뱃지 획득!',
      `${badgeLabel} 뱃지를 획득했어요! 🎉`,
      { badge: badgeLabel },
    );
  }

  /**
   * 등급 변화 알림을 생성한다.
   */
  async notifyGradeChanged(
    userId: string,
    previousGrade: string,
    newGrade: string,
  ): Promise<void> {
    const gradeNames: Record<string, string> = {
      red: '빨강(불난방)',
      yellow: '노랑(허리띠방)',
      green: '초록(투자방)',
    };

    await this.create(
      userId,
      'grade_changed',
      '신호등 등급 변화',
      `등급이 ${gradeNames[previousGrade] ?? previousGrade}에서 ${gradeNames[newGrade] ?? newGrade}(으)로 변경되었어요.`,
      { previousGrade, newGrade },
    );
  }
}
