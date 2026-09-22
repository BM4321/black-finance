import Link from "next/link";

import {
  AccountBalancesSection,
  IncomeExpenseSection,
  NetWorthSection,
  SavingsRateSection,
  SpendingSection,
} from "@/components/reports/sections";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getReportsData } from "@/lib/data/reports";
import { formatMoney } from "@/lib/finance/money";
import { changeRatio, formatChange, shareOfTotal } from "@/lib/finance/reports";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reports" };

/** Resolve `?range=` into a date window and a month count. */
function resolveRange(value: string | string[] | undefined): {
  label: string;
  months: number;
  from: string;
  to: string;
} {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  const presets: Record<string, { label: string; months: number }> = {
    "3m": { label: "Last 3 months", months: 3 },
    "6m": { label: "Last 6 months", months: 6 },
    "12m": { label: "Last 12 months", months: 12 },
  };
  const key = typeof value === "string" && presets[value] ? value : "6m";
  const { label, months } = presets[key];

  const fromDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );
  const from = fromDate.toISOString().slice(0, 10);

  return { label, months, from, to };
}

function monthLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const range = resolveRange(params.range);

  const supabase = await createClient();
  const data = await getReportsData(supabase, {
    from: range.from,
    to: range.to,
    months: range.months,
  });

  const totalSpending = data.spendingByCategory.reduce(
    (acc, row) => acc + Number(row.total),
    0,
  );
  const topCategories = data.spendingByCategory.slice(0, 6);

  // Income/expense change across the loaded period (latest vs previous month).
  const latest = data.monthly.at(-1);
  const previous = data.monthly.at(-2);
  const incomeChange = changeRatio(latest?.income ?? "0", previous?.income ?? "0");
  const expenseChange = changeRatio(
    latest?.expense ?? "0",
    previous?.expense ?? "0",
  );

  const budgetHealth = data.budgets.items.reduce(
    (acc, item) => {
      if (item.percentUsed > 100) acc.over += 1;
      else if (item.percentUsed >= 80) acc.warning += 1;
      else acc.safe += 1;
      return acc;
    },
    { safe: 0, warning: 0, over: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle={range.label}
        action={
          <div className="flex items-center gap-1 rounded-lg bg-surface-muted p-1">
            {(["3m", "6m", "12m"] as const).map((key) => (
              <Link
                key={key}
                href={`/reports?range=${key}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  params.range === key || (!params.range && key === "6m")
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {key.toUpperCase()}
              </Link>
            ))}
          </div>
        }
      />

      {/* Headline comparisons ------------------------------------------- */}
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3 transition-shadow hover:shadow-md">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Income (latest month)
          </span>
          <p className="tabular-nums text-lg font-semibold text-positive">
            {formatMoney(latest?.income ?? "0")}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {formatChange(incomeChange)} vs previous month
          </span>
        </Card>
        <Card className="px-4 py-3 transition-shadow hover:shadow-md">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Expenses (latest month)
          </span>
          <p className="tabular-nums text-lg font-semibold text-negative">
            {formatMoney(latest?.expense ?? "0")}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {formatChange(expenseChange)} vs previous month
          </span>
        </Card>
        <Card className="px-4 py-3 transition-shadow hover:shadow-md">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Net worth today
          </span>
          <p className="tabular-nums text-lg font-semibold">
            {formatMoney(data.breakdown.netWorth)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Accounts + investments + debts
          </span>
        </Card>
      </div>

      {/* Income vs expenses --------------------------------------------- */}
      <Card className="animate-fade-up p-4">
        <IncomeExpenseSection data={data.monthly} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up p-4">
          <SavingsRateSection data={data.monthly} />
        </Card>
        <Card className="animate-fade-up p-4">
          <NetWorthSection data={data.netWorthHistory} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up p-4">
          <SpendingSection
            data={data.spendingByCategory}
            title={`Spending by category · ${range.label.toLowerCase()}`}
          />
        </Card>
        <Card className="animate-fade-up p-4">
          <AccountBalancesSection data={data.accounts} />
        </Card>
      </div>

      {/* Top categories + budget performance ---------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="animate-fade-up p-4">
          <h2 className="mb-3 text-sm font-semibold">Top categories</h2>
          {topCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses in this period.
            </p>
          ) : (
            <ul className="stagger space-y-3">
              {topCategories.map((row) => {
                const share = shareOfTotal(row.total, String(totalSpending));
                return (
                  <li key={row.categoryName}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{row.categoryName}</span>
                      <span className="tabular-nums">
                        {formatMoney(row.total)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {share === null ? "—" : `${(share * 100).toFixed(0)}%`}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="animate-fade-up p-4">
          <h2 className="mb-1 text-sm font-semibold">Budget performance</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {monthLabel(data.budgets.periodMonth)}
          </p>
          {data.budgets.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No budget set for this month.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-positive">{budgetHealth.safe} on track</span>
                <span className="text-warning">
                  {budgetHealth.warning} near limit
                </span>
                <span className="text-negative">{budgetHealth.over} over</span>
              </div>
              <div className="mb-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Total spent</span>
                <span className="tabular-nums font-semibold">
                  {formatMoney(data.budgets.totalSpent)} /{" "}
                  {formatMoney(data.budgets.totalBudgeted)}
                </span>
              </div>
              <ul className="stagger space-y-2">
                {data.budgets.items.map((item) => (
                  <li key={item.itemId}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{item.categoryName}</span>
                      <span className="tabular-nums text-xs">
                        {item.percentUsed.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          item.percentUsed > 100
                            ? "bg-negative"
                            : item.percentUsed >= 80
                              ? "bg-warning"
                              : "bg-positive"
                        }`}
                        style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
