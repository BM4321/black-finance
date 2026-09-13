import Link from "next/link";
import { notFound } from "next/navigation";

import { updateAccountAction } from "@/app/(app)/accounts/actions";
import { AccountForm } from "@/components/accounts/account-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/accounts";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit account" };

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const account = await getAccount(supabase, id);
  if (!account) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Edit account" />
      <AccountForm
        action={updateAccountAction}
        accountId={account.account_id}
        initial={{
          name: account.name,
          type: account.type,
          currency: account.currency,
          openingBalance: String(account.opening_balance),
          notes: account.notes ?? undefined,
        }}
        submitLabel="Save changes"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/accounts" className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
