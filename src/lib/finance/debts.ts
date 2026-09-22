/**
 * Debt helpers.
 *
 * Pure and deterministic. `debt_details` in the database already derives status
 * and settled amount; these helpers handle presentation (progress, due-date
 * wording) and the paid-down percentage.
 */

import { toMinorUnits } from "@/lib/finance/money";
import type { DebtStatus } from "@/types/domain";

/**
 * Fraction of the principal already settled (0..1).
 *
 * Returns 0 for a zero principal to avoid a division by zero; `principal > 0`
 * is enforced in the database, so this is defensive only.
 */
export function settlementProgress(
  principal: string | number,
  remaining: string | number,
): number {
  const principalMinor = toMinorUnits(principal);
  if (principalMinor <= 0) return 0;
  const settledMinor = principalMinor - toMinorUnits(remaining);
  return Math.max(0, Math.min(1, settledMinor / principalMinor));
}

/** Whole days until the due date, or null when there is no due date. */
export function daysUntilDue(
  dueDate: string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return null;

  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const end = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  return Math.round((end - start) / 86_400_000);
}

/**
 * Whether an open debt is overdue (past its due date and not settled).
 *
 * Settled/written-off debts are never overdue: they are resolved.
 */
export function isOverdue(
  status: DebtStatus,
  dueDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (status !== "open") return false;
  const days = daysUntilDue(dueDate, today);
  return days !== null && days < 0;
}
