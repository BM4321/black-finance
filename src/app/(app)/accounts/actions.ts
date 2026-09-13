"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  createAccount,
  setAccountArchived,
  updateAccount,
} from "@/lib/data/accounts";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "@/lib/validation/accounts";

export type AccountActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  values?: {
    name?: string;
    type?: string;
    currency?: string;
    openingBalance?: string;
    notes?: string;
  };
};

function rawValues(formData: FormData): AccountActionState["values"] {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    name: get("name"),
    type: get("type"),
    currency: get("currency"),
    openingBalance: get("openingBalance"),
    notes: get("notes"),
  };
}

async function parse(formData: FormData) {
  return accountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    openingBalance: formData.get("openingBalance"),
    notes: formData.get("notes"),
  });
}

export async function createAccountAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
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
    await createAccount(supabase, user.id, parsed.data);
  } catch (error) {
    // A unique-violation means a duplicate active account name.
    const message =
      error instanceof Error ? error.message : "Could not create account.";
    return {
      formError: /duplicate|unique/i.test(message)
        ? "You already have an active account with that name."
        : message,
      values: rawValues(formData),
    };
  }

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function updateAccountAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireUser();
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || accountId.length === 0) {
    return { formError: "Missing account id." };
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
    await updateAccount(supabase, user.id, accountId, parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update account.";
    return {
      formError: /duplicate|unique/i.test(message)
        ? "You already have an active account with that name."
        : message,
      values: rawValues(formData),
    };
  }

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function archiveAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const accountId = formData.get("accountId");
  const archived = formData.get("archived") === "true";

  if (typeof accountId !== "string" || accountId.length === 0) {
    throw new Error("Missing account id.");
  }

  const supabase = await createClient();
  await setAccountArchived(supabase, user.id, accountId, archived);
  revalidatePath("/accounts");
}
