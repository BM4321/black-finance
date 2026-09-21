import { z } from "zod";

/**
 * Goal form validation.
 *
 * Shared by the client (fast feedback) and the Server Action (trust). The
 * Server Action never trusts the client's parse.
 */

const MAX_MONEY = 1_000_000_000_000; // generous ceiling for NUMERIC(19,4)

const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")
  .refine((value) => Number(value) <= MAX_MONEY, "Amount is too large");

const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");

const notes = z
  .string()
  .trim()
  .max(500, "Notes are too long")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const goalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
  targetAmount: amount,
  // Optional: an empty deadline is allowed and stored as NULL.
  targetDate: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Choose a valid date",
    })
    .transform((value) => (value === "" ? undefined : value)),
  notes,
});

export type GoalInput = z.infer<typeof goalSchema>;

export const contributionSchema = z.object({
  goalId: z.string().uuid("Invalid goal"),
  amount,
  contributedOn: date,
  note: z
    .string()
    .trim()
    .max(500, "Note is too long")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type ContributionInput = z.infer<typeof contributionSchema>;

/** Goal id used in route params and form submissions. */
export const goalIdSchema = z.string().uuid("Invalid goal id");
