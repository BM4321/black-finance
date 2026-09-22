import { listAccounts } from "@/lib/data/accounts";
import { getBudgetOverview, monthStart } from "@/lib/data/budgets";
import {
  getBalanceBreakdown,
  getMonthlySummary,
  getSpendingByCategory,
} from "@/lib/data/dashboard";
import { listDebts } from "@/lib/data/debts";
import { listGoals } from "@/lib/data/goals";
import { listHoldings } from "@/lib/data/investments";
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
    const balances = await getBalanceBreakdown(supabase);

    return {
      id: "accounts",
      title: "Accounts",
      source: { label: "accounts", count: accounts.length },
      data: {
        spendable: balances.spendable,
        savings: balances.savings,
        investments: balances.investments,
        owedToMe: balances.owedToMe,
        owedByMe: balances.owedByMe,
        netWorth: balances.netWorth,
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

/**
 * Savings goals with derived progress, plus what has been set aside in total.
 *
 * Progress is computed by the database (`goal_progress`), so the model is
 * given finished figures rather than asked to divide.
 */
export const goalsProvider: RetrievalProvider = {
  id: "goals",
  async run(supabase: AiClient): Promise<RetrievalSection> {
    const summary = await listGoals(supabase);
    const active = summary.active;

    return {
      id: "goals",
      title: "Savings goals",
      source: { label: "goals", count: active.length },
      data: {
        totalSaved: summary.totalSaved,
        totalTarget: summary.totalTarget,
        activeGoals: active.map((goal) => ({
          name: goal.name,
          target: String(goal.target_amount),
          saved: String(goal.current_amount),
          remaining: String(goal.remaining),
          percentComplete: goal.percent_complete,
          targetDate: goal.target_date,
        })),
        archivedCount: summary.archived.length,
      },
    };
  },
};

/**
 * Investment holdings with their derived cost, market value and gain.
 *
 * A holding's current value is updated manually, so it is reported as-is; the
 * model is told not to treat it as a live market quote.
 */
export const investmentsProvider: RetrievalProvider = {
  id: "investments",
  async run(supabase: AiClient): Promise<RetrievalSection> {
    const portfolio = await listHoldings(supabase);
    const active = portfolio.active;

    return {
      id: "investments",
      title: "Investments",
      source: { label: "holdings", count: active.length },
      data: {
        totalValue: portfolio.totalValue,
        totalCost: portfolio.totalCost,
        totalGain: portfolio.totalGain,
        note: "Current values are entered manually, not live market prices.",
        holdings: active.map((holding) => ({
          name: holding.name,
          assetType: holding.asset_type,
          quantity: String(holding.quantity),
          costBasis: String(holding.cost_basis),
          marketValue: String(holding.market_value),
          gain: String(holding.gain),
          purchaseDate: holding.purchase_date,
        })),
        archivedCount: portfolio.archived.length,
      },
    };
  },
};

/**
 * Open debts by direction, plus totals and the net position.
 *
 * Only open debts are listed as outstanding; settled and written-off debts are
 * summarised by count. `status` is derived by the database.
 */
export const debtsProvider: RetrievalProvider = {
  id: "debts",
  async run(supabase: AiClient): Promise<RetrievalSection> {
    const summary = await listDebts(supabase);

    return {
      id: "debts",
      title: "Debts",
      source: {
        label: "debts",
        count: summary.owedByMe.length + summary.owedToMe.length,
      },
      data: {
        totalOwedByMe: summary.totalOwedByMe,
        totalOwedToMe: summary.totalOwedToMe,
        net: summary.net,
        owedByMe: summary.owedByMe.map((debt) => ({
          counterparty: debt.counterparty,
          principal: String(debt.principal),
          outstanding: String(debt.remaining_amount),
          dueDate: debt.due_date,
        })),
        owedToMe: summary.owedToMe.map((debt) => ({
          counterparty: debt.counterparty,
          principal: String(debt.principal),
          outstanding: String(debt.remaining_amount),
          dueDate: debt.due_date,
        })),
        closedCount: summary.closed.length,
      },
    };
  },
};

/** All registered providers. Order affects prompt order, not correctness. */
export const ALL_PROVIDERS: RetrievalProvider[] = [
  accountsProvider,
  periodSummaryProvider,
  budgetProvider,
  goalsProvider,
  investmentsProvider,
  debtsProvider,
  transactionSampleProvider,
];
