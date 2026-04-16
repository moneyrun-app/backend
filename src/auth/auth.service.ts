import { Injectable, Inject, forwardRef, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../common/supabase/supabase.service';
import { BookService } from '../book/book.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { PreOnboardingDto } from './dto/pre-onboarding.dto';
import { calculateVariableCost } from '../finance/variable-cost.calculator';
import { calculateGrade } from '../finance/grade.calculator';

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
    @Inject(forwardRef(() => BookService))
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
        onboardingVersion: user.onboarding_version ?? 2,
      },
    };
  }

  // ========== 로그인 전 온보딩 미리보기 (DB 저장 없음) ==========

  calculatePreOnboardingPreview(dto: PreOnboardingDto) {
    const floor1000 = (n: number) => Math.floor(n / 1000) * 1000;

    // 고정비는 투자금 포함. 등급 계산 시 투자금 제외
    const monthlyExpenseForGrade = (dto.monthlyFixedCost - dto.monthlyInvestment) + dto.monthlyVariableCost;
    const surplus = dto.monthlyIncome - dto.monthlyFixedCost - dto.monthlyVariableCost;
    const grade = calculateGrade(dto.monthlyIncome, monthlyExpenseForGrade);
    const variableCost = calculateVariableCost(dto.monthlyIncome, dto.monthlyFixedCost);

    const investmentPeriod = dto.retirementAge - dto.age;
    const pensionGapYears = dto.pensionStartAge - dto.retirementAge;
    const monthlySaving = Math.max(surplus, 0);

    // 등급별 라벨
    const gradeLabels: Record<string, string> = {
      RED: '소비케어 집중',
      YELLOW: '투자준비',
      GREEN: '투자실습',
    };

    // 현재 탭
    const fixedCostRatio = dto.monthlyIncome > 0
      ? Math.round(dto.monthlyFixedCost / dto.monthlyIncome * 100) : 0;
    const expenseRatio = dto.monthlyIncome > 0
      ? Math.round(monthlyExpenseForGrade / dto.monthlyIncome * 100) : 0;

    // 미래 탭 — 3가지 수익률 시나리오
    const rates = [
      { label: '예적금 3%', rate: 3 },
      { label: 'KOSPI 7%', rate: 7 },
      { label: 'S&P500 10%', rate: 10 },
    ];

    const months = Math.max(investmentPeriod, 0) * 12;
    const pensionMonths = Math.max(pensionGapYears + 20, 20) * 12;

    const estimatedSavings = rates.map(({ label, rate }) => {
      const monthlyRate = rate / 100 / 12;
      let futureAsset: number;
      if (monthlyRate === 0 || months === 0) {
        futureAsset = monthlySaving * months;
      } else {
        futureAsset = monthlySaving * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      }
      if (pensionGapYears > 0 && monthlyRate > 0) {
        futureAsset = futureAsset * Math.pow(1 + monthlyRate, pensionGapYears * 12);
      }
      futureAsset = floor1000(futureAsset);
      const monthlyPension = floor1000(futureAsset / pensionMonths);
      return { label, futureAsset, monthlyPension };
    });

    // 행동 탭 — 등급별 행동 가이드
    const gradeActions: Record<string, string> = {
      RED: '매달 고정비를 점검하고, 불필요한 구독과 지출을 줄여보세요. 소비 습관을 바꾸는 것이 투자의 첫걸음입니다.',
      YELLOW: '기본적인 지출 관리는 잘 하고 계시네요! 이제 여유 자금을 체계적으로 투자로 옮겨볼 타이밍입니다.',
      GREEN: '훌륭한 재무 습관을 가지고 계시네요! 이제 투자 포트폴리오를 다각화하고 수익률을 극대화할 차례입니다.',
    };

    return {
      nickname: dto.nickname,
      category: dto.category,
      grade,
      currentTab: {
        grade,
        gradeLabel: gradeLabels[grade] || grade,
        monthlyIncome: dto.monthlyIncome,
        monthlyFixedCost: dto.monthlyFixedCost,
        monthlyVariableCost: dto.monthlyVariableCost,
        monthlyInvestment: dto.monthlyInvestment,
        surplus,
        availableBudget: {
          monthly: variableCost.monthly,
          weekly: variableCost.weekly,
          daily: variableCost.daily,
        },
        fixedCostRatio,
        expenseRatio,
      },
      futureTab: {
        yearsToRetirement: investmentPeriod,
        retirementAge: dto.retirementAge,
        pensionStartAge: dto.pensionStartAge,
        pensionGapYears,
        estimatedSavings,
      },
      actionTab: {
        gradeAction: gradeActions[grade] || '',
        ctaMessage: `${dto.nickname}님 머니런 가입 시, 미래 리스크 시나리오, 수익률 시나리오까지 포함한 '재테크 진단 리포트'를 언제든 찾아볼 수 있는 마이북으로 발행해드려요!`,
        courseMessage: `${dto.nickname}님께서 금융공부를 시작한 가장 큰 이유였던, ${dto.category}에 대한 기초-심화-마스터 과정을 매일매일 퀴즈와 함께 마스터하세요!`,
      },
    };
  }

  // ========== 카카오 로그인 + pre-onboarding 데이터 연동 ==========

  async kakaoLoginWithPreOnboarding(
    accessToken: string,
    preOnboardingData?: PreOnboardingDto,
  ) {
    const loginResult = await this.kakaoLogin(accessToken);

    // pre-onboarding 데이터가 있고 신규 유저면 재무 프로필 저장
    if (preOnboardingData && loginResult.user.isNewUser) {
      await this.savePreOnboardingData(loginResult.user.id as string, preOnboardingData);
    }

    return loginResult;
  }

  /** pre-onboarding 데이터를 유저 계정에 연동 */
  private async savePreOnboardingData(userId: string, dto: PreOnboardingDto) {
    const monthlyInvestment = dto.monthlyInvestment ?? 0;
    const monthlyExpenseForGrade = (dto.monthlyFixedCost - monthlyInvestment) + dto.monthlyVariableCost;
    const grade = calculateGrade(dto.monthlyIncome, monthlyExpenseForGrade);
    const variableCost = calculateVariableCost(dto.monthlyIncome, dto.monthlyFixedCost);

    // finance_profiles 저장
    await this.supabase.db
      .from('finance_profiles')
      .insert({
        user_id: userId,
        age: dto.age,
        retirement_age: dto.retirementAge,
        pension_start_age: dto.pensionStartAge,
        monthly_income: dto.monthlyIncome,
        monthly_fixed_cost: dto.monthlyFixedCost,
        monthly_variable_cost: dto.monthlyVariableCost,
        monthly_investment: monthlyInvestment,
        variable_cost_monthly: variableCost.monthly,
        variable_cost_weekly: variableCost.weekly,
        variable_cost_daily: variableCost.daily,
        grade,
      });

    // users 업데이트
    await this.supabase.db
      .from('users')
      .update({
        nickname: dto.nickname,
        has_completed_onboarding: true,
        onboarding_version: 4,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // onboarding_progress 생성 (카테고리 저장 — 로그인 후 코스 선택에 사용)
    await this.supabase.db
      .from('onboarding_progress')
      .insert({
        user_id: userId,
        selected_category: dto.category,
        finance_data: {
          nickname: dto.nickname,
          age: dto.age,
          retirementAge: dto.retirementAge,
          pensionStartAge: dto.pensionStartAge,
          monthlyIncome: dto.monthlyIncome,
          monthlyInvestment: monthlyInvestment,
          monthlyFixedCost: dto.monthlyFixedCost,
          monthlyVariableCost: dto.monthlyVariableCost,
        },
        current_step: 3, // 재무 데이터까지 완료
        updated_at: new Date().toISOString(),
      });

    // 상세리포트 비동기 자동 생성 (머니레터에 표시)
    this.bookService.generateDetailedReport(userId, true).catch((err) => {
      console.error('[auth] 상세리포트 자동 생성 실패:', err);
    });
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
    const monthlyInvestment = dto.monthlyInvestment ?? 0;
    // 고정비는 투자금 포함. 등급 계산 시 투자금은 지출이 아닌 자산 이동이므로 제외
    const monthlyExpenseForGrade = (dto.monthlyFixedCost - monthlyInvestment) + dto.monthlyVariableCost;
    const surplus = dto.monthlyIncome - dto.monthlyFixedCost - dto.monthlyVariableCost;
    const investmentPeriod = dto.retirementAge - dto.age;
    const vestingPeriod = pensionStartAge - dto.retirementAge;
    const grade = calculateGrade(dto.monthlyIncome, monthlyExpenseForGrade);
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
        monthly_investment: monthlyInvestment,
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

    const monthlyExpense = dto.monthlyFixedCost + dto.monthlyVariableCost;
    return {
      grade,
      monthlyExpense,
      surplus,
      investmentPeriod,
      vestingPeriod,
      variableCost,
      availableBudget: {
        monthly: variableCost.monthly,
        weekly: variableCost.weekly,
        daily: variableCost.daily,
      },
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
