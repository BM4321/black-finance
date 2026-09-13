import { formatMoney } from "@/lib/finance/money";
import {
  classifyBudget,
  progressWidth,
  type BudgetStatus,
} from "@/lib/finance/budgets";
import type { BudgetStatusRow } from "@/lib/data/budgets";

const STATUS_BAR: Record<BudgetStatus, string> = {
  safe: "bg-positive",
  warning: "bg-warning",
  over: "bg-negative",
};

const STATUS_TEXT: Record<BudgetStatus, string> = {
  safe: "text-foreground",
  warning: "text-warning",
  over: "text-negative",
};

/**
 * A single budget line: budgeted, spent, remaining and a progress bar.
 *
 * The over/warning state is derived from the percentage the database returned,
 * so the bar and the text can never disagree.
 */
export function BudgetRow({ row }: { row: BudgetStatusRow }) {
  const status = classifyBudget(row.percentUsed);
  const remaining = Number(row.remaining);

  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium">{row.categoryName}</span>
        <span className={`tabular-nums text-sm font-semibold ${STATUS_TEXT[status]}`}>
          {formatMoney(row.spent)}{" "}
          <span className="font-normal text-muted-foreground">
            / {formatMoney(row.budgeted)}
          </span>
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full ${STATUS_BAR[status]}`}
          style={{ width: `${progressWidth(row.percentUsed)}%` }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {row.percentUsed.toFixed(0)}% used
        </span>
        <span className={remaining < 0 ? "text-negative" : "text-muted-foreground"}>
          {remaining < 0
            ? `${formatMoney(Math.abs(remaining))} over budget`
            : `${formatMoney(row.remaining)} remaining`}
        </span>
      </div>
    </li>
  );
}
