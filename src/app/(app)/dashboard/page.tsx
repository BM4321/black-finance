import Link from "next/link";

import { StatCard } from "@/components/dashboard/stat-card";
import {
  BudgetHealth,
  CashFlowSnapshot,
  NetWorthComposition,
  TopSpendingCategories,
} from "@/components/dashboard/widgets";
import {
  IncomeExpenseSection,
  SavingsRateSection,
  SpendingSection,
} from "@/components/reports/sections";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getBudgetOverview, monthStart } from "@/lib/data/budgets";
import {
  getBalanceBreakdown,
  getMonthlySummary,
  getSpendingByCategory,
} from "@/lib/data/dashboard";
import { listGoals } from "@/lib/data/goals";
import { getTransactions } from "@/lib/data/transactions";
import { calculateSavingsRate, formatSavingsRate } from "@/lib/finance/health";
import { goalProgressWidth } from "@/lib/finance/goals";
import { formatMoney, sumAmounts } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

/** First and last day of the current month, as ISO date strings. */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default async function DashboardPage() {
  await requireUser();
  const supabase = await createClient();
  const { from, to } = currentMonthRange();

  const [balances, monthly, spending, recent, goals, budgets] =
    await Promise.all([
      getBalanceBreakdown(supabase),
      getMonthlySummary(supabase, 6),
      getSpendingByCategory(supabase, from, to),
      getTransactions(supabase, { page: 1 }),
      listGoals(supabase),
      getBudgetOverview(supabase, monthStart()),
    ]);

  // This month is the last bucket in the ordered series; last month the one
  // before it.
  const thisMonth = monthly.at(-1);
  const lastMonth = monthly.at(-2);
  const income = thisMonth?.income ?? "0";
  const expense = thisMonth?.expense ?? "0";
  const savings = thisMonth?.savings ?? "0";
  const savingsRate = calculateSavingsRate(income, expense);

  const totalSpending = sumAmounts(spending.map((row) => row.total));

  // Net debt position: money owed to me minus money I owe.
  const debtNet = sumAmounts([
    balances.owedToMe,
    `-${balances.owedByMe}`,
  ]);
  const hasDebts = Number(balances.owedToMe) !== 0 || Number(balances.owedByMe) !== 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where your money stands right now.
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Add transaction
        </Link>
      </div>

      {/* Headline numbers -------------------------------------------------- */}
      {/* Balances first: spendable, savings and investments are shown
          separately so money set aside is never mixed into everyday cash. */}
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Spendable balance"
          value={formatMoney(balances.spendable)}
          hint="Cash, bank, mobile money & other"
        />
        <StatCard
          label="In savings accounts"
          value={formatMoney(balances.savings)}
          hint="Set aside, not counted as spendable"
          tone="positive"
        />
        <StatCard
          label="Investments"
          value={formatMoney(balances.investments)}
          hint="Market value of holdings"
        />
        {hasDebts && (
          <StatCard
            label="Debts (net)"
            value={formatMoney(debtNet)}
            hint={`Owed to me ${formatMoney(balances.owedToMe)} · I owe ${formatMoney(balances.owedByMe)}`}
            tone={Number(debtNet) < 0 ? "negative" : "positive"}
          />
        )}
        <StatCard
          label="Net worth"
          value={formatMoney(balances.netWorth)}
          hint="Spendable + savings + investments + debts"
        />
        <StatCard
          label="Income this month"
          value={formatMoney(income)}
          tone="positive"
        />
        <StatCard
          label="Expenses this month"
          value={formatMoney(expense)}
          tone="negative"
        />
        <StatCard
          label="Saved this month"
          value={formatMoney(savings)}
          hint={`Savings rate ${formatSavingsRate(savingsRate)}`}
          tone={Number(savings) < 0 ? "negative" : "neutral"}
        />
      </div>

      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Trend ----------------------------------------------------------- */}
        <Card className="p-4 transition-shadow hover:shadow-md">
          <IncomeExpenseSection
            data={monthly}
            title="Income vs expenses · last 6 months"
          />
        </Card>

        {/* Spending by category ------------------------------------------- */}
        <Card className="p-4 transition-shadow hover:shadow-md">
          <SpendingSection
            data={spending}
            title="Spending by category · this month"
          />
        </Card>
      </div>

      {/* Insight widgets --------------------------------------------------- */}
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NetWorthComposition
          spendable={balances.spendable}
          savings={balances.savings}
          investments={balances.investments}
          owedToMe={balances.owedToMe}
          owedByMe={balances.owedByMe}
          netWorth={balances.netWorth}
        />
        <CashFlowSnapshot
          income={income}
          expense={expense}
          savings={savings}
          previousIncome={lastMonth?.income ?? "0"}
          previousExpense={lastMonth?.expense ?? "0"}
        />
        <TopSpendingCategories data={spending} total={totalSpending} />
        <BudgetHealth
          items={budgets.items}
          totalSpent={budgets.totalSpent}
          totalBudgeted={budgets.totalBudgeted}
        />
      </div>

      {/* Savings rate ------------------------------------------------------ */}
      <Card className="animate-fade-up p-4">
        <SavingsRateSection data={monthly} />
      </Card>

      {/* Recent transactions ---------------------------------------------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Recent transactions</h2>
          <Link
            href="/transactions"
            className="text-xs font-medium text-primary"
          >
            View all
          </Link>
        </div>
        <TransactionList transactions={recent.transactions.slice(0, 6)} />
      </Card>

      {/* Goals ------------------------------------------------------------ */}
      {goals.active.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Goal progress</h2>
            <Link href="/goals" className="text-xs font-medium text-primary">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {goals.active.slice(0, 3).map((goal) => (
              <li key={goal.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/goals/${goal.id}`}
                    className="min-w-0 truncate text-sm font-medium hover:text-primary"
                  >
                    {goal.name}
                  </Link>
                  <span className="tabular-nums text-sm font-semibold">
                    {formatMoney(goal.current_amount)}{" "}
                    <span className="font-normal text-muted-foreground">
                      / {formatMoney(goal.target_amount)}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${goalProgressWidth(goal.percent_complete)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
