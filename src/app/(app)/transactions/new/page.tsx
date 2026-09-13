import Link from "next/link";
import { redirect } from "next/navigation";

import { createTransactionAction } from "@/app/(app)/transactions/actions";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";
import { getCategoriesByKind } from "@/lib/data/categories";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New transaction" };

export default async function NewTransactionPage() {
  await requireUser();
  const supabase = await createClient();

  const [accounts, categories] = await Promise.all([
    listAccounts(supabase),
    getCategoriesByKind(supabase),
  ]);

  // Recording a transaction requires at least one account to attach it to.
  if (accounts.length === 0) {
    redirect("/accounts/new");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Add transaction" />
      <TransactionForm
        action={createTransactionAction}
        accounts={accounts}
        categories={categories}
        submitLabel="Save transaction"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/transactions" className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
