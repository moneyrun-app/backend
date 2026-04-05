export type Grade = 'RED' | 'YELLOW' | 'GREEN';

/**
 * 등급 판정 — 총지출/소득 비율 기준
 * RED:    70% 이상 (소비 과다)
 * YELLOW: 50~70%
 * GREEN:  50% 미만 (잉여 충분)
 */
export function calculateGrade(
  monthlyIncome: number,
  monthlyExpense: number,
): Grade {
  if (monthlyIncome <= 0) return 'RED';
  const ratio = monthlyExpense / monthlyIncome;
  if (ratio >= 0.7) return 'RED';
  if (ratio >= 0.5) return 'YELLOW';
  return 'GREEN';
}
