import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { GetNotificationsDto } from './dto/notifications.dto.js';

@ApiTags('알림')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: '알림 목록 조회 + 미읽은 수' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getNotifications(
    @CurrentUser() userId: string,
    @Query() dto: GetNotificationsDto,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    unreadCount: number;
  }> {
    return this.notificationsService.getNotifications(userId, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '미읽은 알림 수 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getUnreadCount(
    @CurrentUser() userId: string,
  ): Promise<{ unreadCount: number }> {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: '특정 알림 읽음 처리' })
  @ApiResponse({ status: 201, description: '읽음 처리 성공' })
  async markAsRead(
    @CurrentUser() userId: string,
    @Param('id') notificationId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAsRead(userId, notificationId);
    return { message: '읽음 처리되었습니다.' };
  }

  @Post('read-all')
  @ApiOperation({ summary: '모든 알림 읽음 처리' })
  @ApiResponse({ status: 201, description: '전체 읽음 처리 성공' })
  async markAllAsRead(
    @CurrentUser() userId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAllAsRead(userId);
    return { message: '모든 알림을 읽음 처리했습니다.' };
  }
}
