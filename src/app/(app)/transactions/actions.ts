"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/data/transactions";
import { createClient } from "@/lib/supabase/server";
import {
  transactionFormToInput,
  transactionSchema,
} from "@/lib/validation/transactions";

export type TransactionActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  /** Echoed back so a failed submit does not wipe the form. */
  values?: Record<string, string | undefined>;
};

const FIELDS = [
  "type",
  "amount",
  "occurredOn",
  "description",
  "payee",
  "notes",
  "accountId",
  "categoryId",
  "transferAccountId",
] as const;

function rawValues(formData: FormData): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : undefined;
  }
  return values;
}

async function parse(formData: FormData) {
  return transactionSchema.safeParse(transactionFormToInput(formData));
}

export async function createTransactionAction(
  _prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await requireUser();
  const parsed = await parse(formData);

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues(formData),
    };
  }

  const supabase = await createClient();
  try {
    await createTransaction(supabase, user.id, parsed.data);
  } catch (error) {
    return {
      formError: friendlyError(error),
      values: rawValues(formData),
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  redirect("/transactions");
}

export async function updateTransactionAction(
  _prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const user = await requireUser();
  const id = formData.get("transactionId");
  if (typeof id !== "string" || id.length === 0) {
    return { formError: "Missing transaction id." };
  }

  const parsed = await parse(formData);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues(formData),
    };
  }

  const supabase = await createClient();
  try {
    await updateTransaction(supabase, user.id, id, parsed.data);
  } catch (error) {
    return {
      formError: friendlyError(error),
      values: rawValues(formData),
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  redirect("/transactions");
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = formData.get("transactionId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing transaction id.");
  }

  const supabase = await createClient();
  await deleteTransaction(supabase, user.id, id);

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

/**
 * Translate a database error into something a person can act on.
 *
 * The database constraints are the source of truth; this only improves the
 * wording. Unknown errors pass through rather than being hidden.
 */
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (/transactions_shape_check/i.test(message)) {
    return "That transaction is not valid. Transfers need a destination and no category; income and expenses need a category.";
  }
  if (/cannot use a .* category/i.test(message)) {
    return "That category doesn’t match the transaction type.";
  }
  if (/foreign key/i.test(message)) {
    return "The selected account or category no longer exists.";
  }
  return message;
}
