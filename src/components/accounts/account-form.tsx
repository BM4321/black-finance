"use client";

import { useActionState } from "react";

import type { AccountActionState } from "@/app/(app)/accounts/actions";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/types/domain";

type Action = (
  state: AccountActionState,
  formData: FormData,
) => Promise<AccountActionState>;

export function AccountForm({
  action,
  initial,
  accountId,
  submitLabel,
}: {
  action: Action;
  initial?: {
    name?: string;
    type?: string;
    currency?: string;
    openingBalance?: string;
    notes?: string;
  };
  accountId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  // Prefer the values the action echoed back (so a failed submit does not wipe
  // the form), falling back to the initial/server-provided values.
  const values = { ...initial, ...state.values };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      {accountId && <input type="hidden" name="accountId" value={accountId} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="e.g. NMB Bank"
          defaultValue={values.name}
          invalid={Boolean(state.errors?.name)}
        />
        <FieldError messages={state.errors?.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select
            id="type"
            name="type"
            defaultValue={values.type ?? "cash"}
            invalid={Boolean(state.errors?.type)}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <FieldError messages={state.errors?.type} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            name="currency"
            required
            maxLength={3}
            placeholder="TZS"
            defaultValue={values.currency ?? "TZS"}
            invalid={Boolean(state.errors?.currency)}
            className="uppercase"
          />
          <FieldError messages={state.errors?.currency} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="openingBalance">Opening balance</Label>
        <Input
          id="openingBalance"
          name="openingBalance"
          inputMode="decimal"
          required
          defaultValue={values.openingBalance ?? "0"}
          invalid={Boolean(state.errors?.openingBalance)}
        />
        <p className="text-xs text-muted-foreground">
          The balance before any transactions you record. Negative is allowed
          (for example, a credit balance).
        </p>
        <FieldError messages={state.errors?.openingBalance} />
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
