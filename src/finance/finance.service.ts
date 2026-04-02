import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  CreateGoodSpendingDto,
  UpdateGoodSpendingDto,
} from './dto/good-spending.dto';
import { UpdateFixedExpensesDto } from './dto/update-fixed-expenses.dto';
import {
  calculateSurplus,
  calculateGoodSpendingTotal,
  calculateFixedExpenseTotal,
  GoodSpending,
  FixedExpenses,
} from './surplus.calculator';
import { calculateGrade } from './grade.calculator';

@Injectable()
export class FinanceService {
  constructor(private readonly supabase: SupabaseService) {}

  async getFullProfile(userId: string) {
    // 병렬 조회
    const [profileRes, goodSpendingsRes, fixedExpensesRes] = await Promise.all([
      this.supabase.db
        .from('finance_profiles')
        .select('age, monthly_income')
        .eq('user_id', userId)
        .single(),
      this.supabase.db
        .from('good_spendings')
        .select('id, type, label, amount')
        .eq('user_id', userId),
      this.supabase.db
        .from('fixed_expenses')
        .select('rent, utilities, phone')
        .eq('user_id', userId)
        .single(),
    ]);

    if (!profileRes.data) {
      throw new NotFoundException('재무 프로필이 없습니다. 온보딩을 먼저 완료해주세요.');
    }

    const profile = profileRes.data;
    const goodSpendings: GoodSpending[] = goodSpendingsRes.data || [];
    const fixedExpenses: FixedExpenses = fixedExpensesRes.data || {
      rent: 0,
      utilities: 0,
      phone: 0,
    };

    const goodSpendingTotal = calculateGoodSpendingTotal(goodSpendings);
    const fixedExpenseTotal = calculateFixedExpenseTotal(fixedExpenses);
    const surplus = calculateSurplus(
      profile.monthly_income,
      goodSpendings,
      fixedExpenses,
    );
    const grade = calculateGrade(profile.monthly_income, goodSpendingTotal);

    return {
      age: profile.age,
      monthlyIncome: profile.monthly_income,
      grade,
      goodSpendings: (goodSpendingsRes.data || []).map((g: any) => ({
        id: g.id,
        type: g.type,
        label: g.label,
        amount: g.amount,
      })),
      goodSpendingTotal,
      fixedExpenses,
      fixedExpenseTotal,
      surplus,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.age !== undefined) updateData.age = dto.age;
    if (dto.monthlyIncome !== undefined)
      updateData.monthly_income = dto.monthlyIncome;

    const { error } = await this.supabase.db
      .from('finance_profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`프로필 업데이트 실패: ${error.message}`);
    }

    return this.getFullProfile(userId);
  }

  async createGoodSpending(userId: string, dto: CreateGoodSpendingDto) {
    const { data, error } = await this.supabase.db
      .from('good_spendings')
      .insert({
        user_id: userId,
        type: dto.type,
        label: dto.label,
        amount: dto.amount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`좋은 소비 추가 실패: ${error.message}`);
    }

    return {
      id: data.id,
      type: data.type,
      label: data.label,
      amount: data.amount,
    };
  }

  async updateGoodSpending(
    userId: string,
    id: string,
    dto: UpdateGoodSpendingDto,
  ) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.amount !== undefined) updateData.amount = dto.amount;

    const { data, error } = await this.supabase.db
      .from('good_spendings')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new NotFoundException('좋은 소비를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      type: data.type,
      label: data.label,
      amount: data.amount,
    };
  }

  async deleteGoodSpending(userId: string, id: string) {
    const { error } = await this.supabase.db
      .from('good_spendings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new NotFoundException('좋은 소비를 찾을 수 없습니다.');
    }
  }

  async updateFixedExpenses(userId: string, dto: UpdateFixedExpensesDto) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.rent !== undefined) updateData.rent = dto.rent;
    if (dto.utilities !== undefined) updateData.utilities = dto.utilities;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    const { error } = await this.supabase.db
      .from('fixed_expenses')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`고정 소비 업데이트 실패: ${error.message}`);
    }

    return this.getFullProfile(userId);
  }
}
