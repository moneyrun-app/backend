import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../common/supabase/supabase.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { calculateVariableCost } from '../finance/variable-cost.calculator';
import { calculateGrade } from '../finance/grade.calculator';
import { BookService } from '../book/book.service';

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly bookService: BookService,
  ) {}

  async kakaoLogin(accessToken: string) {
    let kakaoUser: KakaoUserInfo;
    try {
      kakaoUser = await this.getKakaoUserInfo(accessToken);
    } catch (e) {
      console.error('[auth] 카카오 유저 정보 조회 실패:', e);
      throw e;
    }

    let user: Record<string, unknown>;
    let isNewUser: boolean;
    try {
      const result = await this.findOrCreateUser(kakaoUser);
      user = result.user;
      isNewUser = result.isNewUser;
    } catch (e) {
      console.error('[auth] 유저 생성/조회 실패:', e);
      throw e;
    }

    const jwt = this.jwtService.sign({ sub: user.id, kakaoId: user.kakao_id });

    return {
      accessToken: jwt,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        isNewUser,
        hasCompletedOnboarding: user.has_completed_onboarding,
      },
    };
  }

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

    // 계산
    const pensionStartAge = dto.pensionStartAge ?? 65;
    const monthlyExpense = dto.monthlyFixedCost + dto.monthlyVariableCost;
    const surplus = dto.monthlyIncome - monthlyExpense;
    const investmentPeriod = dto.retirementAge - dto.age;
    const vestingPeriod = pensionStartAge - dto.retirementAge;
    const grade = calculateGrade(dto.monthlyIncome, monthlyExpense);
    const variableCost = calculateVariableCost(dto.monthlyIncome, dto.monthlyFixedCost);

    // finance_profiles 저장
    const { error: profileError } = await this.supabase.db
      .from('finance_profiles')
      .insert({
        user_id: userId,
        age: dto.age,
        retirement_age: dto.retirementAge,
        pension_start_age: pensionStartAge,
        monthly_income: dto.monthlyIncome,
        monthly_fixed_cost: dto.monthlyFixedCost,
        monthly_variable_cost: dto.monthlyVariableCost,
        variable_cost_monthly: variableCost.monthly,
        variable_cost_weekly: variableCost.weekly,
        variable_cost_daily: variableCost.daily,
        grade,
      });

    if (profileError) {
      throw new Error(`재무 프로필 저장 실패: ${profileError.message}`);
    }

    // 닉네임 + 온보딩 완료 표시
    await this.supabase.db
      .from('users')
      .update({
        nickname: dto.nickname,
        has_completed_onboarding: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 최초 무료 AI 상세 리포트 생성 (비동기)
    let firstReportId: string | null = null;
    try {
      firstReportId = await this.bookService.generateDetailedReport(userId, true);
    } catch {
      // 리포트 생성 실패해도 온보딩은 완료
    }

    return {
      grade,
      monthlyExpense,
      surplus,
      investmentPeriod,
      vestingPeriod,
      variableCost,
      firstReportId,
    };
  }

  private async getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('카카오 인증에 실패했습니다.');
    }

    return response.json();
  }

  private async findOrCreateUser(kakaoUser: KakaoUserInfo) {
    const kakaoId = kakaoUser.id; // bigint — 숫자 그대로 저장
    const nickname =
      kakaoUser.kakao_account?.profile?.nickname || `user_${kakaoId}`;
    const email = kakaoUser.kakao_account?.email || null;

    const { data: existingUser } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    if (existingUser) {
      return { user: existingUser, isNewUser: false };
    }

    const { data: newUser, error } = await this.supabase.db
      .from('users')
      .insert({ kakao_id: kakaoId, nickname, email })
      .select()
      .single();

    if (error) {
      throw new Error(`유저 생성 실패: ${error.message}`);
    }

    return { user: newUser, isNewUser: true };
  }
}
