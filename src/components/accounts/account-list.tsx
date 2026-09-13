import Link from "next/link";

import { archiveAccountAction } from "@/app/(app)/accounts/actions";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AccountWithBalance } from "@/lib/data/accounts";
import { formatMoney } from "@/lib/finance/money";
import { ACCOUNT_TYPE_LABELS } from "@/types/domain";

function AccountRow({ account }: { account: AccountWithBalance }) {
  const balance = Number(account.current_balance);

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{account.name}</span>
          {account.is_archived && (
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
        </span>
      </div>

      <span
        className={`tabular-nums text-sm font-semibold ${
          balance < 0 ? "text-negative" : ""
        }`}
      >
        {formatMoney(account.current_balance, account.currency)}
      </span>

      <div className="flex items-center gap-1">
        <Link
          href={`/accounts/${account.account_id}/edit`}
          className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          Edit
        </Link>
        <form action={archiveAccountAction}>
          <input type="hidden" name="accountId" value={account.account_id} />
          <input
            type="hidden"
            name="archived"
            value={account.is_archived ? "false" : "true"}
          />
          <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
            {account.is_archived ? "Restore" : "Archive"}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

export function AccountList({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {accounts.map((account) => (
          <AccountRow key={account.account_id} account={account} />
        ))}
      </ul>
    </Card>
  );
}
