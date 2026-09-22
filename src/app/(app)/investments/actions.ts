"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  createHolding,
  deleteHolding,
  setHoldingArchived,
  updateHolding,
} from "@/lib/data/investments";
import { createClient } from "@/lib/supabase/server";
import {
  investmentIdSchema,
  investmentSchema,
} from "@/lib/validation/investments";

export type InvestmentActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  values?: {
    name?: string;
    assetType?: string;
    quantity?: string;
    purchasePrice?: string;
    purchaseDate?: string;
    currentValue?: string;
    notes?: string;
  };
};

function rawValues(formData: FormData): InvestmentActionState["values"] {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    name: get("name"),
    assetType: get("assetType"),
    quantity: get("quantity"),
    purchasePrice: get("purchasePrice"),
    purchaseDate: get("purchaseDate"),
    currentValue: get("currentValue"),
    notes: get("notes"),
  };
}

function parse(formData: FormData) {
  return investmentSchema.safeParse({
    name: formData.get("name"),
    assetType: formData.get("assetType"),
    quantity: formData.get("quantity"),
    purchasePrice: formData.get("purchasePrice"),
    purchaseDate: formData.get("purchaseDate"),
    currentValue: formData.get("currentValue"),
    notes: formData.get("notes"),
  });
}

/** Map a unique-violation to a friendly duplicate-name message. */
function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return /duplicate|unique/i.test(message)
    ? "You already have an active investment with that name."
    : message;
}

export async function createHoldingAction(
  _prev: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
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
    await createHolding(supabase, user.id, parsed.data);
  } catch (error) {
    return {
      formError: friendlyError(error, "Could not create the investment."),
      values: rawValues(formData),
    };
  }

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  redirect("/investments");
}

export async function updateHoldingAction(
  _prev: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await requireUser();
  const id = formData.get("investmentId");
  if (typeof id !== "string" || !investmentIdSchema.safeParse(id).success) {
    return { formError: "Missing investment id." };
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
    await updateHolding(supabase, user.id, id, parsed.data);
  } catch (error) {
    return {
      formError: friendlyError(error, "Could not update the investment."),
      values: rawValues(formData),
    };
  }

  revalidatePath("/investments");
  revalidatePath("/dashboard");
  redirect("/investments");
}

export async function archiveHoldingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = formData.get("investmentId");
  const archived = formData.get("archived") === "true";

  if (typeof id !== "string" || !investmentIdSchema.safeParse(id).success) {
    throw new Error("Missing investment id.");
  }

  const supabase = await createClient();
  await setHoldingArchived(supabase, user.id, id, archived);
  revalidatePath("/investments");
  revalidatePath("/dashboard");
}

export async function deleteHoldingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = formData.get("investmentId");

  if (typeof id !== "string" || !investmentIdSchema.safeParse(id).success) {
    throw new Error("Missing investment id.");
  }

  const supabase = await createClient();
  await deleteHolding(supabase, user.id, id);
  revalidatePath("/investments");
  revalidatePath("/dashboard");
}
