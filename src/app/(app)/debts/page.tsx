import Link from "next/link";

import {
  settleDebtAction,
  writeOffDebtAction,
} from "@/app/(app)/debts/actions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { listDebts, type DebtRow } from "@/lib/data/debts";
import { daysUntilDue, isOverdue } from "@/lib/finance/debts";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import { DEBT_DIRECTION_LABELS, DEBT_STATUS_LABELS } from "@/types/domain";

export const metadata = { title: "Debts" };

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Human due-date summary, with an overdue marker for open debts. */
function dueLabel(debt: DebtRow): string | null {
  const days = daysUntilDue(debt.due_date);
  if (days === null) return null;
  if (isOverdue(debt.status, debt.due_date)) {
    return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  }
  if (days === 0) return "Due today";
  return `Due ${formatDay(debt.due_date as string)}`;
}

function OpenDebtRow({ debt }: { debt: DebtRow }) {
  const overdue = isOverdue(debt.status, debt.due_date);
  const settled = Number(debt.settled_amount);

  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/debts/${debt.id}/edit`}
            className="truncate text-sm font-medium hover:text-primary"
          >
            {debt.counterparty}
          </Link>
          <p className="text-xs text-muted-foreground">
            {DEBT_DIRECTION_LABELS[debt.direction]} · started{" "}
            {formatDay(debt.started_on)}
          </p>
        </div>
        <span className="tabular-nums text-sm font-semibold">
          {formatMoney(debt.remaining_amount)}
          <span className="font-normal text-muted-foreground">
            {" "}
            / {formatMoney(debt.principal)}
          </span>
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={overdue ? "text-negative" : "text-muted-foreground"}>
          {dueLabel(debt) ?? "No due date"}
          {settled > 0 && ` · ${formatMoney(debt.settled_amount)} settled`}
        </span>
        <span className="flex items-center gap-1">
          <form action={settleDebtAction}>
            <input type="hidden" name="debtId" value={debt.id} />
            <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
              Mark settled
            </SubmitButton>
          </form>
          <Link
            href={`/debts/${debt.id}/edit`}
            className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            Edit
          </Link>
        </span>
      </div>
    </li>
  );
}

function ClosedDebtRow({ debt }: { debt: DebtRow }) {
  const writtenOff = debt.status === "written_off";

  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <span className="truncate text-sm">{debt.counterparty}</span>
        <p className="text-xs text-muted-foreground">
          {DEBT_STATUS_LABELS[debt.status]} · {formatMoney(debt.principal)}
        </p>
      </div>
      <form action={writeOffDebtAction}>
        <input type="hidden" name="debtId" value={debt.id} />
        <input type="hidden" name="writtenOff" value={writtenOff ? "false" : "true"} />
        <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
          {writtenOff ? "Reopen" : "Write off"}
        </SubmitButton>
      </form>
    </li>
  );
}

export default async function DebtsPage() {
  await requireUser();
  const supabase = await createClient();
  const {
    owedByMe,
    owedToMe,
    closed,
    totalOwedByMe,
    totalOwedToMe,
    net,
  } = await listDebts(supabase);

  const isEmpty = owedByMe.length + owedToMe.length + closed.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debts"
        subtitle="Money you owe, and money owed to you."
        action={
          <Link
            href="/debts/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Add debt
          </Link>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="No debts tracked"
          description="Record money you owe or money owed to you, with an optional due date. Open debts affect your net worth."
          action={
            <Link
              href="/debts/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Add debt
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                I owe
              </span>
              <p className="tabular-nums text-lg font-semibold text-negative">
                {formatMoney(totalOwedByMe)}
              </p>
            </Card>
            <Card className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Owed to me
              </span>
              <p className="tabular-nums text-lg font-semibold text-positive">
                {formatMoney(totalOwedToMe)}
              </p>
            </Card>
            <Card className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Net position
              </span>
              <p
                className={`tabular-nums text-lg font-semibold ${
                  Number(net) < 0 ? "text-negative" : "text-positive"
                }`}
              >
                {formatMoney(net)}
              </p>
              <span className="text-[11px] text-muted-foreground">
                Owed to me − what I owe
              </span>
            </Card>
          </div>

          {owedByMe.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">I owe</h2>
              </div>
              <ul className="divide-y divide-border">
                {owedByMe.map((debt) => (
                  <OpenDebtRow key={debt.id} debt={debt} />
                ))}
              </ul>
            </Card>
          )}

          {owedToMe.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Owed to me</h2>
              </div>
              <ul className="divide-y divide-border">
                {owedToMe.map((debt) => (
                  <OpenDebtRow key={debt.id} debt={debt} />
                ))}
              </ul>
            </Card>
          )}

          {closed.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium">
                Settled & written off ({closed.length})
              </summary>
              <ul className="mt-3 divide-y divide-border">
                {closed.map((debt) => (
                  <ClosedDebtRow key={debt.id} debt={debt} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
