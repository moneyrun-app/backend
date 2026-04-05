export interface VariableCost {
  monthly: number;
  weekly: number;
  daily: number;
  daysInMonth: number;
}

export function calculateVariableCost(
  monthlyIncome: number,
  monthlyFixedCost: number,
  monthlyInvestment: number = 0,
): VariableCost {
  const floor1000 = (n: number) => Math.floor(n / 1000) * 1000;

  // 이번 달 일수 (KST 기준)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthly = floor1000(monthlyIncome - monthlyFixedCost - monthlyInvestment);
  const daily = floor1000(monthly / daysInMonth);
  const weekly = floor1000(daily * 7);

  return { monthly, weekly, daily, daysInMonth };
}
