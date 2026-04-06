import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { PeerQueryDto } from './dto/peer-query.dto';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('peers')
  getPeers(
    @Query(new ValidationPipe({ transform: true })) query: PeerQueryDto,
  ) {
    return this.statisticsService.getPeers(query.age, query.monthlyIncome);
  }
}
