import { toMinorUnits } from "@/lib/finance/money";

/**
 * Financial health calculations that are pure and testable.
 *
 * These deliberately avoid floating point for the money comparisons and only
 * convert to a number at the very end for display.
 */

/**
 * Savings rate as a ratio: (income - expenses) / income.
 *
 * Transfers must already be excluded by the caller (they are not income or
 * expense). Returns null when there is no income, because a rate against zero
 * is undefined — showing 0% or 100% would both be misleading. The UI should
 * render a neutral state (e.g. "—") for null.
 */
export function calculateSavingsRate(
  income: string | number,
  expenses: string | number,
): number | null {
  const incomeMinor = toMinorUnits(income);
  if (incomeMinor === 0) return null;

  const expenseMinor = toMinorUnits(expenses);
  const savingsMinor = incomeMinor - expenseMinor;

  return savingsMinor / incomeMinor;
}

/** Format a ratio as a percentage string, or "—" when undefined. */
export function formatSavingsRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}
