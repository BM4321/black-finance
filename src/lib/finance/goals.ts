/**
 * Savings goal helpers.
 *
 * Pure and deterministic: the UI reads `percent_complete`/`remaining` from the
 * database view, but formatting, clamping and date math live here so they are
 * testable without a database. As with budgets and health, money is handled in
 * integer minor units to stay exact.
 */

import { fromMinorUnits, toMinorUnits } from "@/lib/finance/money";

export type GoalStatus = "not_started" | "in_progress" | "complete";

/** Classify a goal by how much of its target has been contributed. */
export function classifyGoal(percentComplete: number): GoalStatus {
  if (!Number.isFinite(percentComplete) || percentComplete <= 0) {
    return "not_started";
  }
  if (percentComplete >= 100) return "complete";
  return "in_progress";
}

/** Clamp a completion percentage to 0..100 for a progress bar width. */
export function goalProgressWidth(percentComplete: number): number {
  if (!Number.isFinite(percentComplete) || percentComplete < 0) return 0;
  return Math.min(100, percentComplete);
}

/** Whole days from `today` until `targetDate`, or null when there is no date. */
export function daysUntil(
  targetDate: string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;

  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const end = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  return Math.round((end - start) / 86_400_000);
}

/**
 * Suggested contribution per remaining month to hit an optional deadline.
 *
 * Returns null when there is no deadline or it has already passed — there is
 * no meaningful monthly figure in that case. Uses calendar months (rounded up)
 * so the suggestion never under-shoots.
 */
export function monthlyPace(
  remaining: string | number,
  targetDate: string | null | undefined,
  today: Date = new Date(),
): string | null {
  const days = daysUntil(targetDate, today);
  if (days === null || days <= 0) return null;

  const months = Math.max(1, Math.ceil(days / 30.44));
  const remainingMinor = toMinorUnits(remaining);
  if (remainingMinor <= 0) return fromMinorUnits(0);

  // Round up to whole minor units so the plan is never short.
  return fromMinorUnits(Math.ceil(remainingMinor / months));
}
