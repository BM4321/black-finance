import Link from "next/link";

import { createDebtAction } from "@/app/(app)/debts/actions";
import { DebtForm } from "@/components/debts/debt-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New debt" };

export default async function NewDebtPage() {
  await requireUser();

  return (
    <div className="max-w-xl">
      <PageHeader title="Add debt" />
      <DebtForm
        action={createDebtAction}
        initial={{ direction: "owed_by_me" }}
        submitLabel="Create debt"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/debts" className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
