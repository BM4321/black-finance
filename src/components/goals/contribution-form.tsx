"use client";

import { useActionState } from "react";

import type { ContributionActionState } from "@/app/(app)/goals/actions";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

type Action = (
  state: ContributionActionState,
  formData: FormData,
) => Promise<ContributionActionState>;

/** Quick contribution entry: amount, date and an optional note. */
export function ContributionForm({
  action,
  goalId,
}: {
  action: Action;
  goalId: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      <input type="hidden" name="goalId" value={goalId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contributionAmount">Amount</Label>
          <Input
            id="contributionAmount"
            name="amount"
            inputMode="decimal"
            required
            autoFocus
            placeholder="0.00"
            invalid={Boolean(state.errors?.amount)}
          />
          <FieldError messages={state.errors?.amount} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contributedOn">Date</Label>
          <Input
            id="contributedOn"
            name="contributedOn"
            type="date"
            required
            defaultValue={today}
            invalid={Boolean(state.errors?.contributedOn)}
          />
          <FieldError messages={state.errors?.contributedOn} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contributionNote">Note</Label>
        <Input
          id="contributionNote"
          name="note"
          placeholder="Optional"
          invalid={Boolean(state.errors?.note)}
        />
        <FieldError messages={state.errors?.note} />
      </div>

      <SubmitButton pendingText="Adding…">Add contribution</SubmitButton>
    </form>
  );
}
