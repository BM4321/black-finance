import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteHoldingAction,
  updateHoldingAction,
} from "@/app/(app)/investments/actions";
import { InvestmentForm } from "@/components/investments/investment-form";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { getHolding } from "@/lib/data/investments";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit investment" };

export default async function EditInvestmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const holding = await getHolding(supabase, id);
  if (!holding) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Edit investment" />
      <InvestmentForm
        action={updateHoldingAction}
        investmentId={holding.id}
        initial={{
          name: holding.name,
          assetType: holding.asset_type,
          quantity: String(holding.quantity),
          purchasePrice: String(holding.purchase_price),
          purchaseDate: holding.purchase_date ?? "",
          currentValue:
            holding.current_value === null ? "" : String(holding.current_value),
          notes: holding.notes ?? "",
        }}
        submitLabel="Save changes"
      />

      <div className="mt-6 flex items-center justify-between rounded-xl border border-negative/30 bg-negative/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-negative">Delete investment</p>
          <p className="text-xs text-muted-foreground">
            Permanently removes this holding.
          </p>
        </div>
        <form action={deleteHoldingAction}>
          <input type="hidden" name="investmentId" value={holding.id} />
          <ConfirmSubmitButton
            confirmText="Delete this investment? This cannot be undone."
            variant="danger"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/investments" className="font-medium text-primary">
          Back to investments
        </Link>
      </p>
    </div>
  );
}
