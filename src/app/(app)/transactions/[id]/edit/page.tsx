import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteTransactionAction,
  updateTransactionAction,
} from "@/app/(app)/transactions/actions";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";
import { getCategoriesByKind } from "@/lib/data/categories";
import { getTransaction } from "@/lib/data/transactions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit transaction" };

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const [transaction, accounts, categories] = await Promise.all([
    getTransaction(supabase, id),
    listAccounts(supabase),
    getCategoriesByKind(supabase),
  ]);

  if (!transaction) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Edit transaction" />
      <TransactionForm
        action={updateTransactionAction}
        accounts={accounts}
        categories={categories}
        transactionId={transaction.id}
        initial={{
          type: transaction.type,
          amount: String(transaction.amount),
          occurredOn: transaction.occurred_on,
          description: transaction.description ?? undefined,
          payee: transaction.payee ?? undefined,
          notes: transaction.notes ?? undefined,
          accountId: transaction.account_id,
          categoryId: transaction.category_id ?? undefined,
          transferAccountId: transaction.transfer_account_id ?? undefined,
        }}
        submitLabel="Save changes"
      />

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Link href="/transactions" className="text-sm font-medium text-primary">
          Cancel
        </Link>
        <form action={deleteTransactionAction}>
          <input type="hidden" name="transactionId" value={transaction.id} />
          <ConfirmSubmitButton
            confirmText="Delete this transaction? This cannot be undone."
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
