import { Injectable, NotFoundException } from '@nestjs/common';
import { ConstantsService } from '../constants/constants.service';

interface PeerEntry {
  ageMin: number;
  ageMax: number;
  ageLabel: string;
  incomeMin: number;
  incomeMax: number;
  incomeLabel: string;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgFixedCost: number;
  avgVariableCost: number;
  avgSavingsRate: number;
  avgSurplus: number;
}

@Injectable()
export class StatisticsService {
  constructor(private readonly constantsService: ConstantsService) {}

  async getPeers(age: number, monthlyIncome: number) {
    const configMap = await this.constantsService.getConfigMap();
    const raw = configMap['peer_statistics'];
    if (!raw) {
      throw new NotFoundException('peer_statistics 설정이 없습니다');
    }

    const entries: PeerEntry[] = JSON.parse(raw);

    // 나이대 매칭
    let matched = entries.filter(
      (e) => age >= e.ageMin && age <= e.ageMax,
    );

    // 나이대 매칭 실패 시 가장 가까운 그룹
    if (matched.length === 0) {
      const closest = entries.reduce((prev, curr) => {
        const prevDist = Math.min(
          Math.abs(age - prev.ageMin),
          Math.abs(age - prev.ageMax),
        );
        const currDist = Math.min(
          Math.abs(age - curr.ageMin),
          Math.abs(age - curr.ageMax),
        );
        return currDist < prevDist ? curr : prev;
      });
      matched = entries.filter(
        (e) => e.ageMin === closest.ageMin && e.ageMax === closest.ageMax,
      );
    }

    // 소득대 매칭
    let result = matched.find(
      (e) => monthlyIncome >= e.incomeMin && monthlyIncome < e.incomeMax,
    );

    // 소득대 매칭 실패 시 같은 나이대에서 가장 가까운 소득 구간
    if (!result) {
      result = matched.reduce((prev, curr) => {
        const prevDist = Math.min(
          Math.abs(monthlyIncome - prev.incomeMin),
          Math.abs(monthlyIncome - prev.incomeMax),
        );
        const currDist = Math.min(
          Math.abs(monthlyIncome - curr.incomeMin),
          Math.abs(monthlyIncome - curr.incomeMax),
        );
        return currDist < prevDist ? curr : prev;
      });
    }

    return {
      ageGroup: {
        label: result.ageLabel,
        range: [result.ageMin, result.ageMax],
      },
      incomeGroup: {
        label: result.incomeLabel,
        range: [result.incomeMin, result.incomeMax],
      },
      peers: {
        avgMonthlyIncome: result.avgMonthlyIncome,
        avgMonthlyExpense: result.avgMonthlyExpense,
        avgFixedCost: result.avgFixedCost,
        avgVariableCost: result.avgVariableCost,
        avgSavingsRate: result.avgSavingsRate,
        avgSurplus: result.avgSurplus,
      },
    };
  }
}
