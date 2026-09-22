import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteDebtAction,
  updateDebtAction,
} from "@/app/(app)/debts/actions";
import { DebtForm } from "@/components/debts/debt-form";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { getDebt } from "@/lib/data/debts";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit debt" };

export default async function EditDebtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const debt = await getDebt(supabase, id);
  if (!debt) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Edit debt" />
      <DebtForm
        action={updateDebtAction}
        debtId={debt.id}
        initial={{
          direction: debt.direction,
          counterparty: debt.counterparty,
          principal: String(debt.principal),
          remainingAmount: String(debt.remaining_amount),
          startedOn: debt.started_on,
          dueDate: debt.due_date ?? "",
          notes: debt.notes ?? "",
        }}
        submitLabel="Save changes"
      />

      <div className="mt-6 flex items-center justify-between rounded-xl border border-negative/30 bg-negative/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-negative">Delete debt</p>
          <p className="text-xs text-muted-foreground">
            Permanently removes this record.
          </p>
        </div>
        <form action={deleteDebtAction}>
          <input type="hidden" name="debtId" value={debt.id} />
          <ConfirmSubmitButton
            confirmText="Delete this debt? This cannot be undone."
            variant="danger"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/debts" className="font-medium text-primary">
          Back to debts
        </Link>
      </p>
    </div>
  );
}
