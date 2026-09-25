
import { archiveAccountAction } from "@/app/(app)/accounts/actions";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AccountWithBalance } from "@/lib/data/accounts";
import { formatMoney } from "@/lib/finance/money";
import { ACCOUNT_TYPE_LABELS } from "@/types/domain";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";

function AccountRow({ account }: { account: AccountWithBalance }) {
  const balance = Number(account.current_balance);

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{account.name}</span>
          {account.is_archived && (
            <Badge>Archived</Badge>
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
        <LinkButton href={`/accounts/${account.account_id}/edit`} variant="ghost" size="small">
          Edit
        </LinkButton>
        <form action={archiveAccountAction}>
          <input type="hidden" name="accountId" value={account.account_id} />
          <input
            type="hidden"
            name="archived"
            value={account.is_archived ? "false" : "true"}
          />
          <SubmitButton variant="ghost" size="small">
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
