import type { SupabaseClient } from "@supabase/supabase-js";

import { listAccounts } from "@/lib/data/accounts";
import { getBudgetOverview, monthStart } from "@/lib/data/budgets";
import {
  getBalanceBreakdown,
  getMonthlySummary,
  getSpendingByCategory,
} from "@/lib/data/dashboard";
import { sumAmounts } from "@/lib/finance/money";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type { BudgetOverview } from "@/lib/data/budgets";
import type {
  BalanceBreakdown,
  CategorySpending,
  MonthlySummary,
} from "@/lib/data/dashboard";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type NetWorthPoint = {
  monthStart: string;
  /** Account-only total (investments/debts have no history). */
  accountTotal: string;
};

function toDecimal(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value);
}

/** Month-by-month account-only net worth for the last `months` months. */
export async function getNetWorthHistory(
  supabase: Client,
  months = 12,
): Promise<NetWorthPoint[]> {
  const { data, error } = await supabase.rpc("get_net_worth_history", {
    p_months: months,
  });
  if (error) {
    throw new Error(`Failed to load net worth history: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    monthStart: String(row.month_start),
    accountTotal: toDecimal(row.account_total),
  }));
}

export type ReportsData = {
  monthly: MonthlySummary[];
  spendingByCategory: CategorySpending[];
  accounts: AccountWithBalance[];
  totalBalance: string;
  budgets: BudgetOverview;
  breakdown: BalanceBreakdown;
  netWorthHistory: NetWorthPoint[];
};

/**
 * Loads everything the reports page needs for a date range.
 *
 * Runs the independent queries concurrently. The budget overview is for the
 * month the range ends in, which is what "this period's budget" means in
 * practice.
 */
export async function getReportsData(
  supabase: Client,
  options: { from: string; to: string; months?: number },
): Promise<ReportsData> {
  const months = options.months ?? 12;
  const budgetMonth = monthStart(new Date(`${options.to}T00:00:00Z`));

  const [
    monthly,
    spending,
    accounts,
    budgets,
    breakdown,
    netWorthHistory,
  ] = await Promise.all([
    getMonthlySummary(supabase, months),
    getSpendingByCategory(supabase, options.from, options.to),
    listAccounts(supabase),
    getBudgetOverview(supabase, budgetMonth),
    getBalanceBreakdown(supabase),
    getNetWorthHistory(supabase, months),
  ]);

  return {
    monthly,
    spendingByCategory: spending,
    accounts,
    totalBalance: sumAmounts(accounts.map((a) => a.current_balance)),
    budgets,
    breakdown,
    netWorthHistory,
  };
}
