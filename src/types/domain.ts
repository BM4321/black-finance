import type { Database } from "@/types/database";

/**
 * Application-facing types.
 *
 * These alias the generated database types so feature code never reaches into
 * `Database["public"]["Tables"][...]` directly. If the schema changes, only the
 * aliases here need updating, not every component.
 */

export type AccountType = Database["public"]["Enums"]["account_type"];
export type CategoryKind = Database["public"]["Enums"]["category_kind"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type BudgetItem = Database["public"]["Tables"]["budget_items"]["Row"];

export type NewAccount = Database["public"]["Tables"]["accounts"]["Insert"];
export type NewCategory = Database["public"]["Tables"]["categories"]["Insert"];
export type NewTransaction = Database["public"]["Tables"]["transactions"]["Insert"];

export type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];
export type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];
export type TransactionUpdate =
  Database["public"]["Tables"]["transactions"]["Update"];

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "cash",
  "bank",
  "savings",
  "mobile_money",
  "investment",
  "other",
] as const;

/** Human-readable labels for account types, kept next to the type union. */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank account",
  savings: "Savings account",
  mobile_money: "Mobile money",
  investment: "Investment account",
  other: "Other",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};
