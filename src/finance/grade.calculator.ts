export type Grade = 'RED' | 'YELLOW' | 'GREEN';

export function calculateGrade(
  monthlyIncome: number,
  goodSpendingTotal: number,
): Grade {
  if (goodSpendingTotal === 0) return 'RED';
  const ratio = goodSpendingTotal / monthlyIncome;
  if (ratio < 0.10) return 'RED';
  if (ratio < 0.20) return 'YELLOW';
  return 'GREEN';
}
