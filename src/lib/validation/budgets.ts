import { z } from "zod";

/**
 * Budget form validation.
 *
 * The budget is submitted as parallel arrays of category ids and amounts (from
 * a form with one row per category). We zip them back together and validate
 * each entry, dropping rows that were left blank or zero.
 */

const month = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Choose a valid month");

const amountRegex = /^\d+(\.\d+)?$/;

export const budgetSchema = z.object({
  periodMonth: month,
  categoryIds: z.array(z.string().uuid("Invalid category")).max(200),
  amounts: z
    .array(
      z
        .string()
        .trim()
        .refine(
          (value) => value === "" || amountRegex.test(value),
          "Enter a valid number",
        ),
    )
    .max(200),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

/** Pair each category with its amount, dropping blanks and zeros. */
export function parseBudgetItems(
  categoryIds: string[],
  amounts: string[],
): Array<{ categoryId: string; amount: string }> {
  const items: Array<{ categoryId: string; amount: string }> = [];
  for (let i = 0; i < categoryIds.length; i += 1) {
    const amount = (amounts[i] ?? "").trim();
    if (amount === "" || Number(amount) === 0) continue;
    items.push({ categoryId: categoryIds[i], amount });
  }
  return items;
}

export const copyBudgetSchema = z.object({
  fromMonth: month,
  toMonth: month,
});
