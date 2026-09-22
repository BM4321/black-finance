"use client";

import { useActionState, useMemo, useState } from "react";

import type { InvestmentActionState } from "@/app/(app)/investments/actions";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { previewCostBasis, classifyGain } from "@/lib/finance/investments";
import { formatMoney, sumAmounts } from "@/lib/finance/money";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/types/domain";

type Action = (
  state: InvestmentActionState,
  formData: FormData,
) => Promise<InvestmentActionState>;

/** Renders the previewed gain/loss with its sign and colour. */
function PreviewGain({ gain }: { gain: string }) {
  const kind = classifyGain(gain);
  const tone =
    kind === "gain"
      ? "text-positive"
      : kind === "loss"
        ? "text-negative"
        : "text-muted-foreground";
  const magnitude = gain.startsWith("-") ? gain.slice(1) : gain;
  const label = kind === "gain" ? " gain" : kind === "loss" ? " loss" : "";

  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">Gain / loss</dt>
      <dd className={`tabular-nums font-semibold ${tone}`}>
        {formatMoney(magnitude)}
        {label}
      </dd>
    </div>
  );
}

export function InvestmentForm({
  action,
  initial,
  investmentId,
  submitLabel,
}: {
  action: Action;
  initial?: {
    name?: string;
    assetType?: string;
    quantity?: string;
    purchasePrice?: string;
    purchaseDate?: string;
    currentValue?: string;
    notes?: string;
  };
  investmentId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = { ...initial, ...state.values };

  // Local state for the live cost-basis preview. These mirror the submitted
  // fields; the server remains the source of truth.
  const [quantity, setQuantity] = useState(values.quantity ?? "1");
  const [purchasePrice, setPurchasePrice] = useState(
    values.purchasePrice ?? "",
  );
  const [currentValue, setCurrentValue] = useState(values.currentValue ?? "");

  const costBasis = useMemo(
    () => previewCostBasis(quantity, purchasePrice),
    [quantity, purchasePrice],
  );

  // Only show the preview arithmetic once both figures are actually present.
  const hasCost =
    /^\d+(\.\d+)?$/.test(quantity.trim()) &&
    /^\d+(\.\d+)?$/.test(purchasePrice.trim());
  const hasValue = /^\d+(\.\d+)?$/.test(currentValue.trim());
  const gain = useMemo(() => {
    if (!hasValue || !hasCost) return null;
    // Exact subtraction via integer minor units, never a float.
    return sumAmounts([currentValue, `-${costBasis}`]);
  }, [currentValue, costBasis, hasValue, hasCost]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      {investmentId && (
        <input type="hidden" name="investmentId" value={investmentId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="e.g. NMB shares"
            defaultValue={values.name}
            invalid={Boolean(state.errors?.name)}
          />
          <FieldError messages={state.errors?.name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assetType">Asset type</Label>
          <Select
            id="assetType"
            name="assetType"
            defaultValue={values.assetType ?? "stock"}
            invalid={Boolean(state.errors?.assetType)}
          >
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {ASSET_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <FieldError messages={state.errors?.assetType} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            invalid={Boolean(state.errors?.quantity)}
          />
          <FieldError messages={state.errors?.quantity} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchasePrice">Price per unit</Label>
          <Input
            id="purchasePrice"
            name="purchasePrice"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={purchasePrice}
            onChange={(event) => setPurchasePrice(event.target.value)}
            invalid={Boolean(state.errors?.purchasePrice)}
          />
          <FieldError messages={state.errors?.purchasePrice} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchaseDate">Purchase date</Label>
          <Input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            defaultValue={values.purchaseDate}
            invalid={Boolean(state.errors?.purchaseDate)}
          />
          <p className="text-xs text-muted-foreground">Optional</p>
          <FieldError messages={state.errors?.purchaseDate} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="currentValue">Current value</Label>
        <Input
          id="currentValue"
          name="currentValue"
          inputMode="decimal"
          placeholder="Optional — leave blank to use cost"
          value={currentValue}
          onChange={(event) => setCurrentValue(event.target.value)}
          invalid={Boolean(state.errors?.currentValue)}
        />
        <p className="text-xs text-muted-foreground">
          The market value of the whole holding. Update it manually; leave blank
          to count it at cost.
        </p>
        <FieldError messages={state.errors?.currentValue} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Optional"
          defaultValue={values.notes}
          invalid={Boolean(state.errors?.notes)}
        />
        <FieldError messages={state.errors?.notes} />
      </div>

      {/* Live preview: cost basis and, when a current value is given, gain. */}
      {hasCost && (
        <dl className="space-y-1 rounded-xl border border-border bg-surface-muted/50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Cost basis</dt>
            <dd className="tabular-nums font-semibold">
              {formatMoney(costBasis)}
            </dd>
          </div>
          {gain !== null && (
            <PreviewGain gain={gain} />
          )}
        </dl>
      )}

      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
