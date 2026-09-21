import type { SupabaseClient } from "@supabase/supabase-js";

import { sumAmounts } from "@/lib/finance/money";
import type { Database } from "@/types/database";
import type { ContributionInput, GoalInput } from "@/lib/validation/goals";

type Client = SupabaseClient<Database>;

/**
 * Send a validated decimal string to a NUMERIC column without routing it
 * through a JS float. PostgREST passes a decimal string to Postgres verbatim,
 * preserving exactness; `Number(...)` would risk precision loss above 2^53.
 */
function numeric(value: string): number {
  return value as unknown as number;
}

/**
 * A goal joined with its derived progress from the `goal_progress` view.
 *
 * The generated view type marks every column nullable (Postgres cannot infer
 * NOT NULL through a view). We know from the view definition these are never
 * null, so we restate them precisely rather than leak `| null` into the UI.
 */
export type GoalWithProgress = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  notes: string | null;
  is_archived: boolean;
  current_amount: number;
  remaining: number;
  /** Already a percentage (25 means 25%). */
  percent_complete: number;
  created_at: string;
  updated_at: string;
};

export type GoalContributionRow = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  contributed_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalSummary = {
  active: GoalWithProgress[];
  archived: GoalWithProgress[];
  /** Exact sum of contributions across active goals, as a decimal string. */
  totalSaved: string;
  /** Exact sum of active targets, as a decimal string. */
  totalTarget: string;
};

/**
 * List the caller's goals with derived progress.
 *
 * Active goals first (newest deadline first, goals without a deadline last),
 * then archived. Totals are summed exactly with sumAmounts, never a float
 * reduce.
 */
export async function listGoals(supabase: Client): Promise<GoalSummary> {
  const { data, error } = await supabase
    .from("goal_progress")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load goals: ${error.message}`);

  const goals = (data ?? []) as GoalWithProgress[];
  const active = goals.filter((goal) => !goal.is_archived);
  const archived = goals.filter((goal) => goal.is_archived);

  return {
    active,
    archived,
    totalSaved: sumAmounts(active.map((goal) => goal.current_amount)),
    totalTarget: sumAmounts(active.map((goal) => goal.target_amount)),
  };
}

/** A single goal with its progress, or null if it does not exist. */
export async function getGoal(
  supabase: Client,
  goalId: string,
): Promise<GoalWithProgress | null> {
  const { data, error } = await supabase
    .from("goal_progress")
    .select("*")
    .eq("id", goalId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load goal: ${error.message}`);
  return (data as GoalWithProgress | null) ?? null;
}

/** Contributions to a goal, newest first. */
export async function listContributions(
  supabase: Client,
  goalId: string,
): Promise<GoalContributionRow[]> {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", goalId)
    .order("contributed_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load contributions: ${error.message}`);
  return (data ?? []) as GoalContributionRow[];
}

export async function createGoal(
  supabase: Client,
  userId: string,
  values: GoalInput,
): Promise<string> {
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      name: values.name.trim(),
      target_amount: numeric(values.targetAmount),
      target_date: values.targetDate ?? null,
      notes: values.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function updateGoal(
  supabase: Client,
  userId: string,
  goalId: string,
  values: GoalInput,
): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .update({
      name: values.name.trim(),
      target_amount: numeric(values.targetAmount),
      target_date: values.targetDate ?? null,
      notes: values.notes ?? null,
    })
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/**
 * Archive rather than delete a goal.
 *
 * Deleting a goal cascades to its contribution history. Archiving keeps that
 * ledger intact while hiding the goal from active views — the same reasoning
 * accounts use. A genuine delete is still available for mistakes.
 */
export async function setGoalArchived(
  supabase: Client,
  userId: string,
  goalId: string,
  archived: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .update({ is_archived: archived })
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteGoal(
  supabase: Client,
  userId: string,
  goalId: string,
): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function addContribution(
  supabase: Client,
  userId: string,
  values: ContributionInput,
): Promise<void> {
  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: values.goalId,
    user_id: userId,
    amount: numeric(values.amount),
    contributed_on: values.contributedOn,
    note: values.note ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function deleteContribution(
  supabase: Client,
  userId: string,
  contributionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", contributionId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
