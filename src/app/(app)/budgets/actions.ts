"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { copyBudget, saveBudgetItems } from "@/lib/data/budgets";
import { createClient } from "@/lib/supabase/server";
import {
  budgetSchema,
  copyBudgetSchema,
  parseBudgetItems,
} from "@/lib/validation/budgets";

export type BudgetActionState = {
  formError?: string;
};

export async function saveBudgetAction(
  _prev: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const user = await requireUser();

  const categoryIds = formData.getAll("categoryId").map(String);
  const amounts = formData.getAll("amount").map(String);

  const parsed = budgetSchema.safeParse({
    periodMonth: formData.get("periodMonth"),
    categoryIds,
    amounts,
  });

  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? "Invalid budget." };
  }

  const items = parseBudgetItems(parsed.data.categoryIds, parsed.data.amounts);

  const supabase = await createClient();
  try {
    await saveBudgetItems(supabase, user.id, parsed.data.periodMonth, items);
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not save the budget.",
    };
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect(`/budgets?month=${parsed.data.periodMonth.slice(0, 7)}`);
}

export async function copyBudgetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  void user; // requireUser is the guard; the RPC uses auth.uid() internally.

  const parsed = copyBudgetSchema.safeParse({
    fromMonth: formData.get("fromMonth"),
    toMonth: formData.get("toMonth"),
  });
  if (!parsed.success) {
    throw new Error("Invalid months for copy.");
  }

  const supabase = await createClient();
  await copyBudget(supabase, parsed.data.fromMonth, parsed.data.toMonth);

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect(`/budgets?month=${parsed.data.toMonth.slice(0, 7)}`);
}
