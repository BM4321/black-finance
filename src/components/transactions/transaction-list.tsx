import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";
import type { TransactionDetail } from "@/lib/data/transactions";
import { formatMoney } from "@/lib/finance/money";

function TypeBadge({ type }: { type: TransactionDetail["type"] }) {
  const tone =
    type === "income" ? "positive" : type === "expense" ? "negative" : "primary";
  return <Badge tone={tone}>{type}</Badge>;
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
    <ul className="stagger divide-y divide-border">
      {transactions.map((t) => (
        <li
          key={t.id}
          className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/50"
        >
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
            <LinkButton href={`/transactions/${t.id}/edit`} variant="ghost" size="small">
              Edit
            </LinkButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
