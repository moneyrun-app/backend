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

    // 6개월 업데이트 유도
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const isStale = new Date(profile.updated_at) < sixMonthsAgo;

    // 최초 무료 리포트 사용 여부
    const { data: freeReport } = await this.supabase.db
      .from('detailed_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('is_free', true)
      .limit(1)
      .single();

    const canGenerateFreeReport = !freeReport;

    return {
      age: profile.age,
      monthlyIncome: profile.monthly_income,
      monthlyFixedCost: profile.monthly_fixed_cost,
      monthlyInvestment: profile.monthly_investment ?? 0,
      expectedReturn: profile.expected_return,
      investmentYears: profile.investment_years,
      grade: profile.grade,
      variableCost: {
        monthly: profile.variable_cost_monthly,
        weekly: profile.variable_cost_weekly,
        daily: profile.variable_cost_daily,
      },
      lastUpdated: profile.updated_at,
      isStale,
      canGenerateFreeReport,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // 현재 프로필 조회
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
    const monthlyInvestment = dto.monthlyInvestment ?? current.monthly_investment ?? 0;

    // 변동비 + 등급 재계산
    const variableCost = calculateVariableCost(monthlyIncome, monthlyFixedCost, monthlyInvestment);
    const grade = calculateGrade(monthlyIncome, variableCost.monthly);

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      variable_cost_monthly: variableCost.monthly,
      variable_cost_weekly: variableCost.weekly,
      variable_cost_daily: variableCost.daily,
      grade,
    };

    if (dto.age !== undefined) updateData.age = dto.age;
    if (dto.monthlyIncome !== undefined) updateData.monthly_income = dto.monthlyIncome;
    if (dto.monthlyFixedCost !== undefined) updateData.monthly_fixed_cost = dto.monthlyFixedCost;
    if (dto.monthlyInvestment !== undefined) updateData.monthly_investment = dto.monthlyInvestment;
    if (dto.expectedReturn !== undefined) updateData.expected_return = dto.expectedReturn;
    if (dto.investmentYears !== undefined) updateData.investment_years = dto.investmentYears;

    const { error } = await this.supabase.db
      .from('finance_profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`프로필 업데이트 실패: ${error.message}`);
    }

    // 최초 무료 리포트 사용 여부
    const { data: freeReport } = await this.supabase.db
      .from('detailed_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('is_free', true)
      .limit(1)
      .single();

    return {
      grade,
      variableCost,
      canGenerateFreeReport: !freeReport,
      reportPrice: 3900,
    };
  }
}
