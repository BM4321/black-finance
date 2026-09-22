import { z } from "zod";

import { DEBT_DIRECTIONS } from "@/types/domain";

/**
 * Debt form validation.
 *
 * Shared by the client (fast feedback) and the Server Action (trust). The
 * Server Action never trusts the client's parse.
 */

const MAX_MONEY = 1_000_000_000_000; // generous ceiling for NUMERIC(19,4)

const positiveAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")
  .refine((value) => Number(value) <= MAX_MONEY, "Amount is too large");

const nonNegativeAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
  .refine((value) => Number(value) <= MAX_MONEY, "Amount is too large");

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Choose a valid date",
  })
  .transform((value) => (value === "" ? undefined : value));

export const debtSchema = z
  .object({
    direction: z.enum(DEBT_DIRECTIONS),
    counterparty: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(120, "Name is too long"),
    principal: positiveAmount,
    remainingAmount: nonNegativeAmount,
    startedOn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
    dueDate: optionalDate,
    notes: z
      .string()
      .trim()
      .max(500, "Notes are too long")
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  })
  // Outstanding cannot exceed the original amount; that would be nonsense and
  // signals a mistake. Paying DOWN is the normal direction.
  .refine(
    (value) => Number(value.remainingAmount) <= Number(value.principal),
    {
      message: "Outstanding cannot be more than the original amount",
      path: ["remainingAmount"],
    },
  );

export type DebtInput = z.infer<typeof debtSchema>;

/** Debt id used in route params and form submissions. */
export const debtIdSchema = z.string().uuid("Invalid debt id");
