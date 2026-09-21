"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  setGoalArchived,
  updateGoal,
} from "@/lib/data/goals";
import { createClient } from "@/lib/supabase/server";
import {
  contributionSchema,
  goalSchema,
  goalIdSchema,
} from "@/lib/validation/goals";

export type GoalActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  values?: {
    name?: string;
    targetAmount?: string;
    targetDate?: string;
    notes?: string;
  };
};

function rawValues(formData: FormData): GoalActionState["values"] {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    name: get("name"),
    targetAmount: get("targetAmount"),
    targetDate: get("targetDate"),
    notes: get("notes"),
  };
}

function parseGoal(formData: FormData) {
  return goalSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate"),
    notes: formData.get("notes"),
  });
}

/** Map a unique-violation to a friendly duplicate-name message. */
function friendlyGoalError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return /duplicate|unique/i.test(message)
    ? "You already have an active goal with that name."
    : message;
}

export async function createGoalAction(
  _prev: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await requireUser();
  const parsed = parseGoal(formData);

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues(formData),
    };
  }

  const supabase = await createClient();
  try {
    await createGoal(supabase, user.id, parsed.data);
  } catch (error) {
    return {
      formError: friendlyGoalError(error, "Could not create the goal."),
      values: rawValues(formData),
    };
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect("/goals");
}

export async function updateGoalAction(
  _prev: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const user = await requireUser();
  const goalId = formData.get("goalId");
  if (typeof goalId !== "string" || !goalIdSchema.safeParse(goalId).success) {
    return { formError: "Missing goal id." };
  }

  const parsed = parseGoal(formData);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: rawValues(formData),
    };
  }

  const supabase = await createClient();
  try {
    await updateGoal(supabase, user.id, goalId, parsed.data);
  } catch (error) {
    return {
      formError: friendlyGoalError(error, "Could not update the goal."),
      values: rawValues(formData),
    };
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/dashboard");
  redirect(`/goals/${goalId}`);
}

export async function archiveGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const goalId = formData.get("goalId");
  const archived = formData.get("archived") === "true";

  if (typeof goalId !== "string" || !goalIdSchema.safeParse(goalId).success) {
    throw new Error("Missing goal id.");
  }

  const supabase = await createClient();
  await setGoalArchived(supabase, user.id, goalId, archived);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const goalId = formData.get("goalId");

  if (typeof goalId !== "string" || !goalIdSchema.safeParse(goalId).success) {
    throw new Error("Missing goal id.");
  }

  const supabase = await createClient();
  await deleteGoal(supabase, user.id, goalId);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect("/goals");
}

export type ContributionActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
};

export async function addContributionAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const user = await requireUser();

  const parsed = contributionSchema.safeParse({
    goalId: formData.get("goalId"),
    amount: formData.get("amount"),
    contributedOn: formData.get("contributedOn"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      formError: parsed.error.issues[0]?.message,
    };
  }

  const supabase = await createClient();
  try {
    await addContribution(supabase, user.id, parsed.data);
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not add the contribution.",
    };
  }

  revalidatePath("/goals");
  revalidatePath(`/goals/${parsed.data.goalId}`);
  revalidatePath("/dashboard");
  redirect(`/goals/${parsed.data.goalId}`);
}

export async function deleteContributionAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const contributionId = formData.get("contributionId");
  const goalId = formData.get("goalId");

  if (typeof contributionId !== "string" || contributionId.length === 0) {
    throw new Error("Missing contribution id.");
  }

  const supabase = await createClient();
  await deleteContribution(supabase, user.id, contributionId);
  revalidatePath("/goals");
  if (typeof goalId === "string" && goalId.length > 0) {
    revalidatePath(`/goals/${goalId}`);
  }
  revalidatePath("/dashboard");
}
