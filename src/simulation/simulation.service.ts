import { Injectable } from '@nestjs/common';
import { ConstantsService } from '../constants/constants.service';
import { SimulationDto } from './dto/simulation.dto';
import { calculateVariableCost } from '../finance/variable-cost.calculator';
import { calculateGrade } from '../finance/grade.calculator';

@Injectable()
export class SimulationService {
  constructor(private readonly constantsService: ConstantsService) {}

  async calculate(dto: SimulationDto) {
    const { age, monthlyIncome, monthlyFixedCost, monthlyVariableCost, retirementAge } = dto;
    const pensionStartAge = dto.pensionStartAge ?? 65;

    const monthlyExpense = monthlyFixedCost + monthlyVariableCost;
    const surplus = monthlyIncome - monthlyExpense;
    const investmentPeriod = retirementAge - age;
    const vestingPeriod = pensionStartAge - retirementAge;
    const grade = calculateGrade(monthlyIncome, monthlyExpense);
    const variableCost = calculateVariableCost(monthlyIncome, monthlyFixedCost);

    const floor1000 = (n: number) => Math.floor(n / 1000) * 1000;

    // 3가지 시나리오 시뮬레이션
    const rates = [
      { label: '예적금 3%', rate: 3 },
      { label: 'KOSPI 7%', rate: 7 },
      { label: 'S&P500 10%', rate: 10 },
    ];

    const months = Math.max(investmentPeriod, 0) * 12;
    const monthlySaving = Math.max(surplus, 0);
    const pensionMonths = Math.max(vestingPeriod + 20, 20) * 12; // 거치기간 + 수령 20년

    const cases = rates.map(({ label, rate }) => {
      const monthlyRate = rate / 100 / 12;
      let futureAsset: number;

      if (monthlyRate === 0 || months === 0) {
        futureAsset = monthlySaving * months;
      } else {
        futureAsset = monthlySaving *
          ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      }

      // 거치기간 복리 적용
      if (vestingPeriod > 0 && monthlyRate > 0) {
        futureAsset = futureAsset * Math.pow(1 + monthlyRate, vestingPeriod * 12);
      }

      futureAsset = floor1000(futureAsset);
      const monthlyPension = floor1000(futureAsset / pensionMonths);

      return { label, futureAsset, monthlyPension };
    });

    return {
      grade,
      monthlyExpense,
      surplus: floor1000(surplus),
      investmentPeriod,
      vestingPeriod,
      variableCost,
      simulation: { cases },
    };
  }
}
