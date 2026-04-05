import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { calculateVariableCost } from './variable-cost.calculator';
import { calculateGrade } from './grade.calculator';

@Injectable()
export class FinanceService {
  constructor(private readonly supabase: SupabaseService) {}

  async getFullProfile(userId: string) {
    const { data: profile, error } = await this.supabase.db
      .from('finance_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('재무 프로필이 없습니다. 온보딩을 먼저 완료해주세요.');
    }

    // 닉네임 조회
    const { data: user } = await this.supabase.db
      .from('users')
      .select('nickname')
      .eq('id', userId)
      .single();

    // 6개월 업데이트 유도
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const isStale = new Date(profile.updated_at) < sixMonthsAgo;

    // 계산값
    const monthlyExpense = profile.monthly_fixed_cost + (profile.monthly_variable_cost || 0);
    const surplus = profile.monthly_income - monthlyExpense;
    const investmentPeriod = (profile.retirement_age || 55) - profile.age;
    const vestingPeriod = (profile.pension_start_age || 65) - (profile.retirement_age || 55);

    return {
      nickname: user?.nickname || null,
      age: profile.age,
      retirementAge: profile.retirement_age || 55,
      pensionStartAge: profile.pension_start_age || 65,
      monthlyIncome: profile.monthly_income,
      monthlyFixedCost: profile.monthly_fixed_cost,
      monthlyVariableCost: profile.monthly_variable_cost || 0,
      monthlyExpense,
      surplus,
      investmentPeriod,
      vestingPeriod,
      grade: profile.grade,
      variableCost: {
        monthly: profile.variable_cost_monthly,
        weekly: profile.variable_cost_weekly,
        daily: profile.variable_cost_daily,
        daysInMonth: profile.variable_cost_daily > 0
          ? Math.round(profile.variable_cost_monthly / profile.variable_cost_daily)
          : 30,
      },
      lastUpdated: profile.updated_at,
      isStale,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { data: current } = await this.supabase.db
      .from('finance_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!current) {
      throw new NotFoundException('재무 프로필이 없습니다.');
    }

    // 변경사항 적용
    const monthlyIncome = dto.monthlyIncome ?? current.monthly_income;
    const monthlyFixedCost = dto.monthlyFixedCost ?? current.monthly_fixed_cost;
    const monthlyVariableCost = dto.monthlyVariableCost ?? (current.monthly_variable_cost || 0);
    const retirementAge = dto.retirementAge ?? (current.retirement_age || 55);
    const pensionStartAge = dto.pensionStartAge ?? (current.pension_start_age || 65);
    const age = dto.age ?? current.age;

    // 재계산
    const monthlyExpense = monthlyFixedCost + monthlyVariableCost;
    const surplus = monthlyIncome - monthlyExpense;
    const grade = calculateGrade(monthlyIncome, monthlyExpense);
    const variableCost = calculateVariableCost(monthlyIncome, monthlyFixedCost);

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      variable_cost_monthly: variableCost.monthly,
      variable_cost_weekly: variableCost.weekly,
      variable_cost_daily: variableCost.daily,
      grade,
    };

    if (dto.age !== undefined) updateData.age = dto.age;
    if (dto.retirementAge !== undefined) updateData.retirement_age = dto.retirementAge;
    if (dto.pensionStartAge !== undefined) updateData.pension_start_age = dto.pensionStartAge;
    if (dto.monthlyIncome !== undefined) updateData.monthly_income = dto.monthlyIncome;
    if (dto.monthlyFixedCost !== undefined) updateData.monthly_fixed_cost = dto.monthlyFixedCost;
    if (dto.monthlyVariableCost !== undefined) updateData.monthly_variable_cost = dto.monthlyVariableCost;

    const { error } = await this.supabase.db
      .from('finance_profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`프로필 업데이트 실패: ${error.message}`);
    }

    // 닉네임 변경
    if (dto.nickname) {
      await this.supabase.db
        .from('users')
        .update({ nickname: dto.nickname, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    return {
      grade,
      monthlyExpense,
      surplus,
      investmentPeriod: retirementAge - age,
      vestingPeriod: pensionStartAge - retirementAge,
      variableCost,
    };
  }
}
