import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  CreateGoodSpendingDto,
  UpdateGoodSpendingDto,
} from './dto/good-spending.dto';
import { UpdateFixedExpensesDto } from './dto/update-fixed-expenses.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // --- 재무 프로필 ---

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.financeService.getFullProfile(userId);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.financeService.updateProfile(userId, dto);
  }

  // --- 좋은 소비 ---

  @Post('good-spendings')
  async createGoodSpending(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGoodSpendingDto,
  ) {
    return this.financeService.createGoodSpending(userId, dto);
  }

  @Patch('good-spendings/:id')
  async updateGoodSpending(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoodSpendingDto,
  ) {
    return this.financeService.updateGoodSpending(userId, id, dto);
  }

  @Delete('good-spendings/:id')
  async deleteGoodSpending(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.financeService.deleteGoodSpending(userId, id);
    return { message: '삭제되었습니다.' };
  }

  // --- 고정 소비 ---

  @Patch('fixed-expenses')
  async updateFixedExpenses(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFixedExpensesDto,
  ) {
    return this.financeService.updateFixedExpenses(userId, dto);
  }
}
