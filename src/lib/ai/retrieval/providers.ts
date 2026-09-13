import { listAccounts } from "@/lib/data/accounts";
import { getBudgetOverview, monthStart } from "@/lib/data/budgets";
import { getMonthlySummary, getNetWorth, getSpendingByCategory } from "@/lib/data/dashboard";
import { getTransactions } from "@/lib/data/transactions";

import type { AiClient, ResolvedPeriod, RetrievalProvider, RetrievalSection } from "./types";

/**
 * Structured retrieval providers.
 *
 * Each provider pulls from the user's own data using the existing data-access
 * functions, which run through Supabase RLS. No provider ever accepts a
 * user id: the Supabase client carries the authenticated session, so the
 * database decides whose rows are visible. This is what prevents one user from
 * retrieving another's data.
 *
 * Providers return compact, already-computed facts. The arithmetic (totals,
 * budget usage, net worth) is done by the application/database, never by the
 * model.
 */

/** Accounts and their derived balances. */
export const accountsProvider: RetrievalProvider = {
  id: "accounts",
  async run(supabase: AiClient): Promise<RetrievalSection> {
    const accounts = await listAccounts(supabase);
    const netWorth = await getNetWorth(supabase);

    return {
      id: "accounts",
      title: "Accounts",
      source: { label: "accounts", count: accounts.length },
      data: {
        netWorth,
        currency: "TZS",
        accounts: accounts.map((account) => ({
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: String(account.current_balance),
        })),
      },
    };
  },
};

/**
 * Income/expense/savings for the resolved period and the preceding months.
 *
 * Always retrieves a few months so "why is this month different from last
 * month?" can be answered without a second round trip.
 */
export const periodSummaryProvider: RetrievalProvider = {
  id: "period_summary",
  async run(
    supabase: AiClient,
    _question: string,
    period: ResolvedPeriod,
  ): Promise<RetrievalSection> {
    const [summary, spending] = await Promise.all([
      getMonthlySummary(supabase, 6),
      getSpendingByCategory(supabase, period.from, period.to),
    ]);

    const inPeriod = summary.find(
      (row) => row.monthStart.slice(0, 7) === period.from.slice(0, 7),
    );

    return {
      id: "period_summary",
      title: `Summary for ${period.label}`,
      source: { label: "monthly summaries", count: summary.length },
      data: {
        period: { from: period.from, to: period.to, label: period.label },
        totalsForPeriod: inPeriod
          ? {
              income: inPeriod.income,
              expenses: inPeriod.expense,
              transfers: inPeriod.transfer,
              savings: inPeriod.savings,
            }
          : null,
        spendingByCategory: spending.map((row) => ({
          category: row.categoryName,
          total: row.total,
        })),
        monthlyHistory: summary.map((row) => ({
          month: row.monthStart.slice(0, 7),
          income: row.income,
          expenses: row.expense,
          savings: row.savings,
        })),
      },
    };
  },
};

/** Budget vs actual for the period's month, if a budget exists. */
export const budgetProvider: RetrievalProvider = {
  id: "budgets",
  async run(
    supabase: AiClient,
    _question: string,
    period: ResolvedPeriod,
  ): Promise<RetrievalSection | null> {
    const overview = await getBudgetOverview(
      supabase,
      monthStart(new Date(`${period.from}T00:00:00Z`)),
    );

    if (overview.items.length === 0) {
      return {
        id: "budgets",
        title: "Budgets",
        source: { label: "budget items", count: 0 },
        data: { note: "No budget is set for this period." },
      };
    }

    return {
      id: "budgets",
      title: `Budget for ${period.label}`,
      source: { label: "budget items", count: overview.items.length },
      data: {
        totalBudgeted: overview.totalBudgeted,
        totalSpent: overview.totalSpent,
        totalRemaining: overview.totalRemaining,
        items: overview.items.map((item) => ({
          category: item.categoryName,
          budgeted: item.budgeted,
          spent: item.spent,
          remaining: item.remaining,
          percentUsed: item.percentUsed,
        })),
      },
    };
  },
};

/**
 * Recent transactions for the period.
 *
 * Bounded on purpose: only a capped sample is retrieved so we never send an
 * unbounded slice of the user's financial history to the model. Totals come
 * from the summary provider, so the sample is for detail, not arithmetic.
 */
export const transactionSampleProvider: RetrievalProvider = {
  id: "transactions",
  async run(
    supabase: AiClient,
    _question: string,
    period: ResolvedPeriod,
  ): Promise<RetrievalSection> {
    const page = await getTransactions(supabase, {
      dateFrom: period.from,
      dateTo: period.to,
      page: 1,
    });

    const sample = page.transactions.slice(0, 20);

    return {
      id: "transactions",
      title: `Transactions in ${period.label}`,
      source: { label: "transactions", count: page.total },
      data: {
        totalMatching: page.total,
        totals: page.totals,
        sample: sample.map((t) => ({
          date: t.occurred_on,
          type: t.type,
          amount: String(t.amount),
          account: t.account_name,
          category: t.category_name,
          transferTo: t.transfer_account_name,
          description: t.description ?? t.payee ?? null,
        })),
      },
    };
  },
};

/** All registered providers. Order affects prompt order, not correctness. */
export const ALL_PROVIDERS: RetrievalProvider[] = [
  accountsProvider,
  periodSummaryProvider,
  budgetProvider,
  transactionSampleProvider,
];
