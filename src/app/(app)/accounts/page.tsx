
import { AccountList } from "@/components/accounts/account-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getAccountSummary } from "@/lib/data/accounts";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import AddRounded from "@mui/icons-material/AddRounded";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/dashboard/stat-card";

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
          <LinkButton href="/accounts/new" variant="primary" startIcon={<AddRounded />}>
            Add account
          </LinkButton>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Add your first account — cash, bank, mobile money, or anything else you track."
          action={
            <LinkButton href="/accounts/new" variant="primary" startIcon={<AddRounded />}>
              Add account
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total across accounts" value={formatMoney(totalBalance)} />
            <StatCard label="Spendable" value={formatMoney(spendableBalance)} hint="Excludes savings accounts" />
            <StatCard label="Savings" value={formatMoney(savingsBalance)} hint={`${hasSavings ? "Money set aside" : "No savings account yet"}`} tone="positive" />
          </div>
          <AccountList accounts={accounts} />
        </>
      )}
    </div>
  );
}
