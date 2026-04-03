import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../constants/constants.service';
import { SimulationDto } from './dto/simulation.dto';
import { calculateVariableCost } from '../finance/variable-cost.calculator';
import { calculateGrade } from '../finance/grade.calculator';

@Injectable()
export class SimulationService {
  constructor(private readonly constantsService: ConstantsService) {}

  async calculate(dto: SimulationDto) {
    const { age, monthlyIncome, monthlyFixedCost } = dto;
    const monthlyInvestment = dto.monthlyInvestment ?? 0;
    const expectedReturn = dto.expectedReturn ?? 5.0;
    const investmentYears = dto.investmentYears ?? (65 - age);

    const variableCost = calculateVariableCost(monthlyIncome, monthlyFixedCost, monthlyInvestment);
    const grade = calculateGrade(monthlyIncome, variableCost.monthly);

    // system_config에서 최소 생활비 목표 조회
    const configMap = await this.constantsService.getConfigMap();
    const minPensionGoal = parseInt(configMap['min_pension_goal'] || '1300000');

    // 미래 자산 시뮬레이션 (투자비 기준 복리 계산)
    const monthlyRate = expectedReturn / 100 / 12;
    const months = Math.max(investmentYears, 0) * 12;
    const monthlySaving = monthlyInvestment > 0 ? monthlyInvestment : variableCost.monthly;

    let futureAsset: number;
    if (monthlyRate === 0 || months === 0) {
      futureAsset = monthlySaving * months;
    } else {
      futureAsset = Math.floor(
        monthlySaving *
          ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate),
      );
    }

    // 월 연금 추정 (20년 은퇴 생활 가정)
    const retirementMonths = 20 * 12;
    const monthlyPensionEstimate = Math.floor(futureAsset / retirementMonths);
    const shortfall = Math.max(0, minPensionGoal - monthlyPensionEstimate);

    return {
      variableCost,
      simulation: {
        futureAsset,
        monthlyPensionEstimate,
        minLivingCost: minPensionGoal,
        shortfall,
        meetsGoal: monthlyPensionEstimate >= minPensionGoal,
      },
      grade,
    };
  }
}
