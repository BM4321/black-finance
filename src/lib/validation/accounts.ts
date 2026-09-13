import { z } from "zod";

import { ACCOUNT_TYPES } from "@/types/domain";

/**
 * Account form validation.
 *
 * Shared by the client (fast feedback) and the Server Action (trust). The
 * Server Action never trusts the client's parse.
 */

const MAX_MONEY = 1_000_000_000_000; // generous ceiling for NUMERIC(19,4)

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
  type: z.enum(ACCOUNT_TYPES),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code (e.g. TZS)"),
  openingBalance: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/, "Enter a valid number")
    .refine((value) => Math.abs(Number(value)) <= MAX_MONEY, "Amount is too large")
    .transform((value) => value),
  notes: z
    .string()
    .trim()
    .max(500, "Notes are too long")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type AccountInput = z.infer<typeof accountSchema>;

/** Account id used in route params and form submissions. */
export const accountIdSchema = z.string().uuid("Invalid account id");
