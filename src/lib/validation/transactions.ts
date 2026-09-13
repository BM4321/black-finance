import { z } from "zod";

/**
 * Transaction form validation.
 *
 * Shape mirrors the database CHECK constraint:
 *   income/expense : account + category, no destination
 *   transfer       : account + destination (different), no category
 *
 * A discriminated union on `type` means TypeScript also knows which fields are
 * present after parsing, so the Server Action cannot accidentally read
 * `categoryId` from a transfer.
 */

const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")
  .refine(
    (value) => Number(value) <= 1_000_000_000_000,
    "Amount is too large",
  );

const occurredOn = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");

const description = z
  .string()
  .trim()
  .max(200, "Description is too long")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const payee = z
  .string()
  .trim()
  .max(120, "Payee is too long")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const notes = z
  .string()
  .trim()
  .max(1000, "Notes are too long")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const uuid = z.string().uuid("Invalid selection");

const baseFields = {
  amount,
  occurredOn,
  description,
  payee,
  notes,
};

export const incomeSchema = z.object({
  type: z.literal("income"),
  ...baseFields,
  accountId: uuid,
  categoryId: uuid,
});

export const expenseSchema = z.object({
  type: z.literal("expense"),
  ...baseFields,
  accountId: uuid,
  categoryId: uuid,
});

export const transferSchema = z.object({
  type: z.literal("transfer"),
  ...baseFields,
  accountId: uuid,
  transferAccountId: uuid,
});

export const transactionSchema = z
  .discriminatedUnion("type", [incomeSchema, expenseSchema, transferSchema])
  .refine(
    (value) =>
      value.type !== "transfer" || value.accountId !== value.transferAccountId,
    {
      message: "Source and destination accounts must be different",
      path: ["transferAccountId"],
    },
  );

export type TransactionInput = z.infer<typeof transactionSchema>;

/** Builds a zod input object from form data for the given expected type. */
export function transactionFormToInput(formData: FormData) {
  const type = formData.get("type");
  if (type === "transfer") {
    return {
      type,
      amount: formData.get("amount"),
      occurredOn: formData.get("occurredOn"),
      description: formData.get("description"),
      payee: formData.get("payee"),
      notes: formData.get("notes"),
      accountId: formData.get("accountId"),
      transferAccountId: formData.get("transferAccountId"),
    };
  }
  return {
    type,
    amount: formData.get("amount"),
    occurredOn: formData.get("occurredOn"),
    description: formData.get("description"),
    payee: formData.get("payee"),
    notes: formData.get("notes"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId"),
  };
}
