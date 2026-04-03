import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { BookService } from './book.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWeeklyReportDto } from './dto/create-weekly-report.dto';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { GenerateReportDto } from './dto/generate-report.dto';

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

  @Post('detailed-reports/generate')
  @HttpCode(HttpStatus.CREATED)
  async generateReport(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateReportDto,
  ) {
    return this.bookService.generateReportWithPayment(userId, dto.paymentToken);
  }

  @Get('detailed-reports/:id/download')
  async downloadReport(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const report = await this.bookService.getDetailedReportById(userId, id);
    // MVP: 마크다운 컨텐츠를 텍스트로 반환 (추후 PDF 생성 구현)
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.md"`);
    res.send(report.content);
  }

  // ========== 주간 리포트 ==========

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

  // ========== 금융 학습 ==========

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
  async toggleLearnScrap(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bookService.toggleLearnScrap(userId, id);
  }
}
