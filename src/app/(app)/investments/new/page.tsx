import Link from "next/link";

import { createHoldingAction } from "@/app/(app)/investments/actions";
import { InvestmentForm } from "@/components/investments/investment-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New investment" };

export default async function NewInvestmentPage() {
  await requireUser();

  return (
    <div className="max-w-xl">
      <PageHeader title="Add investment" />
      <InvestmentForm
        action={createHoldingAction}
        initial={{ quantity: "1", assetType: "stock" }}
        submitLabel="Create investment"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/investments" className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
