import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { BlocksService } from './blocks.service.js';
import { GetBlocksDto } from './dto/get-blocks.dto.js';

@ApiTags('소비 블록')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get('calendar')
  @ApiOperation({
    summary: '블록 캘린더 조회 — 일별/주별/월별 블록 + 집계 통계',
  })
  @ApiResponse({ status: 200, description: '블록 캘린더 조회 성공' })
  async getBlockCalendar(
    @CurrentUser() userId: string,
    @Query() dto: GetBlocksDto,
  ): Promise<Record<string, unknown>> {
    return this.blocksService.getBlockCalendar(userId, dto.year, dto.month);
  }

  @Get('weekly-remaining')
  @ApiOperation({ summary: '이번 주 잔여 예산 조회' })
  @ApiResponse({ status: 200, description: '잔여 예산 조회 성공' })
  async getWeeklyBudgetRemaining(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.blocksService.getWeeklyBudgetRemaining(userId);
  }

  @Get('running-speed')
  @ApiOperation({
    summary: '러닝 속도 조회 — (알뜰일수/전체일수)×100 + 전월 대비 변화율',
  })
  @ApiResponse({ status: 200, description: '러닝 속도 조회 성공' })
  async getRunningSpeed(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.blocksService.getRunningSpeed(userId);
  }
}
