import { z } from "zod";

import { ASSET_TYPES } from "@/types/domain";

/**
 * Investment form validation.
 *
 * Shared by the client (fast feedback) and the Server Action (trust). The
 * Server Action never trusts the client's parse.
 */

const MAX_MONEY = 1_000_000_000_000; // generous ceiling for NUMERIC(19,4)

const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
  .refine((value) => Number(value) <= MAX_MONEY, "Amount is too large");

const optionalMoney = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+(\.\d+)?$/.test(value), {
    message: "Enter a valid amount",
  })
  .refine(
    (value) => value === "" || Number(value) <= MAX_MONEY,
    "Amount is too large",
  )
  .transform((value) => (value === "" ? undefined : value));

export const investmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  assetType: z.enum(ASSET_TYPES),
  // Quantity is a decimal to allow fractional units (funds, crypto).
  quantity: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a valid quantity")
    .refine((value) => Number(value) >= 0, "Quantity cannot be negative"),
  purchasePrice: money,
  // Optional purchase date; blank is stored as NULL.
  purchaseDate: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Choose a valid date",
    })
    .transform((value) => (value === "" ? undefined : value)),
  // Optional: omitted means "fall back to cost basis" in the derived view.
  currentValue: optionalMoney,
  notes: z
    .string()
    .trim()
    .max(500, "Notes are too long")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type InvestmentInput = z.infer<typeof investmentSchema>;

/** Investment id used in route params and form submissions. */
export const investmentIdSchema = z.string().uuid("Invalid investment id");
