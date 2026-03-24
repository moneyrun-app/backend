import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { SignalService } from './signal.service.js';

@ApiTags('신호등 시스템')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('signal')
export class SignalController {
  constructor(private readonly signalService: SignalService) {}

  @Get('grade')
  @ApiOperation({ summary: '현재 신호등 등급 조회 (빨/노/초)' })
  @ApiResponse({ status: 200, description: '등급 조회 성공' })
  async getGrade(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.signalService.getGrade(userId);
  }

  @Get('history')
  @ApiOperation({ summary: '신호등 등급 변화 이력 조회' })
  @ApiResponse({ status: 200, description: '이력 조회 성공' })
  async getGradeHistory(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.signalService.getGradeHistory(userId);
  }

  @Post('evaluate')
  @ApiOperation({ summary: '신호등 등급 수동 재평가 (디버그용)' })
  @ApiResponse({ status: 201, description: '평가 완료' })
  async evaluateGrade(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.signalService.evaluateGrade(userId);
  }
}
