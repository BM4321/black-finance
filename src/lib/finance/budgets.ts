/**
 * Budget health helpers.
 *
 * Thresholds live here, in one place, so the list, the badge and any future
 * notification all agree on what "approaching" and "over" mean.
 */

import { fromMinorUnits, sumAmounts, toMinorUnits } from "@/lib/finance/money";

export type BudgetStatus = "safe" | "warning" | "over";

/** Spending at or above this percentage is "approaching" the limit. */
export const BUDGET_WARNING_THRESHOLD = 80;

/**
 * Classify a budget line by how much of the allowance has been used.
 *
 * `percentUsed` comes from the database and is already a percentage (e.g. 25
 * means 25%). A zero budget with any spending is "over", since there is no
 * allowance to spend against.
 */
export function classifyBudget(percentUsed: number): BudgetStatus {
  if (percentUsed > 100) return "over";
  if (percentUsed >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "safe";
}

/** Clamp a percentage to 0..100 for use as a progress-bar width. */
export function progressWidth(percentUsed: number): number {
  if (!Number.isFinite(percentUsed) || percentUsed < 0) return 0;
  return Math.min(100, percentUsed);
}

/**
 * Sum a set of raw amount inputs exactly.
 *
 * Budget fields are free-text while editing, so entries may be blank or only
 * partially typed (`""`, `"."`, `"1."`). Those are treated as zero rather than
 * throwing, so the running total keeps updating as the user types.
 */
export function sumBudgetInputs(amounts: Array<string | number>): string {
  const valid = amounts
    .map((value) => String(value).trim())
    .filter((value) => /^\d+(\.\d+)?$/.test(value));
  return sumAmounts(valid);
}

/**
 * How much of a planning amount (available or expected income) is still
 * unallocated after budgeting. Can be negative when over-allocated.
 *
 * Computed in integer minor units to avoid float drift, then rendered back to
 * a decimal string.
 */
export function unallocated(
  planningAmount: string | number,
  totalBudgeted: string | number,
): string {
  // Keep values as decimal strings so toMinorUnits parses them exactly rather
  // than routing through a float.
  const parse = (value: string | number): string => {
    const text = String(value).trim();
    return /^-?\d+(\.\d+)?$/.test(text) ? text : "0";
  };
  const diffMinor =
    toMinorUnits(parse(planningAmount)) - toMinorUnits(parse(totalBudgeted));
  return fromMinorUnits(diffMinor);
}
