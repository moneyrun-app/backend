import {
  Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MybookService } from './mybook.service.js';
import { CreateScrapDto, GetScrapsDto, SetKeywordsDto } from './dto/mybook.dto.js';

@ApiTags('마이북')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('mybook')
export class MybookController {
  constructor(private readonly mybookService: MybookService) {}

  @Post('scraps')
  @ApiOperation({ summary: 'URL 스크랩 저장 — 채널 자동 판별 + AI 요약 비동기 생성' })
  @ApiResponse({ status: 201, description: '스크랩 저장 성공' })
  async createScrap(
    @CurrentUser() userId: string,
    @Body() dto: CreateScrapDto,
  ): Promise<Record<string, unknown>> {
    return this.mybookService.createScrap(userId, dto);
  }

  @Get('scraps')
  @ApiOperation({ summary: '스크랩 목록 조회 — 채널/검색 필터 + 페이지네이션' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getScraps(
    @CurrentUser() userId: string,
    @Query() dto: GetScrapsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    return this.mybookService.getScraps(userId, dto);
  }

  @Get('scraps/:id')
  @ApiOperation({ summary: '스크랩 상세 조회 — AI 요약 + 원본 URL' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getScrapDetail(
    @CurrentUser() userId: string,
    @Param('id') scrapId: string,
  ): Promise<Record<string, unknown>> {
    return this.mybookService.getScrapDetail(userId, scrapId);
  }

  @Delete('scraps/:id')
  @ApiOperation({ summary: '스크랩 삭제' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteScrap(
    @CurrentUser() userId: string,
    @Param('id') scrapId: string,
  ): Promise<{ message: string }> {
    await this.mybookService.deleteScrap(userId, scrapId);
    return { message: '스크랩이 삭제되었습니다.' };
  }

  @Post('scraps/:id/bookmark')
  @ApiOperation({ summary: '스크랩 북마크 토글 — 북마크하면 만료 없이 영구 보존' })
  @ApiResponse({ status: 201, description: '토글 성공' })
  async toggleBookmark(
    @CurrentUser() userId: string,
    @Param('id') scrapId: string,
  ): Promise<{ bookmarked: boolean }> {
    return this.mybookService.toggleBookmark(userId, scrapId);
  }

  @Post('keywords')
  @ApiOperation({ summary: '관심 키워드 설정 — 기존 키워드를 교체' })
  @ApiResponse({ status: 201, description: '설정 성공' })
  async setKeywords(
    @CurrentUser() userId: string,
    @Body() dto: SetKeywordsDto,
  ): Promise<string[]> {
    return this.mybookService.setKeywords(userId, dto);
  }

  @Get('keywords')
  @ApiOperation({ summary: '관심 키워드 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getKeywords(
    @CurrentUser() userId: string,
  ): Promise<string[]> {
    return this.mybookService.getKeywords(userId);
  }

  @Get('banner')
  @ApiOperation({ summary: '메인 배너 — 스크랩(A) + 추천(B) 교차 배치' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getBanner(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.mybookService.getBannerItems(userId);
  }
}
