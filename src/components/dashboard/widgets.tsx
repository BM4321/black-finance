import { Card } from "@/components/ui/card";
import { classifyBudget } from "@/lib/finance/budgets";
import { formatMoney } from "@/lib/finance/money";
import { changeRatio, formatChange, shareOfTotal } from "@/lib/finance/reports";
import type { BudgetStatusRow } from "@/lib/data/budgets";
import type { CategorySpending } from "@/lib/data/dashboard";
import { ProgressBar } from "@/components/ui/progress-bar";

/**
 * Dashboard widgets.
 *
 * Presentational only: every figure is computed by the caller or the database.
 * Keeping the arithmetic out of these components means the same numbers are
 * shown everywhere without re-deriving them differently.
 */

type CompositionSegment = {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "negative";
};

/**
 * How net worth is composed: spendable, savings, investments, and net debts.
 *
 * Debt is shown as its net figure (owed to me minus what I owe) so the segments
 * sum to net worth. Negative segments render as a liability.
 */
export function NetWorthComposition({
  spendable,
  savings,
  investments,
  owedToMe,
  owedByMe,
  netWorth,
}: {
  spendable: string;
  savings: string;
  investments: string;
  owedToMe: string;
  owedByMe: string;
  netWorth: string;
}) {
  const netDebt = Number(owedToMe) - Number(owedByMe);

  const allSegments: CompositionSegment[] = [
    { label: "Spendable", value: spendable, tone: "neutral" },
    { label: "Savings", value: savings, tone: "positive" },
    { label: "Investments", value: investments, tone: "neutral" },
    {
      label: "Net debts",
      value: String(netDebt),
      tone: netDebt < 0 ? "negative" : "positive",
    },
  ];
  const segments = allSegments.filter(
    (segment) => Number(segment.value) !== 0,
  );

  const toneClass: Record<CompositionSegment["tone"], string> = {
    positive: "text-positive",
    neutral: "text-foreground",
    negative: "text-negative",
  };

  // Positive segments get a bar proportional to their share of the positive
  // total; a net liability is shown as a marker instead of a bar.
  const positiveTotal = segments
    .filter((segment) => Number(segment.value) > 0)
    .reduce((acc, segment) => acc + Number(segment.value), 0);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">What net worth is made of</h2>
        <span className="tabular-nums text-sm font-semibold">
          {formatMoney(netWorth)}
        </span>
      </div>

      {segments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing to show yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {segments.map((segment) => {
            const share =
              Number(segment.value) > 0 && positiveTotal > 0
                ? Number(segment.value) / positiveTotal
                : 0;
            return (
              <li key={segment.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">
                    {segment.label}
                  </span>
                  <span className={`tabular-nums font-medium ${toneClass[segment.tone]}`}>
                    {Number(segment.value) < 0 ? "-" : ""}
                    {formatMoney(
                      String(Math.abs(Number(segment.value))),
                    )}
                  </span>
                </div>
                <ProgressBar className="mt-1" value={Math.min(100, share * 100)} tone={segment.tone === "negative" ? "negative" : "primary"} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * Cash-flow snapshot: this month's income, expenses and the resulting net, with
 * the change against last month. Answers "am I better or worse than last
 * month?" at a glance.
 */
export function CashFlowSnapshot({
  income,
  expense,
  savings,
  previousIncome,
  previousExpense,
}: {
  income: string;
  expense: string;
  savings: string;
  previousIncome: string;
  previousExpense: string;
}) {
  const incomeChange = changeRatio(income, previousIncome);
  const expenseChange = changeRatio(expense, previousExpense);
  const net = Number(savings);

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">Cash flow this month</h2>
      <dl className="space-y-3">
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-muted-foreground">Income</dt>
          <dd className="tabular-nums text-sm font-semibold text-positive">
            {formatMoney(income)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {formatChange(incomeChange)}
            </span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-muted-foreground">Expenses</dt>
          <dd className="tabular-nums text-sm font-semibold text-negative">
            {formatMoney(expense)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {formatChange(expenseChange)}
            </span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <dt className="text-sm font-medium">Net</dt>
          <dd
            className={`tabular-nums text-base font-semibold ${
              net < 0 ? "text-negative" : "text-positive"
            }`}
          >
            {formatMoney(savings)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Compared with last month. Transfers are excluded.
      </p>
    </Card>
  );
}

/** Top spending categories this month, each with its share of total spending. */
export function TopSpendingCategories({
  data,
  total,
  limit = 5,
}: {
  data: CategorySpending[];
  total: string;
  limit?: number;
}) {
  const top = data.slice(0, limit);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Top spending this month</h2>
        <span className="tabular-nums text-xs text-muted-foreground">
          {formatMoney(total)}
        </span>
      </div>
      {top.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No expenses recorded this month.
        </p>
      ) : (
        <ul className="space-y-3">
          {top.map((row) => {
            const share = shareOfTotal(row.total, total);
            return (
              <li key={row.categoryId}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate">{row.categoryName}</span>
                  <span className="tabular-nums">
                    {formatMoney(row.total)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {share === null ? "—" : `${(share * 100).toFixed(0)}%`}
                    </span>
                  </span>
                </div>
                <ProgressBar className="mt-1" value={Math.min(100, (share ?? 0) * 100)} tone="primary" />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** A compact strip summarising budget health across categories. */
export function BudgetHealth({
  items,
  totalSpent,
  totalBudgeted,
}: {
  items: BudgetStatusRow[];
  totalSpent: string;
  totalBudgeted: string;
}) {
  const counts = items.reduce(
    (acc, item) => {
      acc[classifyBudget(item.percentUsed)] += 1;
      return acc;
    },
    { safe: 0, warning: 0, over: 0 } as Record<
      "safe" | "warning" | "over",
      number
    >,
  );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Budget health</h2>
        <span className="tabular-nums text-xs text-muted-foreground">
          {formatMoney(totalSpent)} / {formatMoney(totalBudgeted)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No budget set for this month.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface-muted px-3 py-3">
            <p className="tabular-nums text-lg font-semibold text-positive">
              {counts.safe}
            </p>
            <span className="text-[11px] text-muted-foreground">On track</span>
          </div>
          <div className="rounded-lg bg-surface-muted px-3 py-3">
            <p className="tabular-nums text-lg font-semibold text-warning">
              {counts.warning}
            </p>
            <span className="text-[11px] text-muted-foreground">Near limit</span>
          </div>
          <div className="rounded-lg bg-surface-muted px-3 py-3">
            <p className="tabular-nums text-lg font-semibold text-negative">
              {counts.over}
            </p>
            <span className="text-[11px] text-muted-foreground">Over</span>
          </div>
        </div>
      )}
    </Card>
  );
}
