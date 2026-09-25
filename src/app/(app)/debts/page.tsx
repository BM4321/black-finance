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
import AddRounded from "@mui/icons-material/AddRounded";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/dashboard/stat-card";

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
            <SubmitButton variant="ghost" size="small">
              Mark settled
            </SubmitButton>
          </form>
          <LinkButton href={`/debts/${debt.id}/edit`} variant="ghost" size="small">
            Edit
          </LinkButton>
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
        <SubmitButton variant="ghost" size="small">
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
          <LinkButton href="/debts/new" variant="primary" startIcon={<AddRounded />}>
            Add debt
          </LinkButton>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="No debts tracked"
          description="Record money you owe or money owed to you, with an optional due date. Open debts affect your net worth."
          action={
            <LinkButton href="/debts/new" variant="primary" startIcon={<AddRounded />}>
              Add debt
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="I owe" value={formatMoney(totalOwedByMe)} tone="negative" />
            <StatCard label="Owed to me" value={formatMoney(totalOwedToMe)} tone="positive" />
            <StatCard
              label="Net position"
              value={formatMoney(net)}
              hint="Owed to me − what I owe"
              tone={Number(net) < 0 ? "negative" : "positive"}
            />
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
