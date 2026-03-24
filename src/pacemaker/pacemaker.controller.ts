import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PacemakerService } from './pacemaker.service.js';

@ApiTags('페이스메이커 / 홈')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('pacemaker')
export class PacemakerController {
  constructor(private readonly pacemakerService: PacemakerService) {}

  @Get('message')
  @ApiOperation({ summary: 'AI 페이스메이커 발화 생성' })
  @ApiResponse({ status: 200, description: '발화 생성 성공' })
  async getMessage(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.pacemakerService.generateMessage(userId);
  }

  @Get('badges')
  @ApiOperation({ summary: '이번 주 성과 뱃지 조회 (절약왕, 저축왕인)' })
  @ApiResponse({ status: 200, description: '뱃지 조회 성공' })
  async getBadges(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.pacemakerService.getWeeklyBadges(userId);
  }

  @Get('home')
  @ApiOperation({
    summary: '홈 대시보드 통합 API — 발화+뱃지+자산+목표를 한 번에',
  })
  @ApiResponse({ status: 200, description: '대시보드 조회 성공' })
  async getHomeDashboard(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.pacemakerService.getHomeDashboard(userId);
  }
}
