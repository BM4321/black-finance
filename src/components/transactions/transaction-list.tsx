import { EmptyState } from "@/components/ui/empty-state";
import type { TransactionDetail } from "@/lib/data/transactions";
import { formatMoney } from "@/lib/finance/money";

function TypeBadge({ type }: { type: TransactionDetail["type"] }) {
  const palette =
    type === "income"
      ? "bg-positive/10 text-positive"
      : type === "expense"
        ? "bg-negative/10 text-negative"
        : "bg-primary/10 text-primary";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${palette}`}
    >
      {type}
    </span>
  );
}

/** Signed amount: income positive, expense/transfer negative for the source. */
function signedAmount(t: TransactionDetail): string {
  if (t.type === "income") return formatMoney(t.amount);
  return `-${formatMoney(t.amount)}`;
}

function subtitle(t: TransactionDetail): string {
  const parts: string[] = [t.account_name];
  if (t.type === "transfer" && t.transfer_account_name) {
    parts.push(`→ ${t.transfer_account_name}`);
  } else if (t.category_name) {
    parts.push(t.category_name);
  }
  return parts.join(" · ");
}

export function TransactionList({
  transactions,
}: {
  transactions: TransactionDetail[];
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No transactions found"
        description="Adjust your filters, or record your first transaction."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {t.description || t.payee || t.category_name || "Transaction"}
              </span>
              <TypeBadge type={t.type} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {subtitle(t)} · {t.occurred_on}
            </p>
          </div>

          <div className="text-right">
            <p
              className={`tabular-nums text-sm font-semibold ${
                t.type === "income"
                  ? "text-positive"
                  : t.type === "expense"
                    ? "text-negative"
                    : "text-muted-foreground"
              }`}
            >
              {signedAmount(t)}
            </p>
            <a
              href={`/transactions/${t.id}/edit`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Edit
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
