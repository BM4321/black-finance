/**
 * Budget periods.
 *
 * A budget covers either a calendar month (1st to last day) or custom dates,
 * so it can run from payday to payday when salary does not land on the 1st.
 * Dates are ISO `YYYY-MM-DD` strings in UTC, matching how the database stores
 * DATE values; both ends are inclusive.
 *
 * The database enforces the same rules (0022_budget_custom_periods.sql); these
 * helpers let the form explain problems before submitting and keep the date
 * arithmetic identical to PostgreSQL's (month addition clamps to month end).
 */

export type BudgetPeriodType = "calendar" | "custom";

export type BudgetPeriod = {
  type: BudgetPeriodType;
  /** First day counted, inclusive. */
  start: string;
  /** Last day counted, inclusive. */
  end: string;
};

/** Longest custom period accepted, in days between start and end. */
export const MAX_PERIOD_DAYS = 62;

const DAY_MS = 86_400_000;

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date in UTC as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  return toIso(now);
}

/** First of the month containing `iso`. */
export function firstOfMonth(iso: string): string {
  const date = toDate(iso);
  return toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

/**
 * Add whole months, clamping to the last day of the target month the way
 * PostgreSQL's `date + interval 'n months'` does (31 Jan + 1 month = 28 Feb).
 */
export function addMonths(iso: string, months: number): string {
  const date = toDate(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))));
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Whole days from `start` to `end` (0 when they are the same day). */
export function daysBetween(start: string, end: string): number {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / DAY_MS);
}

/** The whole calendar month keyed by `month` (any date within it). */
export function calendarPeriod(month: string): BudgetPeriod {
  const start = firstOfMonth(month);
  return { type: "calendar", start, end: addDays(addMonths(start, 1), -1) };
}

/** Default end for a custom period: the day before the same date next month. */
export function defaultCustomEnd(start: string): string {
  return addDays(addMonths(start, 1), -1);
}

/**
 * Why a custom period is invalid for the budget keyed by `month`, or null.
 *
 * The start must fall inside that month (the month is the budget's key and
 * how it is navigated to), the end cannot precede the start, and the period
 * is at most MAX_PERIOD_DAYS long.
 */
export function customPeriodError(
  month: string,
  start: string,
  end: string,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return "Choose a start date.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return "Choose an end date.";
  if (firstOfMonth(start) !== firstOfMonth(month)) {
    return "The start date must be in the budget’s month.";
  }
  const days = daysBetween(start, end);
  if (days < 0) return "The end date can’t be before the start date.";
  if (days > MAX_PERIOD_DAYS) return "A budget period can be at most about two months.";
  return null;
}

/** True when `day` falls within the period, both ends inclusive. */
export function periodContains(period: BudgetPeriod, day: string): boolean {
  return period.start <= day && day <= period.end;
}

/**
 * Human-readable range, e.g. "25 Sep – 24 Oct 2026", or
 * "28 Dec 2026 – 27 Jan 2027" when the years differ.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayMonth(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function formatPeriod(period: Pick<BudgetPeriod, "start" | "end">): string {
  // Fixed month names rather than toLocaleDateString, whose abbreviations
  // differ between runtimes ("Sep" vs "Sept") and would break hydration.
  const start = toDate(period.start);
  const end = toDate(period.end);
  const endText = `${dayMonth(end)} ${end.getUTCFullYear()}`;
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${dayMonth(start)} – ${endText}`;
  }
  return `${dayMonth(start)} ${start.getUTCFullYear()} – ${endText}`;
}
