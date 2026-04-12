import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MoneyBookService } from './money-book.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PurchaseBookDto } from './dto/purchase-book.dto';

@Controller('money-book')
@UseGuards(JwtAuthGuard)
export class MoneyBookController {
  constructor(private readonly moneyBookService: MoneyBookService) {}

  /** 출판된 머니북 목록 조회 */
  @Get()
  async listBooks(
    @CurrentUser('id') userId: string,
    @Query('category') category?: string,
  ) {
    return this.moneyBookService.listBooks(userId, category);
  }

  /** 머니북 상세 조회 */
  @Get(':id')
  async getBookDetail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.moneyBookService.getBookDetail(userId, id);
  }

  /** 머니북 구매 + AI 생성 시작 */
  @Post(':id/purchase')
  @HttpCode(HttpStatus.CREATED)
  async purchaseBook(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: PurchaseBookDto,
  ) {
    return this.moneyBookService.purchaseBook(userId, id, dto.extraData || {});
  }
}
