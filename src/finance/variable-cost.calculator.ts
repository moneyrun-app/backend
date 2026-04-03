export interface VariableCost {
  monthly: number;
  weekly: number;
  daily: number;
}

export function calculateVariableCost(
  monthlyIncome: number,
  monthlyFixedCost: number,
  monthlyInvestment: number = 0,
): VariableCost {
  const monthly = monthlyIncome - monthlyFixedCost - monthlyInvestment;
  const weekly = Math.floor(monthly / 4.3);
  const daily = Math.floor(monthly / 30);
  return { monthly, weekly, daily };
}
