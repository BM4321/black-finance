import type { SupabaseClient } from "@supabase/supabase-js";

import { sumAmounts } from "@/lib/finance/money";
import type { InvestmentInput } from "@/lib/validation/investments";
import type { Database } from "@/types/database";
import type { AssetType } from "@/types/domain";

type Client = SupabaseClient<Database>;

/**
 * Send a validated decimal string to a NUMERIC column without routing it
 * through a JS float. PostgREST passes a decimal string to Postgres verbatim,
 * preserving exactness; `Number(...)` would risk precision loss.
 */
function numeric(value: string): number {
  return value as unknown as number;
}

/**
 * A holding joined with its derived cost basis, market value and gain from the
 * `investment_holdings` view.
 *
 * The generated view type marks every column nullable; we know from the view
 * definition these are never null, so we restate them precisely rather than
 * leak `| null` into the UI.
 */
export type Holding = {
  id: string;
  user_id: string;
  name: string;
  asset_type: AssetType;
  quantity: number;
  purchase_price: number;
  purchase_date: string | null;
  current_value: number | null;
  notes: string | null;
  is_archived: boolean;
  /** quantity * purchase_price. */
  cost_basis: number;
  /** current_value when set, else cost_basis. */
  market_value: number;
  /** market_value - cost_basis. */
  gain: number;
  created_at: string;
  updated_at: string;
};

export type Portfolio = {
  active: Holding[];
  archived: Holding[];
  /** Exact total market value of active holdings, as a decimal string. */
  totalValue: string;
  /** Exact total cost basis of active holdings. */
  totalCost: string;
  /** Exact total gain (value - cost) of active holdings. */
  totalGain: string;
};

/**
 * List the caller's holdings with derived figures and exact totals.
 *
 * Active holdings first, then archived. Totals are summed exactly with
 * sumAmounts, never a float reduce.
 */
export async function listHoldings(supabase: Client): Promise<Portfolio> {
  const { data, error } = await supabase
    .from("investment_holdings")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("market_value", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load investments: ${error.message}`);

  const holdings = (data ?? []) as Holding[];
  const active = holdings.filter((h) => !h.is_archived);
  const archived = holdings.filter((h) => h.is_archived);

  const totalValue = sumAmounts(active.map((h) => h.market_value));
  const totalCost = sumAmounts(active.map((h) => h.cost_basis));

  return {
    active,
    archived,
    totalValue,
    totalCost,
    totalGain: sumAmounts([totalValue, `-${totalCost}`]),
  };
}

/** A single holding with derived figures, or null if it does not exist. */
export async function getHolding(
  supabase: Client,
  id: string,
): Promise<Holding | null> {
  const { data, error } = await supabase
    .from("investment_holdings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load investment: ${error.message}`);
  return (data as Holding | null) ?? null;
}

/** Exact total market value of non-archived holdings. */
export async function getPortfolioValue(supabase: Client): Promise<string> {
  const { data, error } = await supabase.rpc("get_portfolio_value");
  if (error) throw new Error(`Failed to load portfolio value: ${error.message}`);
  return sumAmounts([data === null || data === undefined ? "0" : String(data)]);
}

function toRow(values: InvestmentInput) {
  return {
    name: values.name.trim(),
    asset_type: values.assetType,
    quantity: values.quantity as unknown as number,
    purchase_price: numeric(values.purchasePrice),
    purchase_date: values.purchaseDate ?? null,
    current_value:
      values.currentValue === undefined ? null : numeric(values.currentValue),
    notes: values.notes ?? null,
  };
}

export async function createHolding(
  supabase: Client,
  userId: string,
  values: InvestmentInput,
): Promise<string> {
  const { data, error } = await supabase
    .from("investments")
    .insert({ user_id: userId, ...toRow(values) })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function updateHolding(
  supabase: Client,
  userId: string,
  id: string,
  values: InvestmentInput,
): Promise<void> {
  const { error } = await supabase
    .from("investments")
    .update(toRow(values))
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/**
 * Archive rather than delete a holding.
 *
 * Archived holdings drop out of the portfolio value but keep their history, the
 * same reasoning accounts and goals use. A genuine delete is still available.
 */
export async function setHoldingArchived(
  supabase: Client,
  userId: string,
  id: string,
  archived: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("investments")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteHolding(
  supabase: Client,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
