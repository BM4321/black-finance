import Link from "next/link";

import { AccountList } from "@/components/accounts/account-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getAccountSummary } from "@/lib/data/accounts";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  await requireUser();
  const supabase = await createClient();
  const { accounts, totalBalance, spendableBalance, savingsBalance } =
    await getAccountSummary(supabase);

  const hasSavings = accounts.some((account) => account.type === "savings");

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Where your money lives."
        action={
          <Link
            href="/accounts/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Add account
          </Link>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your first account — cash, bank, mobile money, or anything else you track."
          action={
            <Link
              href="/accounts/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Add account
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total across accounts
              </span>
              <p className="tabular-nums text-2xl font-semibold">
                {formatMoney(totalBalance)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Spendable
              </span>
              <p className="tabular-nums text-2xl font-semibold">
                {formatMoney(spendableBalance)}
              </p>
              <span className="text-[11px] text-muted-foreground">
                Excludes savings accounts
              </span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Savings
              </span>
              <p className="tabular-nums text-2xl font-semibold text-positive">
                {formatMoney(savingsBalance)}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {hasSavings
                  ? "Money set aside"
                  : "No savings account yet"}
              </span>
            </div>
          </div>
          <AccountList accounts={accounts} />
        </>
      )}
    </div>
  );
}
