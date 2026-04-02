import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PacemakerService } from './pacemaker.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('pacemaker')
@UseGuards(JwtAuthGuard)
export class PacemakerController {
  constructor(private readonly pacemakerService: PacemakerService) {}

  @Get('today')
  async getToday(@CurrentUser('id') userId: string) {
    return this.pacemakerService.getTodayMessage(userId);
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
