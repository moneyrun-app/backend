import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
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
  async getToday(@CurrentUser('id') userId: string) {
    return this.pacemakerService.getTodayMessage(userId);
  }

  @Post('actions/:id/complete')
  async completeAction(
    @CurrentUser('id') userId: string,
    @Param('id') actionId: string,
  ) {
    return this.pacemakerService.completeAction(userId, actionId);
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

  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.pacemakerService.getHistory(
      userId,
      parseInt(page),
      parseInt(limit),
    );
  }
}
