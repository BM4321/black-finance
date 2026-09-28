
import {
  copyBudgetAction,
  saveBudgetAction,
} from "@/app/(app)/budgets/actions";
import { BudgetForm } from "@/components/budgets/budget-form";
import { BudgetRow } from "@/components/budgets/budget-row";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import {
  getBudgetOverview,
  getBudgetPeriod,
  getCurrentBudgetMonth,
} from "@/lib/data/budgets";
import {
  addDays,
  calendarPeriod,
  defaultCustomEnd,
  formatPeriod,
  periodContains,
  todayIso,
  type BudgetPeriod,
} from "@/lib/finance/budget-periods";
import { listCategories } from "@/lib/data/categories";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Budgets" };

/** Parse `?month=YYYY-MM` into the first-of-month ISO date, or null. */
function parseMonth(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }
  return null;
}

/**
 * Dates to offer for a month that has no budget yet.
 *
 * If the previous budget used custom dates (payday to payday), continue the
 * cycle: start the day after it ends (which may still be in the previous
 * month, e.g. 24 Sep for October). Otherwise default to the calendar month.
 */
function suggestPeriod(month: string, previous: BudgetPeriod | null): BudgetPeriod {
  if (previous?.type === "custom") {
    const start = addDays(previous.end, 1);
    const end = defaultCustomEnd(start);
    const { start: monthFirst, end: monthLast } = calendarPeriod(month);
    if (start <= monthLast && end >= monthFirst) {
      return { type: "custom", start, end };
    }
  }
  return calendarPeriod(month);
}

/** Shift a month ISO date by a number of months. */
function shiftMonth(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
    .toISOString()
    .slice(0, 10);
}

function monthLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  // Without an explicit month, open the budget that covers today, which for a
  // payday-to-payday budget may have started last month.
  const period = parseMonth(params.month) ?? (await getCurrentBudgetMonth(supabase));
  const previousMonth = shiftMonth(period, -1);
  const nextMonth = shiftMonth(period, 1);

  const [overview, expenseCategories, previousPeriod] = await Promise.all([
    getBudgetOverview(supabase, period),
    listCategories(supabase, "expense"),
    getBudgetPeriod(supabase, previousMonth),
  ]);

  const hasBudget = overview.items.length > 0;
  const formPeriod = hasBudget ? overview.period : suggestPeriod(period, previousPeriod);
  const isCurrent = hasBudget && periodContains(overview.period, todayIso());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        subtitle="Your spending allowances by category."
        action={
          <div className="flex items-center gap-2">
            <LinkButton href={`/budgets?month=${previousMonth.slice(0, 7)}`} variant="secondary"
              aria-label="Previous month">
              ←
            </LinkButton>
            <span className="flex min-w-[11rem] flex-col items-center text-center">
              <span className="text-sm font-medium">{monthLabel(period)}</span>
              <span className="text-xs text-muted-foreground">
                {formatPeriod(hasBudget ? overview.period : formPeriod)}
              </span>
            </span>
            <LinkButton href={`/budgets?month=${nextMonth.slice(0, 7)}`} variant="secondary"
              aria-label="Next month">
              →
            </LinkButton>
          </div>
        }
      />

      {hasBudget ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge tone={overview.period.type === "custom" ? "primary" : "neutral"}>
              {overview.period.type === "custom" ? "Custom dates" : "Calendar month"}
            </Badge>
            {isCurrent && <Badge tone="positive">Current</Badge>}
            <span>
              Counting expenses from {formatPeriod(overview.period)}.
            </span>
          </div>

          {/* Summary respects the budget-vs-balance distinction explicitly. */}
          <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total budgeted" value={formatMoney(overview.totalBudgeted)} />
            <StatCard label="Total spent" value={formatMoney(overview.totalSpent)} hint="Expenses only — transfers don’t count" />
            <StatCard label="Unallocated" value={formatMoney(overview.totalRemaining)} hint="Allowance left, not account cash" />
          </div>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {overview.items.map((row) => (
                <BudgetRow key={row.itemId} row={row} />
              ))}
            </ul>
          </Card>

          <details className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium" data-tour="budget-edit">
              Edit budget
            </summary>
            <div className="mt-4">
              <BudgetForm
                action={saveBudgetAction}
                categories={expenseCategories}
                existing={overview.items}
                periodMonth={period}
                period={formPeriod}
              />
            </div>
          </details>
        </>
      ) : (
        <EmptyState
          title={`No budget for ${monthLabel(period)}`}
          description="Set spending allowances per category, or copy the previous month’s budget."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <form action={copyBudgetAction}>
                <input type="hidden" name="fromMonth" value={previousMonth} />
                <input type="hidden" name="toMonth" value={period} />
                <SubmitButton variant="secondary" pendingText="Copying…">
                  Copy previous month
                </SubmitButton>
              </form>
            </div>
          }
        />
      )}

      {!hasBudget && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Create a budget for {monthLabel(period)}
          </h2>
          <BudgetForm
            action={saveBudgetAction}
            categories={expenseCategories}
            existing={[]}
            periodMonth={period}
            period={formPeriod}
          />
        </Card>
      )}
    </div>
  );
}
