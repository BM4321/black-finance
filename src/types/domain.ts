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
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalProgress =
  Database["public"]["Views"]["goal_progress"]["Row"];
export type GoalContribution =
  Database["public"]["Tables"]["goal_contributions"]["Row"];
export type Investment = Database["public"]["Tables"]["investments"]["Row"];
export type InvestmentHolding =
  Database["public"]["Views"]["investment_holdings"]["Row"];
export type Debt = Database["public"]["Tables"]["debts"]["Row"];
export type DebtDetail = Database["public"]["Views"]["debt_details"]["Row"];

export type NewAccount = Database["public"]["Tables"]["accounts"]["Insert"];
export type NewCategory = Database["public"]["Tables"]["categories"]["Insert"];
export type NewTransaction = Database["public"]["Tables"]["transactions"]["Insert"];
export type NewGoal = Database["public"]["Tables"]["goals"]["Insert"];
export type NewGoalContribution =
  Database["public"]["Tables"]["goal_contributions"]["Insert"];

export type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];
export type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];
export type TransactionUpdate =
  Database["public"]["Tables"]["transactions"]["Update"];
export type GoalUpdate = Database["public"]["Tables"]["goals"]["Update"];

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

/**
 * Investment asset types.
 *
 * Stored as free text with a CHECK constraint (not a Postgres enum) so adding a
 * new type later is a data change, not a migration that rewrites the type. The
 * union below keeps TypeScript in sync at the application edge.
 */
export const ASSET_TYPES = [
  "stock",
  "bond",
  "fund",
  "real_estate",
  "crypto",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: "Stocks",
  bond: "Bonds",
  fund: "Funds",
  real_estate: "Real estate",
  crypto: "Crypto",
  other: "Other",
};

/**
 * Debt direction and status.
 *
 * `status` is derived in the database (see `debt_details`); only `direction` is
 * stored. Keeping these unions here keeps the application in sync with the
 * CHECK constraint and the view's CASE expression.
 */
export const DEBT_DIRECTIONS = ["owed_by_me", "owed_to_me"] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  owed_by_me: "I owe",
  owed_to_me: "Owed to me",
};

export type DebtStatus = "open" | "settled" | "written_off";

export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  open: "Open",
  settled: "Settled",
  written_off: "Written off",
};
