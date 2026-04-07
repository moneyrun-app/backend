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

  // ========== 금융 용어 사전 (선물) ==========

  @Get('glossary')
  async getGlossary(@CurrentUser('id') userId: string) {
    return this.bookService.getGlossary(userId);
  }

}
