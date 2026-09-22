"use client";

import { useActionState, useState } from "react";

import type { DebtActionState } from "@/app/(app)/debts/actions";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { settlementProgress } from "@/lib/finance/debts";
import { DEBT_DIRECTIONS, DEBT_DIRECTION_LABELS } from "@/types/domain";

type Action = (
  state: DebtActionState,
  formData: FormData,
) => Promise<DebtActionState>;

export function DebtForm({
  action,
  initial,
  debtId,
  submitLabel,
}: {
  action: Action;
  initial?: {
    direction?: string;
    counterparty?: string;
    principal?: string;
    remainingAmount?: string;
    startedOn?: string;
    dueDate?: string;
    notes?: string;
  };
  debtId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = { ...initial, ...state.values };
  const today = new Date().toISOString().slice(0, 10);

  // "Remaining" defaults to the principal on a new debt (nothing repaid yet),
  // which is the common case and saves a keystroke.
  const [principal, setPrincipal] = useState(values.principal ?? "");
  const [remaining, setRemaining] = useState(
    values.remainingAmount ?? initial?.principal ?? "",
  );

  const progress = settlementProgress(
    principal === "" ? "0" : principal,
    remaining === "" ? "0" : remaining,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      {debtId && <input type="hidden" name="debtId" value={debtId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="direction">Direction</Label>
          <Select
            id="direction"
            name="direction"
            defaultValue={values.direction ?? "owed_by_me"}
            invalid={Boolean(state.errors?.direction)}
          >
            {DEBT_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {DEBT_DIRECTION_LABELS[direction]}
              </option>
            ))}
          </Select>
          <FieldError messages={state.errors?.direction} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="counterparty">Person or entity</Label>
          <Input
            id="counterparty"
            name="counterparty"
            required
            placeholder="e.g. NMB, or a friend's name"
            defaultValue={values.counterparty}
            invalid={Boolean(state.errors?.counterparty)}
          />
          <FieldError messages={state.errors?.counterparty} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="principal">Original amount</Label>
          <Input
            id="principal"
            name="principal"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={principal}
            onChange={(event) => setPrincipal(event.target.value)}
            invalid={Boolean(state.errors?.principal)}
          />
          <FieldError messages={state.errors?.principal} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="remainingAmount">Outstanding</Label>
          <Input
            id="remainingAmount"
            name="remainingAmount"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={remaining}
            onChange={(event) => setRemaining(event.target.value)}
            invalid={Boolean(state.errors?.remainingAmount)}
          />
          <p className="text-xs text-muted-foreground">
            Still unpaid. Defaults to the full amount.
          </p>
          <FieldError messages={state.errors?.remainingAmount} />
        </div>
      </div>

      {progress > 0 && progress < 1 && (
        <p className="text-xs text-muted-foreground">
          {(progress * 100).toFixed(0)}% settled.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startedOn">Date</Label>
          <Input
            id="startedOn"
            name="startedOn"
            type="date"
            required
            defaultValue={values.startedOn ?? today}
            invalid={Boolean(state.errors?.startedOn)}
          />
          <FieldError messages={state.errors?.startedOn} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={values.dueDate}
            invalid={Boolean(state.errors?.dueDate)}
          />
          <p className="text-xs text-muted-foreground">Optional</p>
          <FieldError messages={state.errors?.dueDate} />
        </div>
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

      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
