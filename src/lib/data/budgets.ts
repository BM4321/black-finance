import type { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Budget vs actual for a month.
 *
 * The database returns the item rows with spending already computed; the totals
 * are summed exactly with sumAmounts rather than a float reduce.
 */
export async function getBudgetOverview(
  supabase: Client,
  periodMonth: string,
): Promise<BudgetOverview> {
  const { data, error } = await supabase.rpc("get_budget_status", {
    p_period_month: periodMonth,
  });
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

/** Create an empty budget for a month (no items yet). */
export async function createBudget(
  supabase: Client,
  userId: string,
  periodMonth: string,
  name?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      user_id: userId,
      period_month: normalizeMonth(periodMonth),
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
): Promise<void> {
  // Ensure the budget row exists.
  const { data: existing, error: findError } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("period_month", normalizeMonth(periodMonth))
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  let budgetId = existing?.id ?? null;
  if (!budgetId) {
    budgetId = await createBudget(supabase, userId, periodMonth);
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
