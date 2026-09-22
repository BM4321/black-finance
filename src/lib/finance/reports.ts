/**
 * Reporting helpers.
 *
 * Pure and deterministic. The database computes the aggregates; these functions
 * only derive presentation figures (rates, shares, changes) so the same math is
 * not reimplemented in each chart. Money stays exact via minor units where a
 * comparison is involved.
 */

import { toMinorUnits } from "@/lib/finance/money";

export type MonthlyPoint = {
  monthStart: string;
  income: string;
  expense: string;
  savings: string;
};

/**
 * Savings rate per month: (income - expenses) / income.
 *
 * Returns null for a month with no income, because a rate against zero is
 * undefined. The chart renders those as gaps rather than a misleading 0%.
 */
export function savingsRateSeries(
  months: MonthlyPoint[],
): Array<{ monthStart: string; rate: number | null }> {
  return months.map((month) => {
    const income = toMinorUnits(month.income);
    if (income === 0) {
      return { monthStart: month.monthStart, rate: null };
    }
    const savings = toMinorUnits(month.savings);
    return { monthStart: month.monthStart, rate: savings / income };
  });
}

/**
 * Fraction that `part` is of `total` (0..1), or null when total is zero.
 *
 * Used for "share of spending" bars. Null rather than 0 or Infinity so the UI
 * can show "—".
 */
export function shareOfTotal(
  part: string | number,
  total: string | number,
): number | null {
  const totalMinor = toMinorUnits(total);
  if (totalMinor === 0) return null;
  return toMinorUnits(part) / totalMinor;
}

/**
 * Change from a previous value to a current value as a ratio.
 *
 * Returns null when the previous value is zero (undefined percentage change).
 * A positive result means an increase; negative means a decrease.
 */
export function changeRatio(
  current: string | number,
  previous: string | number,
): number | null {
  const previousMinor = toMinorUnits(previous);
  if (previousMinor === 0) return null;
  return (toMinorUnits(current) - previousMinor) / previousMinor;
}

/** Format a ratio as a signed percentage, or "—" when undefined. */
export function formatChange(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(1)}%`;
}
