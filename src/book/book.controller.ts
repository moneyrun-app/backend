import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookService } from './book.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWeeklyReportDto } from './dto/create-weekly-report.dto';

@Controller('book')
@UseGuards(JwtAuthGuard)
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // --- 상세 리포트 ---

  @Get('detailed-reports')
  async getDetailedReports(@CurrentUser('id') userId: string) {
    return this.bookService.getDetailedReports(userId);
  }

  @Get('detailed-reports/:id')
  async getDetailedReport(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.getDetailedReportById(userId, id);
  }

  // --- 주간 리포트 ---

  @Get('weekly-reports')
  async getWeeklyReports(@CurrentUser('id') userId: string) {
    return this.bookService.getWeeklyReports(userId);
  }

  @Post('weekly-reports')
  @HttpCode(HttpStatus.CREATED)
  async createWeeklyReport(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWeeklyReportDto,
  ) {
    return this.bookService.createWeeklyReport(userId, dto);
  }

  @Get('weekly-reports/:id')
  async getWeeklyReport(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.getWeeklyReportById(userId, id);
  }

  // --- 금융 학습 ---

  @Get('learn')
  async getLearnContents(
    @CurrentUser('id') userId: string,
    @Query('grade') grade?: string,
  ) {
    return this.bookService.getLearnContents(userId, grade);
  }

  @Get('learn/:id')
  async getLearnContent(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.getLearnContentById(userId, id);
  }

  @Post('learn/:id/scrap')
  async toggleScrap(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.toggleScrap(userId, id);
  }

  // --- 스크랩 ---

  @Get('scraps')
  async getScraps(@CurrentUser('id') userId: string) {
    return this.bookService.getScraps(userId);
  }
}
