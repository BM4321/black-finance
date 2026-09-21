import type { SupabaseClient } from "@supabase/supabase-js";

import { sumAmounts } from "@/lib/finance/money";
import type { Database } from "@/types/database";
import type { Account, AccountType } from "@/types/domain";

type Client = SupabaseClient<Database>;

/**
 * Send a validated decimal string to a NUMERIC column without going through a
 * JS float.
 *
 * PostgREST serialises a decimal string exactly (Postgres parses it directly),
 * whereas `Number(...)` would silently lose precision above 2^53. The generated
 * types advertise NUMERIC as `number`, so we narrow-cast at this single
 * boundary rather than letting `number` leak into our money handling.
 */
function numeric(value: string): number {
  return value as unknown as number;
}

/**
 * Account row joined with its derived balance from the `account_balances` view.
 *
 * The generated view type marks every column nullable (Postgres cannot infer
 * NOT NULL through a view), which would force null checks everywhere. We know
 * from the view definition that these columns are never null, so we restate
 * them precisely here instead of leaking `| null` into the UI.
 */
export type AccountWithBalance = {
  account_id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  is_archived: boolean;
  notes: string | null;
  opening_balance: number;
  /** Exact balance as returned by Postgres NUMERIC (serialised as a number). */
  current_balance: number;
  created_at: string;
  updated_at: string;
};

export type AccountSummary = {
  accounts: AccountWithBalance[];
  /** Exact total of every active account (spendable + savings). */
  totalBalance: string;
  /** Exact total of active non-savings accounts. */
  spendableBalance: string;
  /** Exact total of active savings accounts. */
  savingsBalance: string;
};

/**
 * List the caller's accounts with derived balances.
 *
 * Archived accounts are excluded by default: they should not appear in the
 * normal working view, but remain queryable for history.
 */
export async function listAccounts(
  supabase: Client,
  options: { includeArchived?: boolean } = {},
): Promise<AccountWithBalance[]> {
  let query = supabase
    .from("account_balances")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("name", { ascending: true });

  if (!options.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load accounts: ${error.message}`);

  return (data ?? []) as AccountWithBalance[];
}

/**
 * List accounts plus their exact totals.
 *
 * Totals are computed with sumAmounts (integer minor units) rather than a JS
 * float reduce, so a long account list cannot accumulate rounding drift. The
 * spendable/savings split mirrors `get_balance_breakdown` on the dashboard.
 */
export async function getAccountSummary(
  supabase: Client,
): Promise<AccountSummary> {
  const accounts = await listAccounts(supabase);
  const savingsAccounts = accounts.filter(
    (account) => account.type === "savings",
  );
  const spendableAccounts = accounts.filter(
    (account) => account.type !== "savings",
  );

  const spendableBalance = sumAmounts(
    spendableAccounts.map((account) => account.current_balance),
  );
  const savingsBalance = sumAmounts(
    savingsAccounts.map((account) => account.current_balance),
  );

  return {
    accounts,
    spendableBalance,
    savingsBalance,
    totalBalance: sumAmounts([spendableBalance, savingsBalance]),
  };
}

export async function getAccount(
  supabase: Client,
  accountId: string,
): Promise<AccountWithBalance | null> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load account: ${error.message}`);
  return (data as AccountWithBalance | null) ?? null;
}

export type CreateAccountValues = {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: string;
  notes?: string;
};

export async function createAccount(
  supabase: Client,
  userId: string,
  values: CreateAccountValues,
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: values.name,
      type: values.type,
      currency: values.currency,
      opening_balance: numeric(values.openingBalance),
      notes: values.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateAccount(
  supabase: Client,
  userId: string,
  accountId: string,
  values: CreateAccountValues,
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .update({
      name: values.name,
      type: values.type,
      currency: values.currency,
      opening_balance: numeric(values.openingBalance),
      notes: values.notes ?? null,
    })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Archive rather than delete.
 *
 * Deleting an account with transactions is blocked by the database (RESTRICT),
 * and should stay blocked: history must not silently vanish. Archiving hides
 * the account from active views while preserving every past transaction.
 */
export async function setAccountArchived(
  supabase: Client,
  userId: string,
  accountId: string,
  archived: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
