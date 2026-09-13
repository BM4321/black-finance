import type { ResolvedPeriod } from "./types";

/**
 * Works out which time period a natural-language question refers to.
 *
 * This is deliberately a small, deterministic keyword parser, not an LLM call:
 * getting the date range wrong would make every retrieved number wrong, so it
 * is better to be predictable and testable. The LLM can still reason about the
 * period because we tell it which range the data covers.
 *
 * All dates are handled as UTC calendar days, consistent with how transactions
 * store `occurred_on` as a DATE.
 */

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  // Day 0 of next month is the last day of this month.
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The current calendar month. */
export function currentMonth(now = new Date()): ResolvedPeriod {
  return {
    from: iso(startOfMonth(now)),
    to: iso(endOfMonth(now)),
    label: `this month (${monthLabel(now)})`,
  };
}

/**
 * Resolve a period from the question text.
 *
 * Recognised phrases (checked in order of specificity):
 *   - "last month"          -> previous calendar month
 *   - a month name          -> that month in the most recent matching year
 *   - "this week" / "last week"
 *   - "this year" / "last year"
 *   - "last N days"
 *   - "this month", "today", or no time phrase -> current month
 */
export function resolvePeriod(question: string, now = new Date()): ResolvedPeriod {
  const q = question.toLowerCase();

  if (/\blast\s+month\b/.test(q)) {
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return {
      from: iso(startOfMonth(prev)),
      to: iso(endOfMonth(prev)),
      label: `last month (${monthLabel(prev)})`,
    };
  }

  if (/\bthis\s+week\b/.test(q)) {
    const day = now.getUTCDay();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    return {
      from: iso(monday),
      to: iso(now),
      label: "this week",
    };
  }

  if (/\blast\s+week\b/.test(q)) {
    const monday = new Date(now);
    const day = now.getUTCDay();
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7) - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: iso(monday),
      to: iso(sunday),
      label: "last week",
    };
  }

  if (/\blast\s+year\b/.test(q)) {
    const year = now.getUTCFullYear() - 1;
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: `${year}`,
    };
  }

  if (/\bthis\s+year\b/.test(q)) {
    const year = now.getUTCFullYear();
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: `${year}`,
    };
  }

  const daysMatch = q.match(/\blast\s+(\d{1,3})\s+days?\b/);
  if (daysMatch) {
    const days = Math.min(Number(daysMatch[1]), 366);
    const from = new Date(now);
    from.setUTCDate(now.getUTCDate() - (days - 1));
    return {
      from: iso(from),
      to: iso(now),
      label: `the last ${days} days`,
    };
  }

  // A named month, e.g. "in March" or "spending in January".
  for (let index = 0; index < MONTH_NAMES.length; index += 1) {
    const name = MONTH_NAMES[index];
    if (new RegExp(`\\b${name}\\b`).test(q)) {
      // Choose the most recent occurrence of that month at or before `now`.
      let year = now.getUTCFullYear();
      if (index > now.getUTCMonth()) year -= 1;
      const date = new Date(Date.UTC(year, index, 1));
      return {
        from: iso(startOfMonth(date)),
        to: iso(endOfMonth(date)),
        label: monthLabel(date),
      };
    }
  }

  // Default: the current month.
  return currentMonth(now);
}
