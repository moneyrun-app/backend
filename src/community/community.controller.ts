import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CommunityService } from './community.service.js';
import {
  CreatePostDto, UpdatePostDto, CreateCommentDto, GetPostsDto,
} from './dto/community.dto.js';

@ApiTags('커뮤니티')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('info')
  @ApiOperation({ summary: '내 커뮤니티 배정 정보 조회 (방 이름, 글쓰기 권한)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiQuery({ name: 'incomeGroup', required: false })
  @ApiQuery({ name: 'signalGrade', required: false })
  async getCommunityInfo(
    @CurrentUser() userId: string,
    @Query('incomeGroup') incomeGroup?: string,
    @Query('signalGrade') signalGrade?: string,
  ): Promise<Record<string, unknown>> {
    return this.communityService.getCommunityInfo(userId, incomeGroup, signalGrade);
  }

  @Post('posts')
  @ApiOperation({ summary: '게시글 작성 — 소속 방에만 작성 가능' })
  @ApiResponse({ status: 201, description: '작성 성공' })
  async createPost(
    @CurrentUser() userId: string,
    @Body() dto: CreatePostDto,
  ): Promise<Record<string, unknown>> {
    return this.communityService.createPost(userId, dto);
  }

  @Get('posts')
  @ApiOperation({ summary: '게시글 목록 조회 — 방 필터 + 페이지네이션' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getPosts(
    @Query() dto: GetPostsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    return this.communityService.getPosts(dto);
  }

  @Put('posts/:id')
  @ApiOperation({ summary: '게시글 수정 — 본인 게시글만 수정 가능' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updatePost(
    @CurrentUser() userId: string,
    @Param('id') postId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<Record<string, unknown>> {
    return this.communityService.updatePost(userId, postId, dto);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: '게시글 삭제 — 본인 게시글만 삭제 가능' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deletePost(
    @CurrentUser() userId: string,
    @Param('id') postId: string,
  ): Promise<{ message: string }> {
    await this.communityService.deletePost(userId, postId);
    return { message: '게시글이 삭제되었습니다.' };
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: '좋아요 토글 — 이미 했으면 취소, 안 했으면 좋아요' })
  @ApiResponse({ status: 201, description: '토글 성공' })
  async toggleLike(
    @CurrentUser() userId: string,
    @Param('id') postId: string,
  ): Promise<{ liked: boolean }> {
    return this.communityService.toggleLike(userId, postId);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: '댓글 작성' })
  @ApiResponse({ status: 201, description: '작성 성공' })
  async createComment(
    @CurrentUser() userId: string,
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<Record<string, unknown>> {
    return this.communityService.createComment(userId, postId, dto);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: '댓글 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getComments(
    @Param('id') postId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.communityService.getComments(postId);
  }

  @Get('profile')
  @ApiOperation({ summary: '내 익명 프로필 조회 (없으면 자동 생성)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getAnonymousProfile(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.communityService.getOrCreateAnonymousProfile(userId);
  }

  @Get('top-creators')
  @ApiOperation({ summary: 'Top Creators 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async getTopCreators(
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.communityService.getTopCreators(
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
