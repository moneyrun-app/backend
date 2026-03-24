import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { SupabaseService } from '../common/supabase/supabase.service.js';
import { OnboardingDto } from './dto/onboarding.dto.js';
import { SetBudgetDto } from './dto/budget.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

/** 소득 그룹 enum */
export type IncomeGroup = 'basic' | 'middle' | 'high';

/**
 * 유저 프로필, 온보딩, 예산 관련 비즈니스 로직을 처리하는 서비스.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * 온보딩 정보를 저장한다.
   * 연소득 기반으로 소득 그룹을 자동 매핑하고, 예산도 함께 계산한다.
   * @param userId - Supabase 유저 ID
   * @param dto - 온보딩 요청 데이터
   * @returns 생성된 유저 프로필
   */
  async onboard(
    userId: string,
    dto: OnboardingDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 이미 온보딩한 유저인지 확인
    const { data: existing } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('이미 온보딩을 완료한 유저입니다.');
    }

    const incomeGroup = this.calculateIncomeGroup(dto.annualIncome);

    const { data, error } = await client
      .from('user_profiles')
      .insert({
        user_id: userId,
        nickname: dto.nickname,
        birth_year: dto.birthYear,
        residence: dto.residence,
        annual_income: dto.annualIncome,
        is_sme: dto.isSme,
        income_group: incomeGroup,
        goal_name: dto.goalName ?? null,
        goal_amount: dto.goalAmount ?? null,
        is_onboarded: true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`온보딩 저장 실패: ${error.message}`, undefined, 'UsersService');
      throw error;
    }

    this.logger.log(`유저 온보딩 완료: ${userId}`, 'UsersService');
    return data as Record<string, unknown>;
  }

  /**
   * 유저 프로필을 조회한다.
   * @param userId - Supabase 유저 ID
   * @returns 유저 프로필 데이터
   */
  async getProfile(userId: string): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      this.logger.error(`프로필 조회 실패: ${error.message}`, undefined, 'UsersService');
      throw error;
    }

    if (!data) {
      throw new NotFoundException('프로필을 찾을 수 없습니다. 온보딩을 먼저 완료해주세요.');
    }

    return data as Record<string, unknown>;
  }

  /**
   * 유저 프로필을 수정한다.
   * 연소득이 변경되면 소득 그룹도 재계산한다.
   * @param userId - Supabase 유저 ID
   * @param dto - 수정할 필드
   * @returns 수정된 유저 프로필
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const updateData: Record<string, unknown> = {};
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.residence !== undefined) updateData.residence = dto.residence;
    if (dto.annualIncome !== undefined) {
      updateData.annual_income = dto.annualIncome;
      updateData.income_group = this.calculateIncomeGroup(dto.annualIncome);
    }
    if (dto.isSme !== undefined) updateData.is_sme = dto.isSme;
    if (dto.goalName !== undefined) updateData.goal_name = dto.goalName;
    if (dto.goalAmount !== undefined) updateData.goal_amount = dto.goalAmount;

    const { data, error } = await client
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) {
      this.logger.error(`프로필 수정 실패: ${error.message}`, undefined, 'UsersService');
      throw error;
    }

    this.logger.log(`유저 프로필 수정: ${userId}`, 'UsersService');
    return data as Record<string, unknown>;
  }

  /**
   * 예산을 설정한다.
   * 월 예산 = 월 소득 - 고정비 - 저축 목표
   * 주간 예산 = 월 예산 ÷ 4, 일 예산 = 주간 예산 ÷ 7
   * @param userId - Supabase 유저 ID
   * @param dto - 예산 설정 요청 데이터
   * @returns 저장된 예산 데이터
   */
  async setBudget(
    userId: string,
    dto: SetBudgetDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const monthlyBudget =
      dto.monthlyIncome - dto.fixedExpenses - dto.savingsGoal;
    const weeklyBudget = Math.floor(monthlyBudget / 4);
    const dailyBudget = Math.floor(weeklyBudget / 7);

    const { data, error } = await client
      .from('user_budgets')
      .upsert(
        {
          user_id: userId,
          monthly_income: dto.monthlyIncome,
          fixed_expenses: dto.fixedExpenses,
          savings_goal: dto.savingsGoal,
          monthly_budget: monthlyBudget,
          weekly_budget: weeklyBudget,
          daily_budget: dailyBudget,
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) {
      this.logger.error(`예산 설정 실패: ${error.message}`, undefined, 'UsersService');
      throw error;
    }

    this.logger.log(
      `유저 예산 설정: ${userId} (일 예산: ${dailyBudget}원)`,
      'UsersService',
    );
    return data as Record<string, unknown>;
  }

  /**
   * 현재 예산을 조회한다.
   * @param userId - Supabase 유저 ID
   * @returns 예산 데이터
   */
  async getBudget(userId: string): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('user_budgets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`예산 조회 실패: ${error.message}`, undefined, 'UsersService');
      throw error;
    }

    if (!data) {
      throw new NotFoundException('예산이 설정되지 않았습니다.');
    }

    return data as Record<string, unknown>;
  }

  /**
   * 연소득(만원 단위)을 기반으로 소득 그룹을 결정한다.
   * 소득세 과세표준 구간 기준:
   * - 기본소득: 연소득 1,400만원 이하
   * - 중위소득: 1,400만원 초과 ~ 5,000만원 이하
   * - 고소득: 5,000만원 초과
   * @param annualIncome - 연소득 (만원 단위)
   * @returns 소득 그룹
   */
  private calculateIncomeGroup(annualIncome: number): IncomeGroup {
    if (annualIncome <= 1400) return 'basic';
    if (annualIncome <= 5000) return 'middle';
    return 'high';
  }
}
