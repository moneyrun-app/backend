import { Controller, Get, Post, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PacemakerService } from './pacemaker.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedbackDto } from './dto/feedback.dto';
import { CreateDailyCheckDto } from './dto/daily-check.dto';

@Controller('pacemaker')
@UseGuards(JwtAuthGuard)
export class PacemakerController {
  constructor(private readonly pacemakerService: PacemakerService) {}

  @Get('today')
  async getToday(
    @CurrentUser('id') userId: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.pacemakerService.getTodayMessage(userId, nickname);
  }

  @Post('feedback')
  async feedback(
    @CurrentUser('id') userId: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.pacemakerService.submitFeedback(userId, dto);
  }

  @Post('daily-check')
  async createDailyCheck(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDailyCheckDto,
  ) {
    return this.pacemakerService.createDailyCheck(userId, dto);
  }

  @Get('daily-checks')
  async getDailyChecks(
    @CurrentUser('id') userId: string,
    @Query('month') month: string, // 2026-04
  ) {
    return this.pacemakerService.getDailyChecks(userId, month);
  }

  @Get('weekly-summary')
  async getWeeklySummary(
    @CurrentUser('id') userId: string,
    @Query('date') date: string, // 2026-04-06
  ) {
    return this.pacemakerService.getWeeklySummary(userId, date);
  }

  // ========== 월간 소비 확정 ==========

  @Get('monthly-finalize-status')
  async getMonthlyFinalizeStatus(@CurrentUser('id') userId: string) {
    return this.pacemakerService.getMonthlyFinalizeStatus(userId);
  }

  @Post('monthly-finalize')
  @HttpCode(HttpStatus.OK)
  async finalizeMonth(
    @CurrentUser('id') userId: string,
    @Body('month') month: string,
  ) {
    return this.pacemakerService.finalizeMonth(userId, month);
  }

  @Post('monthly-finalize/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelFinalize(
    @CurrentUser('id') userId: string,
    @Body('month') month: string,
  ) {
    return this.pacemakerService.cancelFinalize(userId, month);
  }
}
