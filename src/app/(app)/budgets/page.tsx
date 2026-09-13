import Link from "next/link";

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
import { getBudgetOverview, monthStart } from "@/lib/data/budgets";
import { listCategories } from "@/lib/data/categories";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Budgets" };

/** Parse `?month=YYYY-MM` into the first-of-month ISO date, defaulting to now. */
function parseMonth(value: string | string[] | undefined): string {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }
  return monthStart();
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
  const period = parseMonth(params.month);

  const supabase = await createClient();
  const [overview, expenseCategories] = await Promise.all([
    getBudgetOverview(supabase, period),
    listCategories(supabase, "expense"),
  ]);

  const hasBudget = overview.items.length > 0;
  const previousMonth = shiftMonth(period, -1);
  const nextMonth = shiftMonth(period, 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        subtitle="Your spending allowances by category."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/budgets?month=${previousMonth.slice(0, 7)}`}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
              aria-label="Previous month"
            >
              ←
            </Link>
            <span className="min-w-[9rem] text-center text-sm font-medium">
              {monthLabel(period)}
            </span>
            <Link
              href={`/budgets?month=${nextMonth.slice(0, 7)}`}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
              aria-label="Next month"
            >
              →
            </Link>
          </div>
        }
      />

      {hasBudget ? (
        <>
          {/* Summary respects the budget-vs-balance distinction explicitly. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total budgeted
              </span>
              <p className="tabular-nums text-lg font-semibold">
                {formatMoney(overview.totalBudgeted)}
              </p>
            </Card>
            <Card className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total spent
              </span>
              <p className="tabular-nums text-lg font-semibold">
                {formatMoney(overview.totalSpent)}
              </p>
              <span className="text-[11px] text-muted-foreground">
                Expenses only — transfers don’t count
              </span>
            </Card>
            <Card className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Unallocated
              </span>
              <p className="tabular-nums text-lg font-semibold">
                {formatMoney(overview.totalRemaining)}
              </p>
              <span className="text-[11px] text-muted-foreground">
                Allowance left, not account cash
              </span>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {overview.items.map((row) => (
                <BudgetRow key={row.itemId} row={row} />
              ))}
            </ul>
          </Card>

          <details className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium">
              Edit budget
            </summary>
            <div className="mt-4">
              <BudgetForm
                action={saveBudgetAction}
                categories={expenseCategories}
                existing={overview.items}
                periodMonth={period}
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
          />
        </Card>
      )}
    </div>
  );
}
