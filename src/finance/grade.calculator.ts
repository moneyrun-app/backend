export type Grade = 'RED' | 'YELLOW' | 'GREEN';

/**
 * 투자 체급 (신호등) 판정
 * 변동비 비율 = 변동비 / 실수령액
 * RED:    > 70% (소비 과다)
 * YELLOW: 40~70%
 * GREEN:  <= 40% (저축/투자 충분)
 */
export function calculateGrade(
  monthlyIncome: number,
  monthlyVariableCost: number,
): Grade {
  if (monthlyIncome <= 0) return 'RED';
  const ratio = monthlyVariableCost / monthlyIncome;
  if (ratio > 0.7) return 'RED';
  if (ratio > 0.4) return 'YELLOW';
  return 'GREEN';
}
