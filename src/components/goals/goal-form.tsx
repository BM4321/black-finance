"use client";

import { useActionState } from "react";

import type { GoalActionState } from "@/app/(app)/goals/actions";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";

type Action = (
  state: GoalActionState,
  formData: FormData,
) => Promise<GoalActionState>;

export function GoalForm({
  action,
  initial,
  goalId,
  submitLabel,
}: {
  action: Action;
  initial?: {
    name?: string;
    targetAmount?: string;
    targetDate?: string;
    notes?: string;
  };
  goalId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  // Prefer the values the action echoed back so a failed submit does not wipe
  // the form, falling back to the initial/server-provided values.
  const values = { ...initial, ...state.values };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      {goalId && <input type="hidden" name="goalId" value={goalId} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="e.g. Driving lessons"
          defaultValue={values.name}
          invalid={Boolean(state.errors?.name)}
        />
        <FieldError messages={state.errors?.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="targetAmount">Target amount</Label>
          <Input
            id="targetAmount"
            name="targetAmount"
            inputMode="decimal"
            required
            placeholder="0.00"
            defaultValue={values.targetAmount}
            invalid={Boolean(state.errors?.targetAmount)}
          />
          <FieldError messages={state.errors?.targetAmount} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetDate">Target date</Label>
          <Input
            id="targetDate"
            name="targetDate"
            type="date"
            defaultValue={values.targetDate}
            invalid={Boolean(state.errors?.targetDate)}
          />
          <p className="text-xs text-muted-foreground">Optional</p>
          <FieldError messages={state.errors?.targetDate} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
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
