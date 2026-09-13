import Link from "next/link";

import { AccountForm } from "@/components/accounts/account-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { createAccountAction } from "@/app/(app)/accounts/actions";

export const metadata = { title: "New account" };

export default async function NewAccountPage() {
  await requireUser();

  return (
    <div className="max-w-xl">
      <PageHeader title="Add account" />
      <AccountForm
        action={createAccountAction}
        initial={{ type: "cash", currency: "TZS", openingBalance: "0" }}
        submitLabel="Create account"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/accounts" className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
