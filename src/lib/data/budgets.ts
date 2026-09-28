import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calendarPeriod,
  todayIso,
  type BudgetPeriod,
} from "@/lib/finance/budget-periods";
import { sumAmounts } from "@/lib/finance/money";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type BudgetStatusRow = {
  budgetId: string;
  budgetName: string | null;
  periodMonth: string;
  itemId: string;
  categoryId: string;
  categoryName: string;
  /** Budgeted amount as an exact decimal string. */
  budgeted: string;
  spent: string;
  remaining: string;
  /** Already a percentage (25 means 25%). */
  percentUsed: number;
};

export type BudgetOverview = {
  budgetId: string | null;
  periodMonth: string;
  /**
   * The dates this budget counts spending between. A month without a budget
   * reports its calendar month, which is what a new budget would default to.
   */
  period: BudgetPeriod;
  name: string | null;
  items: BudgetStatusRow[];
  totalBudgeted: string;
  totalSpent: string;
  totalRemaining: string;
};

/** First day of a month as an ISO date string (YYYY-MM-01). */
export function monthStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function toDecimal(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value);
}

function toPeriod(row: {
  period_type: string;
  start_date: string;
  end_date: string;
}): BudgetPeriod {
  return {
    type: row.period_type === "custom" ? "custom" : "calendar",
    start: String(row.start_date),
    end: String(row.end_date),
  };
}

/** The saved period of the budget keyed by `periodMonth`, if there is one. */
export async function getBudgetPeriod(
  supabase: Client,
  periodMonth: string,
): Promise<BudgetPeriod | null> {
  const { data, error } = await supabase
    .from("budgets")
    .select("period_type, start_date, end_date")
    .eq("period_month", normalizeMonth(periodMonth))
    .maybeSingle();
  if (error) throw new Error(`Failed to load budget period: ${error.message}`);
  return data ? toPeriod(data) : null;
}

/**
 * The month key of the budget that covers `day` (default: today).
 *
 * With a payday-to-payday budget, 10 October still belongs to the budget that
 * started on 25 September, so "the current budget" is found by its dates, not
 * the calendar month. Falls back to the calendar month when no budget covers
 * the day.
 */
export async function getCurrentBudgetMonth(
  supabase: Client,
  day: string = todayIso(),
): Promise<string> {
  const { data, error } = await supabase
    .from("budgets")
    .select("period_month")
    .lte("start_date", day)
    .gte("end_date", day)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to find the current budget: ${error.message}`);
  return data?.period_month ?? normalizeMonth(day);
}

/**
 * Budget vs actual for a month's budget.
 *
 * The database returns the item rows with spending already computed between
 * the budget's own start and end dates; the totals are summed exactly with
 * sumAmounts rather than a float reduce.
 */
export async function getBudgetOverview(
  supabase: Client,
  periodMonth: string,
): Promise<BudgetOverview> {
  const [{ data, error }, savedPeriod] = await Promise.all([
    supabase.rpc("get_budget_status", { p_period_month: periodMonth }),
    getBudgetPeriod(supabase, periodMonth),
  ]);
  if (error) throw new Error(`Failed to load budget: ${error.message}`);

  const rows: BudgetStatusRow[] = (data ?? []).map((row) => ({
    budgetId: String(row.budget_id),
    budgetName: row.budget_name,
    periodMonth: String(row.period_month),
    itemId: String(row.item_id),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    budgeted: toDecimal(row.budgeted),
    spent: toDecimal(row.spent),
    remaining: toDecimal(row.remaining),
    percentUsed: Number(row.percent_used),
  }));

  const totalBudgeted = sumAmounts(rows.map((r) => r.budgeted));
  const totalSpent = sumAmounts(rows.map((r) => r.spent));

  return {
    budgetId: rows[0]?.budgetId ?? null,
    periodMonth,
    period: savedPeriod ?? calendarPeriod(normalizeMonth(periodMonth)),
    name: rows[0]?.budgetName ?? null,
    items: rows,
    totalBudgeted,
    totalSpent,
    totalRemaining: sumAmounts([totalBudgeted, `-${totalSpent}`]),
  };
}

/** Normalise any YYYY-MM-DD value to the first of its month. */
function normalizeMonth(periodMonth: string): string {
  return monthStart(new Date(`${periodMonth}T00:00:00Z`));
}

/**
 * Column values for a period. Calendar budgets send only the month (the
 * database fills in the dates); custom budgets send their dates.
 */
function periodColumns(periodMonth: string, period?: BudgetPeriod) {
  if (period?.type === "custom") {
    return {
      period_month: normalizeMonth(periodMonth),
      period_type: "custom",
      start_date: period.start,
      end_date: period.end,
    };
  }
  return { period_month: normalizeMonth(periodMonth), period_type: "calendar" };
}

/** Create an empty budget for a month (no items yet). */
export async function createBudget(
  supabase: Client,
  userId: string,
  periodMonth: string,
  name?: string,
  period?: BudgetPeriod,
): Promise<string> {
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      user_id: userId,
      ...periodColumns(periodMonth, period),
      name: name ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

/**
 * Replace the budgeted amounts for a month in one transaction-like sequence.
 *
 * Strategy: delete the month's items and re-insert the submitted set. This is
 * simpler and less error-prone than diffing, and the whole month's items are
 * small. Because there is no stored spending, re-creating items cannot corrupt
 * history.
 */
export async function saveBudgetItems(
  supabase: Client,
  userId: string,
  periodMonth: string,
  items: Array<{ categoryId: string; amount: string }>,
  period?: BudgetPeriod,
): Promise<void> {
  // Ensure the budget row exists, with the chosen period.
  const { data: existing, error: findError } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("period_month", normalizeMonth(periodMonth))
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  let budgetId = existing?.id ?? null;
  if (!budgetId) {
    budgetId = await createBudget(supabase, userId, periodMonth, undefined, period);
  } else if (period) {
    const { error: periodError } = await supabase
      .from("budgets")
      .update(periodColumns(periodMonth, period))
      .eq("id", budgetId)
      .eq("user_id", userId);
    if (periodError) throw new Error(periodError.message);
  }

  const { error: deleteError } = await supabase
    .from("budget_items")
    .delete()
    .eq("budget_id", budgetId)
    .eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = items
    .filter((item) => Number(item.amount) > 0)
    .map((item) => ({
      budget_id: budgetId,
      user_id: userId,
      category_id: item.categoryId,
      amount: item.amount as unknown as number,
    }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("budget_items")
    .insert(rows);
  if (insertError) throw new Error(insertError.message);
}

/** Copy a budget from one month to another. Idempotent in the database. */
export async function copyBudget(
  supabase: Client,
  fromMonth: string,
  toMonth: string,
): Promise<void> {
  const { error } = await supabase.rpc("copy_budget", {
    p_from_month: fromMonth,
    p_to_month: toMonth,
  });
  if (error) throw new Error(error.message);
}

/** The most recent month that has a budget, if any (for "copy last month"). */
export async function getLatestBudgetMonth(
  supabase: Client,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("budgets")
    .select("period_month")
    .order("period_month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.period_month ?? null;
}
