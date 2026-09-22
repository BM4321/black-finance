/**
 * Chart-type preferences.
 *
 * The user can choose how a given chart is drawn. The choice is stored in
 * `localStorage`, keyed per chart, so it survives reloads without a server
 * round trip. This module holds the pure resolution logic (which is testable)
 * and the storage key helper; the React binding lives in the switcher
 * component.
 *
 * A corrupted or unknown stored value falls back to the default rather than
 * breaking the page, because localStorage is user-editable.
 */

export const INCOME_CHART_TYPES = ["bar", "line", "area"] as const;
export type IncomeChartType = (typeof INCOME_CHART_TYPES)[number];
export const DEFAULT_INCOME_CHART: IncomeChartType = "bar";

export const SPENDING_CHART_TYPES = ["pie", "bar", "list"] as const;
export type SpendingChartType = (typeof SPENDING_CHART_TYPES)[number];
export const DEFAULT_SPENDING_CHART: SpendingChartType = "pie";

/** localStorage key for a named chart, namespaced to avoid collisions. */
export function chartPreferenceKey(chartId: string): string {
  return `bf_chart_${chartId}`;
}

/**
 * Resolve a stored string to a valid option, or the default.
 *
 * `allowed` is the valid set and `fallback` is used for null/unknown values.
 */
export function resolveChartType<T extends string>(
  stored: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (stored && (allowed as readonly string[]).includes(stored)) {
    return stored as T;
  }
  return fallback;
}
