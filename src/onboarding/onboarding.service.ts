import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { OnboardingDto } from './dto/onboarding.dto';
import {
  calculateSurplus,
  calculateGoodSpendingTotal,
} from '../finance/surplus.calculator';
import { calculateGrade } from '../finance/grade.calculator';

@Injectable()
export class OnboardingService {
  constructor(private readonly supabase: SupabaseService) {}

  async completeOnboarding(userId: string, dto: OnboardingDto) {
    // 이미 온보딩 완료했는지 확인
    const { data: user } = await this.supabase.db
      .from('users')
      .select('has_completed_onboarding')
      .eq('id', userId)
      .single();

    if (user?.has_completed_onboarding) {
      throw new BadRequestException('이미 온보딩을 완료했습니다.');
    }

    // 1. finance_profiles 저장
    const { error: profileError } = await this.supabase.db
      .from('finance_profiles')
      .insert({
        user_id: userId,
        age: dto.age,
        monthly_income: dto.monthlyIncome,
      });

    if (profileError) {
      throw new Error(`재무 프로필 저장 실패: ${profileError.message}`);
    }

    // 2. good_spendings 저장
    if (dto.goodSpendings.length > 0) {
      const goodSpendingRows = dto.goodSpendings.map((g) => ({
        user_id: userId,
        type: g.type,
        label: g.label,
        amount: g.amount,
      }));

      const { error: gsError } = await this.supabase.db
        .from('good_spendings')
        .insert(goodSpendingRows);

      if (gsError) {
        throw new Error(`좋은 소비 저장 실패: ${gsError.message}`);
      }
    }

    // 3. fixed_expenses 저장
    const { error: feError } = await this.supabase.db
      .from('fixed_expenses')
      .insert({
        user_id: userId,
        rent: dto.fixedExpenses.rent,
        utilities: dto.fixedExpenses.utilities,
        phone: dto.fixedExpenses.phone,
      });

    if (feError) {
      throw new Error(`고정 소비 저장 실패: ${feError.message}`);
    }

    // 4. 온보딩 완료 표시
    await this.supabase.db
      .from('users')
      .update({ has_completed_onboarding: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    // 5. 잉여자금 계산 + 등급 판정
    const goodSpendingTotal = calculateGoodSpendingTotal(dto.goodSpendings);
    const surplus = calculateSurplus(
      dto.monthlyIncome,
      dto.goodSpendings,
      dto.fixedExpenses,
    );
    const grade = calculateGrade(dto.monthlyIncome, goodSpendingTotal);

    return { grade, surplus };
  }
}
