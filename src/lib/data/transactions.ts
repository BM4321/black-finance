import type { SupabaseClient } from "@supabase/supabase-js";

import { sumAmounts } from "@/lib/finance/money";
import type { TransactionInput } from "@/lib/validation/transactions";
import type { Database } from "@/types/database";
import type {
  CategoryKind,
  TransactionType,
  TransactionUpdate,
} from "@/types/domain";

type Client = SupabaseClient<Database>;

/** Insert shape for the transactions table (aliased for readability). */
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export const PAGE_SIZE = 25;

/**
 * Filters for the transaction list.
 *
 * This is the single definition of a transaction filter. It powers the list
 * query, the count, and the SQL totals RPC, so the summary can never disagree
 * with the rows on screen.
 */
export type TransactionFilters = {
  search?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  page?: number;
};

/**
 * A transaction row enriched with account/category names from the
 * `transaction_details` view. Restated with non-null columns because the
 * generated view type marks everything nullable.
 */
export type TransactionDetail = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  description: string | null;
  payee: string | null;
  notes: string | null;
  account_id: string;
  account_name: string;
  transfer_account_id: string | null;
  transfer_account_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_kind: CategoryKind | null;
  created_at: string;
  updated_at: string;
};

export type TransactionTotals = {
  income: string;
  expense: string;
  transfer: string;
};

export type TransactionPage = {
  transactions: TransactionDetail[];
  total: number;
  page: number;
  pageCount: number;
  totals: TransactionTotals;
};

/**
 * Escape a user search string for PostgREST's `or` filter grammar.
 *
 * Commas and parentheses are structural in that grammar; a raw value containing
 * them would either break the query or inject extra filter clauses. PostgREST
 * treats a double-quoted value literally, so we strip quotes/backslashes and
 * wrap the term.
 */
function escapeSearch(term: string): string {
  const cleaned = term.replace(/["\\]/g, "").slice(0, 100);
  return `"*${cleaned}*"`;
}

/** PostgREST numeric filter values must be plain numbers; ignore garbage. */
function numericFilter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Build the filtered `transaction_details` query.
 *
 * Used only by the list. The totals RPC mirrors these predicates in SQL; the
 * two must be changed together when a filter is added. Returns the query
 * builder before ordering/ranging so the caller controls pagination.
 */
function buildFilteredQuery(supabase: Client, filters: TransactionFilters) {
  let query = supabase.from("transaction_details").select("*", {
    count: "exact",
  });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  if (filters.accountId) {
    // A transfer touches two accounts; include it on either side.
    query = query.or(
      `account_id.eq.${filters.accountId},transfer_account_id.eq.${filters.accountId}`,
    );
  }

  if (filters.dateFrom) query = query.gte("occurred_on", filters.dateFrom);
  if (filters.dateTo) query = query.lte("occurred_on", filters.dateTo);

  const min = numericFilter(filters.amountMin);
  const max = numericFilter(filters.amountMax);
  if (min !== undefined) query = query.gte("amount", min);
  if (max !== undefined) query = query.lte("amount", max);

  if (filters.search && filters.search.trim() !== "") {
    const term = escapeSearch(filters.search.trim());
    query = query.or(`description.ilike.${term},payee.ilike.${term}`);
  }

  return query;
}

/**
 * Paginated transaction list plus DB-side totals.
 *
 * `count: "exact"` returns the total matching rows without downloading them;
 * totals come from the `get_transaction_totals` RPC. Both apply the same
 * filters, so the header can never drift from the table.
 */
export async function getTransactions(
  supabase: Client,
  filters: TransactionFilters = {},
): Promise<TransactionPage> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await buildFilteredQuery(supabase, filters)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Failed to load transactions: ${error.message}`);

  const totals = await getTransactionTotals(supabase, filters);

  const total = count ?? 0;
  return {
    transactions: (data ?? []) as unknown as TransactionDetail[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totals,
  };
}

/**
 * Exact totals for the filtered set, aggregated in PostgreSQL.
 *
 * Amounts come back as NUMERIC (serialised as strings) and are re-summed with
 * sumAmounts so the displayed totals are exact.
 */
export async function getTransactionTotals(
  supabase: Client,
  filters: TransactionFilters = {},
): Promise<TransactionTotals> {
  const { data, error } = await supabase.rpc("get_transaction_totals", {
    p_search: filters.search?.trim() || undefined,
    p_type: filters.type,
    p_account_id: filters.accountId,
    p_category_id: filters.categoryId,
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_amount_min: numericFilter(filters.amountMin),
    p_amount_max: numericFilter(filters.amountMax),
  });

  if (error) throw new Error(`Failed to load totals: ${error.message}`);

  const row = data?.[0];
  const asString = (value: unknown) =>
    value === null || value === undefined ? "0" : String(value);

  return {
    income: sumAmounts([asString(row?.income_total)]),
    expense: sumAmounts([asString(row?.expense_total)]),
    transfer: sumAmounts([asString(row?.transfer_total)]),
  };
}

export async function getTransaction(
  supabase: Client,
  id: string,
): Promise<TransactionDetail | null> {
  const { data, error } = await supabase
    .from("transaction_details")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load transaction: ${error.message}`);
  return (data as unknown as TransactionDetail | null) ?? null;
}

/**
 * Map validated input to the insert shape expected by the `transactions` table.
 *
 * The discriminated union guarantees the correct field combination; the
 * explicit annotation makes that contract visible to TypeScript and keeps the
 * two branches honest. `user_id` is only included on insert: ownership never
 * changes on update.
 */
function toInsertRow(
  input: TransactionInput,
  userId: string,
): TransactionInsert {
  const common = {
    amount: input.amount as unknown as number,
    occurred_on: input.occurredOn,
    description: input.description ?? null,
    payee: input.payee ?? null,
    notes: input.notes ?? null,
  };

  if (input.type === "transfer") {
    return {
      ...common,
      user_id: userId,
      type: "transfer",
      account_id: input.accountId,
      transfer_account_id: input.transferAccountId,
      category_id: null,
    };
  }

  return {
    ...common,
    user_id: userId,
    type: input.type,
    account_id: input.accountId,
    transfer_account_id: null,
    category_id: input.categoryId,
  };
}

/** Update shape: same fields, minus ownership. */
function toUpdateRow(input: TransactionInput): TransactionUpdate {
  // Omit user_id: ownership must never change on update. Building the object
  // explicitly (rather than destructuring) keeps the intent obvious.
  const row = toInsertRow(input, "");
  return {
    amount: row.amount,
    occurred_on: row.occurred_on,
    description: row.description,
    payee: row.payee,
    notes: row.notes,
    type: row.type,
    account_id: row.account_id,
    transfer_account_id: row.transfer_account_id,
    category_id: row.category_id,
  };
}

/**
 * Insert a validated transaction.
 *
 * The database re-checks the shape constraint and category kind, so even if
 * this mapping were wrong the write would fail rather than corrupt data.
 */
export async function createTransaction(
  supabase: Client,
  userId: string,
  input: TransactionInput,
): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .insert(toInsertRow(input, userId));
  if (error) throw new Error(error.message);
}

export async function updateTransaction(
  supabase: Client,
  userId: string,
  id: string,
  input: TransactionInput,
): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .update(toUpdateRow(input))
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteTransaction(
  supabase: Client,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
