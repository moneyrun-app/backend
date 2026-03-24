import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CodefService } from './codef.service.js';
import { ConnectInstitutionDto } from './dto/connect-institution.dto.js';
import { GetTransactionsDto } from './dto/get-transactions.dto.js';

@ApiTags('코드에프 (MyData)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('codef')
export class CodefController {
  constructor(private readonly codefService: CodefService) {}

  @Post('connect')
  @ApiOperation({
    summary: '금융기관 연결 — 은행/카드사를 마이데이터에 연결',
  })
  @ApiResponse({ status: 201, description: '금융기관 연결 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async connectInstitution(
    @CurrentUser() userId: string,
    @Body() dto: ConnectInstitutionDto,
  ): Promise<Record<string, unknown>> {
    return this.codefService.connectInstitution(userId, dto);
  }

  @Get('institutions')
  @ApiOperation({ summary: '연결된 금융기관 목록 조회' })
  @ApiResponse({ status: 200, description: '금융기관 목록 조회 성공' })
  async getInstitutions(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.codefService.getInstitutions(userId);
  }

  @Delete('institutions/:id')
  @ApiOperation({ summary: '금융기관 연결 해제' })
  @ApiResponse({ status: 200, description: '연결 해제 성공' })
  async disconnectInstitution(
    @CurrentUser() userId: string,
    @Param('id') institutionId: string,
  ): Promise<{ message: string }> {
    await this.codefService.disconnectInstitution(userId, institutionId);
    return { message: '금융기관 연결이 해제되었습니다.' };
  }

  @Get('accounts')
  @ApiOperation({ summary: '연결된 은행 계좌 목록 조회' })
  @ApiResponse({ status: 200, description: '계좌 목록 조회 성공' })
  async getAccounts(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.codefService.getAccounts(userId);
  }

  @Get('cards')
  @ApiOperation({ summary: '연결된 카드 목록 조회' })
  @ApiResponse({ status: 200, description: '카드 목록 조회 성공' })
  async getCards(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.codefService.getCards(userId);
  }

  @Post('sync')
  @ApiOperation({
    summary: '거래 내역 수동 동기화 — 모든 계좌/카드의 신규 거래를 가져옴',
  })
  @ApiResponse({ status: 201, description: '동기화 성공' })
  @ApiResponse({ status: 404, description: '연결된 금융기관 없음' })
  async syncTransactions(
    @CurrentUser() userId: string,
  ): Promise<{ syncedCount: number; errors: string[] }> {
    return this.codefService.syncAllTransactions(userId);
  }

  @Get('transactions')
  @ApiOperation({
    summary: '거래 내역 조회 — 기간/카테고리/유형 필터 + 페이지네이션',
  })
  @ApiResponse({ status: 200, description: '거래 내역 조회 성공' })
  async getTransactions(
    @CurrentUser() userId: string,
    @Query() dto: GetTransactionsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    return this.codefService.getTransactions(userId, dto);
  }

  @Get('transactions/stats')
  @ApiOperation({ summary: '카테고리별 지출 통계 — 식비 21%, 카페 6% 등' })
  @ApiResponse({ status: 200, description: '통계 조회 성공' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-03-31' })
  async getTransactionStats(
    @CurrentUser() userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.codefService.getTransactionStats(userId, startDate, endDate);
  }

  @Put('transactions/:id/category')
  @ApiOperation({ summary: '거래 카테고리/태그 수동 수정' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateTransactionCategory(
    @CurrentUser() userId: string,
    @Param('id') transactionId: string,
    @Body() body: { category: string; tags: string[] },
  ): Promise<Record<string, unknown>> {
    return this.codefService.updateTransactionCategory(
      userId,
      transactionId,
      body.category,
      body.tags,
    );
  }

  @Get('asset-snapshot')
  @ApiOperation({
    summary: '자산 스냅샷 조회 — Day 0 잔액, 현재 자산, 추가 자산, 경과 일수',
  })
  @ApiResponse({ status: 200, description: '스냅샷 조회 성공' })
  @ApiResponse({ status: 404, description: '스냅샷 없음 (금융기관 미연결)' })
  async getAssetSnapshot(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.codefService.getAssetSnapshot(userId);
  }
}
