import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PacemakerService } from './pacemaker.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedbackDto } from './dto/feedback.dto';

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
}
