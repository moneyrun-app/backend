import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MyBookService } from './my-book.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateHighlightDto } from './dto/create-highlight.dto';

@Controller('my-book')
@UseGuards(JwtAuthGuard)
export class MyBookController {
  constructor(private readonly myBookService: MyBookService) {}

  // ========== 마이북 개요 ==========

  @Get('overview')
  async getOverview(@CurrentUser('id') userId: string) {
    return this.myBookService.getOverview(userId);
  }

  // ========== 구매한 책 읽기 ==========

  @Get('books/:purchaseId')
  async getBook(
    @CurrentUser('id') userId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.myBookService.getBook(userId, purchaseId);
  }

  // ========== 하이라이트 추가 ==========

  @Post('books/:purchaseId/highlights')
  @HttpCode(HttpStatus.CREATED)
  async addHighlight(
    @CurrentUser('id') userId: string,
    @Param('purchaseId') purchaseId: string,
    @Body() dto: CreateHighlightDto,
  ) {
    return this.myBookService.addHighlight(userId, purchaseId, dto);
  }

  // ========== 하이라이트 삭제 ==========

  @Delete('highlights/:id')
  async deleteHighlight(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.myBookService.deleteHighlight(userId, id);
    return { message: '하이라이트가 삭제되었습니다.' };
  }

  // ========== 전체 하이라이트 조회 ==========

  @Get('highlights')
  async getAllHighlights(
    @CurrentUser('id') userId: string,
    @Query('color') color?: string,
  ) {
    return this.myBookService.getAllHighlights(userId, color);
  }

  // ========== 스크랩 통합 조회 ==========

  @Get('scraps')
  async getScraps(
    @CurrentUser('id') userId: string,
    @Query('type') type?: string,
  ) {
    return this.myBookService.getScraps(userId, type);
  }

  // ========== 스크랩 기반 책 생성 ==========

  @Post('generate-from-scraps')
  @HttpCode(HttpStatus.CREATED)
  async generateFromScraps(@CurrentUser('id') userId: string) {
    return this.myBookService.generateFromScraps(userId);
  }
}
