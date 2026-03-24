import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { OnboardingDto } from './dto/onboarding.dto.js';
import { SetBudgetDto } from './dto/budget.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@ApiTags('유저')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('onboarding')
  @ApiOperation({ summary: '온보딩 완료 — 기본 프로필 정보 저장' })
  @ApiResponse({ status: 201, description: '온보딩 성공' })
  @ApiResponse({ status: 409, description: '이미 온보딩을 완료한 유저' })
  async onboard(
    @CurrentUser() userId: string,
    @Body() dto: OnboardingDto,
  ): Promise<Record<string, unknown>> {
    return this.usersService.onboard(userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: '내 프로필 조회' })
  @ApiResponse({ status: 200, description: '프로필 조회 성공' })
  @ApiResponse({ status: 404, description: '프로필 없음 (온보딩 미완료)' })
  async getProfile(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: '프로필 수정' })
  @ApiResponse({ status: 200, description: '프로필 수정 성공' })
  async updateProfile(
    @CurrentUser() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<Record<string, unknown>> {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('budget')
  @ApiOperation({
    summary: '예산 설정 — 월 소득/고정비/저축 목표 → 일 예산 자동 계산',
  })
  @ApiResponse({ status: 201, description: '예산 설정 성공' })
  async setBudget(
    @CurrentUser() userId: string,
    @Body() dto: SetBudgetDto,
  ): Promise<Record<string, unknown>> {
    return this.usersService.setBudget(userId, dto);
  }

  @Get('budget')
  @ApiOperation({ summary: '현재 예산 조회' })
  @ApiResponse({ status: 200, description: '예산 조회 성공' })
  @ApiResponse({ status: 404, description: '예산 미설정' })
  async getBudget(
    @CurrentUser() userId: string,
  ): Promise<Record<string, unknown>> {
    return this.usersService.getBudget(userId);
  }
}
