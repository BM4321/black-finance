"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  createDebt,
  deleteDebt,
  setDebtWrittenOff,
  settleDebt,
  updateDebt,
} from "@/lib/data/debts";
import { createClient } from "@/lib/supabase/server";
import { debtIdSchema, debtSchema } from "@/lib/validation/debts";

export type DebtActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  values?: {
    direction?: string;
    counterparty?: string;
    principal?: string;
    remainingAmount?: string;
    startedOn?: string;
    dueDate?: string;
    notes?: string;
  };
};

function rawValues(formData: FormData): DebtActionState["values"] {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    direction: get("direction"),
    counterparty: get("counterparty"),
    principal: get("principal"),
    remainingAmount: get("remainingAmount"),
    startedOn: get("startedOn"),
    dueDate: get("dueDate"),
    notes: get("notes"),
  };
}

function parse(formData: FormData) {
  // Leaving "Outstanding" blank means nothing has been repaid yet, so it
  // defaults to the full principal. Done here (not in the schema) so the field
  // stays optional for the user while still being validated as a number.
  const principal = formData.get("principal");
  const remainingRaw = formData.get("remainingAmount");
  const remainingAmount =
    typeof remainingRaw === "string" && remainingRaw.trim() !== ""
      ? remainingRaw
      : principal;

  return debtSchema.safeParse({
    direction: formData.get("direction"),
    counterparty: formData.get("counterparty"),
    principal,
    remainingAmount,
    startedOn: formData.get("startedOn"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes"),
  });
}

export async function createDebtAction(
  _prev: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await requireUser();
  const parsed = parse(formData);

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues(formData),
    };
  }

  const supabase = await createClient();
  try {
    await createDebt(supabase, user.id, parsed.data);
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not create the debt.",
      values: rawValues(formData),
    };
  }

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  redirect("/debts");
}

export async function updateDebtAction(
  _prev: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const user = await requireUser();
  const id = formData.get("debtId");
  if (typeof id !== "string" || !debtIdSchema.safeParse(id).success) {
    return { formError: "Missing debt id." };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues(formData),
    };
  }

  const supabase = await createClient();
  try {
    await updateDebt(supabase, user.id, id, parsed.data);
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not update the debt.",
      values: rawValues(formData),
    };
  }

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  redirect("/debts");
}

function requireDebtId(formData: FormData): string {
  const id = formData.get("debtId");
  if (typeof id !== "string" || !debtIdSchema.safeParse(id).success) {
    throw new Error("Missing debt id.");
  }
  return id;
}

export async function settleDebtAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = requireDebtId(formData);

  const supabase = await createClient();
  await settleDebt(supabase, user.id, id);
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function writeOffDebtAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = requireDebtId(formData);
  const writtenOff = formData.get("writtenOff") === "true";

  const supabase = await createClient();
  await setDebtWrittenOff(supabase, user.id, id, writtenOff);
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}

export async function deleteDebtAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = requireDebtId(formData);

  const supabase = await createClient();
  await deleteDebt(supabase, user.id, id);
  revalidatePath("/debts");
  revalidatePath("/dashboard");
}
