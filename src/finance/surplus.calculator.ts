export interface GoodSpending {
  type: string;
  label: string;
  amount: number;
}

export interface FixedExpenses {
  rent: number;
  utilities: number;
  phone: number;
}

export interface Surplus {
  monthly: number;
  weekly: number;
  daily: number;
}

export function calculateSurplus(
  monthlyIncome: number,
  goodSpendings: GoodSpending[],
  fixedExpenses: FixedExpenses,
): Surplus {
  const goodTotal = goodSpendings.reduce((sum, g) => sum + g.amount, 0);
  const fixedTotal = fixedExpenses.rent + fixedExpenses.utilities + fixedExpenses.phone;

  const monthly = monthlyIncome - goodTotal - fixedTotal;
  const weekly = Math.floor(monthly / 4.3);
  const daily = Math.floor(monthly / 30);

  return { monthly, weekly, daily };
}

export function calculateGoodSpendingTotal(goodSpendings: GoodSpending[]): number {
  return goodSpendings.reduce((sum, g) => sum + g.amount, 0);
}

export function calculateFixedExpenseTotal(fixedExpenses: FixedExpenses): number {
  return fixedExpenses.rent + fixedExpenses.utilities + fixedExpenses.phone;
}
