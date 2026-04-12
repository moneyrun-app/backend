import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MoneyBookService } from './money-book.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  CreateMoneyBookDto,
  UpdateMoneyBookDto,
  CreateChapterDto,
  UpdateChapterDto,
} from './dto/create-money-book.dto';

@Controller('admin/money-book')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMoneyBookController {
  constructor(private readonly moneyBookService: MoneyBookService) {}

  /** 머니북 생성 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBook(@Body() dto: CreateMoneyBookDto) {
    return this.moneyBookService.createBook(dto);
  }

  /** 머니북 수정 */
  @Put(':id')
  async updateBook(
    @Param('id') id: string,
    @Body() dto: UpdateMoneyBookDto,
  ) {
    return this.moneyBookService.updateBook(id, dto);
  }

  /** 머니북 삭제 */
  @Delete(':id')
  async deleteBook(@Param('id') id: string) {
    return this.moneyBookService.deleteBook(id);
  }

  /** 챕터 생성 */
  @Post(':id/chapters')
  @HttpCode(HttpStatus.CREATED)
  async createChapter(
    @Param('id') bookId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.moneyBookService.createChapter(bookId, dto);
  }

  /** 챕터 수정 */
  @Put(':id/chapters/:cid')
  async updateChapter(
    @Param('id') bookId: string,
    @Param('cid') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.moneyBookService.updateChapter(bookId, chapterId, dto);
  }
}
