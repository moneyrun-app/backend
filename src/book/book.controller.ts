import {
  Controller,
  Get,
  Post,
  Delete,
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
import { CreateMonthlyReportDto } from './dto/create-monthly-report.dto';
import { CreateScrapDto } from './dto/create-scrap.dto';

@Controller('book')
@UseGuards(JwtAuthGuard)
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // ========== AI 상세 리포트 ==========

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

  // ========== 월간 리포트 v2 ==========

  @Get('monthly-reports')
  async getMonthlyReports(@CurrentUser('id') userId: string) {
    return this.bookService.getMonthlyReports(userId);
  }

  /** 제안 항목 조회 (리포트 생성 전, OX 체크용) */
  @Get('monthly-reports/proposals')
  async getProposalItems(@CurrentUser('id') userId: string) {
    return this.bookService.getProposalItems(userId);
  }

  @Post('monthly-reports')
  @HttpCode(HttpStatus.CREATED)
  async createMonthlyReport(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMonthlyReportDto,
  ) {
    return this.bookService.createMonthlyReport(userId, dto);
  }

  @Get('monthly-reports/:id')
  async getMonthlyReport(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.getMonthlyReportById(userId, id);
  }

  // ========== 외부 URL 스크랩 ==========

  @Post('scraps')
  @HttpCode(HttpStatus.CREATED)
  async createScrap(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateScrapDto,
  ) {
    return this.bookService.createExternalScrap(userId, dto.url);
  }

  @Get('scraps')
  async getScraps(@CurrentUser('id') userId: string) {
    return this.bookService.getExternalScraps(userId);
  }

  @Delete('scraps/:id')
  async deleteScrap(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.bookService.deleteExternalScrap(userId, id);
    return { message: '삭제되었습니다.' };
  }

  // ========== 학습 콘텐츠 ==========

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
  @HttpCode(HttpStatus.OK)
  async toggleLearnScrap(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.toggleLearnScrap(userId, id);
  }

}
