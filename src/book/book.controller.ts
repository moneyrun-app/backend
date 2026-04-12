import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookService } from './book.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateScrapDto } from './dto/create-scrap.dto';

@Controller('book')
@UseGuards(JwtAuthGuard)
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // ========== AI 상세 리포트 ==========

  /** 리포트 생성 요청 (비동기) */
  @Post('detailed-reports/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateReport(@CurrentUser('id') userId: string) {
    return this.bookService.requestGenerateReport(userId);
  }

  /** 리포트 생성 상태 확인 */
  @Get('detailed-reports/status')
  async getReportStatus(@CurrentUser('id') userId: string) {
    return this.bookService.getReportStatus(userId);
  }

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
}
