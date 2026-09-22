import type { SupabaseClient } from "@supabase/supabase-js";

import { sumAmounts } from "@/lib/finance/money";
import type { DebtInput } from "@/lib/validation/debts";
import type { Database } from "@/types/database";
import type { DebtDirection, DebtStatus } from "@/types/domain";

type Client = SupabaseClient<Database>;

/**
 * Send a validated decimal string to a NUMERIC column without routing it
 * through a JS float. PostgREST passes a decimal string to Postgres verbatim,
 * preserving exactness.
 */
function numeric(value: string): number {
  return value as unknown as number;
}

/**
 * A debt joined with its derived status and settled amount from `debt_details`.
 *
 * The generated view type marks every column nullable; we know from the view
 * definition these are never null, so we restate them precisely rather than
 * leak `| null` into the UI.
 */
export type DebtRow = {
  id: string;
  user_id: string;
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  remaining_amount: number;
  /** principal - remaining_amount. */
  settled_amount: number;
  status: DebtStatus;
  started_on: string;
  due_date: string | null;
  is_written_off: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtSummary = {
  /** Open debts I owe. */
  owedByMe: DebtRow[];
  /** Open debts owed to me. */
  owedToMe: DebtRow[];
  /** Settled and written-off debts, newest first. */
  closed: DebtRow[];
  /** Exact total I owe (open only). */
  totalOwedByMe: string;
  /** Exact total owed to me (open only). */
  totalOwedToMe: string;
  /** Net position: owed to me minus what I owe. */
  net: string;
};

/**
 * List the caller's debts, split into open (by direction) and closed.
 *
 * Open debts are ordered by due date (soonest first, undated last); closed
 * debts newest first. Totals are summed exactly with sumAmounts.
 */
export async function listDebts(supabase: Client): Promise<DebtSummary> {
  const { data, error } = await supabase
    .from("debt_details")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("started_on", { ascending: false });

  if (error) throw new Error(`Failed to load debts: ${error.message}`);

  const debts = (data ?? []) as DebtRow[];
  const open = debts.filter((debt) => debt.status === "open");
  const owedByMe = open.filter((debt) => debt.direction === "owed_by_me");
  const owedToMe = open.filter((debt) => debt.direction === "owed_to_me");
  const closed = debts.filter((debt) => debt.status !== "open");

  const totalOwedByMe = sumAmounts(owedByMe.map((debt) => debt.remaining_amount));
  const totalOwedToMe = sumAmounts(owedToMe.map((debt) => debt.remaining_amount));

  return {
    owedByMe,
    owedToMe,
    closed,
    totalOwedByMe,
    totalOwedToMe,
    net: sumAmounts([totalOwedToMe, `-${totalOwedByMe}`]),
  };
}

/** A single debt with derived figures, or null if it does not exist. */
export async function getDebt(
  supabase: Client,
  id: string,
): Promise<DebtRow | null> {
  const { data, error } = await supabase
    .from("debt_details")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load debt: ${error.message}`);
  return (data as DebtRow | null) ?? null;
}

function toRow(values: DebtInput) {
  return {
    direction: values.direction,
    counterparty: values.counterparty.trim(),
    principal: numeric(values.principal),
    remaining_amount: numeric(values.remainingAmount),
    started_on: values.startedOn,
    due_date: values.dueDate ?? null,
    notes: values.notes ?? null,
  };
}

export async function createDebt(
  supabase: Client,
  userId: string,
  values: DebtInput,
): Promise<string> {
  const { data, error } = await supabase
    .from("debts")
    .insert({ user_id: userId, ...toRow(values) })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function updateDebt(
  supabase: Client,
  userId: string,
  id: string,
  values: DebtInput,
): Promise<void> {
  const { error } = await supabase
    .from("debts")
    .update(toRow(values))
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/** Mark a debt as fully settled (remaining = 0) in one action. */
export async function settleDebt(
  supabase: Client,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("debts")
    .update({ remaining_amount: 0 })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/** Write a debt off (or un-write-off) without deleting it. */
export async function setDebtWrittenOff(
  supabase: Client,
  userId: string,
  id: string,
  writtenOff: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("debts")
    .update({ is_written_off: writtenOff })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteDebt(
  supabase: Client,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
