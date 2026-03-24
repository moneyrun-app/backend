import { Injectable } from '@nestjs/common';

/**
 * 동기부여 계산기 서비스.
 * 복리 계산, 목표 달성률, 10년 후 예상 자산 등 순수 계산 로직을 담당한다.
 */
@Injectable()
export class SimulatorService {
  /**
   * 복리 계산으로 미래 가치를 산출한다.
   * FV = PV × (1 + r)^n + PMT × [((1 + r)^n - 1) / r]
   * @param presentValue - 현재 가치 (원)
   * @param monthlyContribution - 월 적립액 (원)
   * @param annualRate - 연 수익률 (예: 0.05 = 5%)
   * @param years - 투자 기간 (년)
   * @returns 미래 가치 (원)
   */
  calculateFutureValue(
    presentValue: number,
    monthlyContribution: number,
    annualRate: number,
    years: number,
  ): number {
    const monthlyRate = annualRate / 12;
    const totalMonths = years * 12;

    if (monthlyRate === 0) {
      return presentValue + monthlyContribution * totalMonths;
    }

    const compoundFactor = Math.pow(1 + monthlyRate, totalMonths);
    const fv =
      presentValue * compoundFactor +
      monthlyContribution * ((compoundFactor - 1) / monthlyRate);

    return Math.round(fv);
  }

  /**
   * 특정 지출을 투자했으면 N년 후 얼마가 됐을지 계산한다.
   * 페이스메이커 발화에 사용: "커피 5,000원을 10년 투자하면 ₩847,000!"
   * @param amount - 지출 금액 (원)
   * @param annualRate - 연 수익률
   * @param years - 투자 기간 (년)
   * @returns N년 후 예상 금액 (원)
   */
  calculateOpportunityCost(
    amount: number,
    annualRate: number,
    years: number,
  ): number {
    // 매일 같은 금액을 투자한다고 가정 → 월 투자액 = amount × 30
    const monthlyContribution = amount * 30;
    return this.calculateFutureValue(0, monthlyContribution, annualRate, years);
  }

  /**
   * 목표 달성률을 계산한다.
   * @param currentAsset - 현재 추가 자산 (원)
   * @param goalAmount - 목표 금액 (원)
   * @returns 달성률 (%)
   */
  calculateGoalProgress(currentAsset: number, goalAmount: number): number {
    if (goalAmount <= 0) return 0;
    const progress = (currentAsset / goalAmount) * 100;
    return Math.round(progress * 10) / 10;
  }

  /**
   * 목표 달성까지 남은 예상 기간을 계산한다.
   * @param currentAsset - 현재 추가 자산 (원)
   * @param goalAmount - 목표 금액 (원)
   * @param monthlySaving - 월 저축액 (원)
   * @param annualRate - 연 수익률
   * @returns 남은 개월 수
   */
  calculateMonthsToGoal(
    currentAsset: number,
    goalAmount: number,
    monthlySaving: number,
    annualRate: number,
  ): number {
    if (currentAsset >= goalAmount) return 0;
    if (monthlySaving <= 0) return -1; // 도달 불가

    const monthlyRate = annualRate / 12;
    const remaining = goalAmount - currentAsset;

    if (monthlyRate === 0) {
      return Math.ceil(remaining / monthlySaving);
    }

    // n = ln((FV × r / PMT) + 1) / ln(1 + r)
    const n = Math.log((remaining * monthlyRate) / monthlySaving + 1) / Math.log(1 + monthlyRate);
    return Math.ceil(n);
  }

  /**
   * 특정 절약이 목표 달성을 며칠 앞당기는지 계산한다.
   * @param dailySaving - 일일 절약 금액 (원)
   * @param annualRate - 연 수익률
   * @param goalAmount - 목표 금액 (원)
   * @param currentAsset - 현재 자산 (원)
   * @param currentMonthlySaving - 현재 월 저축액 (원)
   * @returns 단축되는 일수
   */
  calculateDaysAccelerated(
    dailySaving: number,
    annualRate: number,
    goalAmount: number,
    currentAsset: number,
    currentMonthlySaving: number,
  ): number {
    const monthsBefore = this.calculateMonthsToGoal(
      currentAsset,
      goalAmount,
      currentMonthlySaving,
      annualRate,
    );

    const monthsAfter = this.calculateMonthsToGoal(
      currentAsset,
      goalAmount,
      currentMonthlySaving + dailySaving * 30,
      annualRate,
    );

    if (monthsBefore <= 0 || monthsAfter <= 0) return 0;

    return (monthsBefore - monthsAfter) * 30;
  }
}
