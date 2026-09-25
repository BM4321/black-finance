"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useActionState, useState } from "react";

import type { TransactionActionState } from "@/app/(app)/transactions/actions";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type { Category } from "@/types/domain";
import { TRANSACTION_TYPE_LABELS } from "@/types/domain";

type Action = (
  state: TransactionActionState,
  formData: FormData,
) => Promise<TransactionActionState>;

const TYPES = ["expense", "income", "transfer"] as const;
type FormType = (typeof TYPES)[number];

export function TransactionForm({
  action,
  accounts,
  categories,
  initial,
  transactionId,
  submitLabel,
}: {
  action: Action;
  accounts: AccountWithBalance[];
  categories: { income: Category[]; expense: Category[] };
  initial?: Record<string, string | undefined>;
  transactionId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = { ...initial, ...state.values };

  // The type selector is local state so the form can swap which fields are
  // shown instantly, without a round trip. Transfers look and behave
  // differently from a normal expense, which is the whole point.
  const [type, setType] = useState<FormType>(
    (values.type as FormType) ?? "expense",
  );

  const isTransfer = type === "transfer";
  const relevantCategories =
    type === "income" ? categories.income : categories.expense;

  const defaultDate = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      {transactionId && (
        <input type="hidden" name="transactionId" value={transactionId} />
      )}
      <input type="hidden" name="type" value={type} />

      {/* Type toggle ---------------------------------------------------- */}
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={type}
        onChange={(_, next: (typeof TYPES)[number] | null) => {
          if (next) setType(next);
        }}
        aria-label="Transaction type"
      >
        {TYPES.map((option) => (
          <ToggleButton key={option} value={option} sx={{ py: 1 }}>
            {TRANSACTION_TYPE_LABELS[option]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            autoFocus
            placeholder="0.00"
            defaultValue={values.amount}
            invalid={Boolean(state.errors?.amount)}
          />
          <FieldError messages={state.errors?.amount} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="occurredOn">Date</Label>
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            required
            defaultValue={values.occurredOn ?? defaultDate}
            invalid={Boolean(state.errors?.occurredOn)}
          />
          <FieldError messages={state.errors?.occurredOn} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="accountId">
            {isTransfer ? "From account" : "Account"}
          </Label>
          <Select
            id="accountId"
            name="accountId"
            required
            defaultValue={values.accountId ?? accounts[0]?.account_id}
            invalid={Boolean(state.errors?.accountId)}
          >
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.name}
              </option>
            ))}
          </Select>
          <FieldError messages={state.errors?.accountId} />
        </div>

        {isTransfer ? (
          <div className="space-y-1.5">
            <Label htmlFor="transferAccountId">To account</Label>
            <Select
              id="transferAccountId"
              name="transferAccountId"
              required
              defaultValue={values.transferAccountId ?? accounts[1]?.account_id}
              invalid={Boolean(state.errors?.transferAccountId)}
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <FieldError messages={state.errors?.transferAccountId} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <Select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={values.categoryId}
              invalid={Boolean(state.errors?.categoryId)}
            >
              {relevantCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <FieldError messages={state.errors?.categoryId} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            placeholder={isTransfer ? "e.g. Move to savings" : "What was it for?"}
            defaultValue={values.description}
            invalid={Boolean(state.errors?.description)}
          />
          <FieldError messages={state.errors?.description} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payee">Payee</Label>
          <Input
            id="payee"
            name="payee"
            placeholder="Optional"
            defaultValue={values.payee}
            invalid={Boolean(state.errors?.payee)}
          />
          <FieldError messages={state.errors?.payee} />
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
