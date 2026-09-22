import type { SupabaseClient } from "@supabase/supabase-js";

import { sumAmounts } from "@/lib/finance/money";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type MonthlySummary = {
  /** ISO date for the first of the month. */
  monthStart: string;
  income: string;
  expense: string;
  transfer: string;
  savings: string;
};

export type CategorySpending = {
  categoryId: string;
  categoryName: string;
  total: string;
};

/** Convert a Postgres NUMERIC (string at runtime) to an exact decimal string. */
function toDecimal(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value);
}

/** Monthly income/expense/savings for the last `months` months (oldest first). */
export async function getMonthlySummary(
  supabase: Client,
  months = 6,
): Promise<MonthlySummary[]> {
  const { data, error } = await supabase.rpc("get_monthly_summary", {
    p_months: months,
  });
  if (error) throw new Error(`Failed to load monthly summary: ${error.message}`);

  return (data ?? []).map((row) => ({
    monthStart: String(row.month_start),
    income: toDecimal(row.income),
    expense: toDecimal(row.expense),
    transfer: toDecimal(row.transfer),
    savings: toDecimal(row.savings),
  }));
}

/** Expense totals per category for a date range. */
export async function getSpendingByCategory(
  supabase: Client,
  dateFrom?: string,
  dateTo?: string,
): Promise<CategorySpending[]> {
  const { data, error } = await supabase.rpc("get_spending_by_category", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) throw new Error(`Failed to load spending: ${error.message}`);

  return (data ?? []).map((row) => ({
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    total: toDecimal(row.total),
  }));
}

/** Exact total of all non-archived account balances. */
export async function getNetWorth(supabase: Client): Promise<string> {
  const { data, error } = await supabase.rpc("get_net_worth");
  if (error) throw new Error(`Failed to load net worth: ${error.message}`);
  return sumAmounts([toDecimal(data)]);
}

export type BalanceBreakdown = {
  /** Balances of non-savings accounts (cash, bank, mobile money, ...). */
  spendable: string;
  /** Balances of savings-type accounts only. */
  savings: string;
  /** Market value of non-archived investment holdings. */
  investments: string;
  /** Open money owed to the user (an asset). */
  owedToMe: string;
  /** Open money the user owes (a liability). */
  owedByMe: string;
  /** spendable + savings + investments + owedToMe - owedByMe. */
  netWorth: string;
};

/**
 * Non-archived balances split into spendable, savings and investments, plus
 * open debts and net worth.
 *
 * All figures come from one database aggregate, so they can never disagree
 * (net worth is exactly the sum with debts signed).
 */
export async function getBalanceBreakdown(
  supabase: Client,
): Promise<BalanceBreakdown> {
  const { data, error } = await supabase.rpc("get_balance_breakdown");
  if (error) throw new Error(`Failed to load balances: ${error.message}`);

  const row = data?.[0];
  return {
    spendable: sumAmounts([toDecimal(row?.spendable)]),
    savings: sumAmounts([toDecimal(row?.savings)]),
    investments: sumAmounts([toDecimal(row?.investments)]),
    owedToMe: sumAmounts([toDecimal(row?.owed_to_me)]),
    owedByMe: sumAmounts([toDecimal(row?.owed_by_me)]),
    netWorth: sumAmounts([toDecimal(row?.net_worth)]),
  };
}
