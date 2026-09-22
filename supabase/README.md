# Database

PostgreSQL schema, migrations, and the Row Level Security (RLS) test suite.

## Migrations

Ordered SQL files in `migrations/`. They are additive and **idempotent**: every
statement is guarded (`create ... if not exists`, `create or replace`,
`drop ... if exists` before `create policy`/`create trigger`, and enums created
inside `do $$ ... exception when duplicate_object`). Re-running the whole set is
therefore safe. Apply them in filename order.

`apply_all.sql` is the concatenation of every migration, kept in sync for
pasting into the Supabase SQL Editor in one go.

## Applying migrations

### Option A — Supabase SQL Editor

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `apply_all.sql`.
3. Run it.

### Option B — connection string (fastest)

```bash
DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
  ./apply.sh
```

Get the connection string from **Project Settings → Database → Connection
string → URI**.

## Testing RLS locally

Requires a local PostgreSQL and the `psql`/`createdb`/`dropdb` tools.

```bash
./tests/run.sh
```

This creates a throwaway database, applies the Supabase stub and every
migration, runs the integrity suite, and drops the database. It never touches
your Supabase project.

The suite covers ownership isolation, cross-user reference prevention, the
transfer-vs-expense distinction, derived balances, budget math, and the
`security_invoker` views.

## Regenerating types

`src/types/database.ts` is generated. After any migration, regenerate it:

```bash
./typegen.sh
```

Requires Docker running. It spins up a disposable Postgres plus Supabase's
`postgres-meta` image, applies all migrations, and rewrites the types file.
If the schema drifts from the types, `npm run typecheck` will fail — treat that
as the prompt to re-run this.

## Schema overview

| Object | Purpose |
| --- | --- |
| `profiles` | Per-user preferences, created by trigger on signup |
| `accounts` | Cash/bank/savings/etc. Holds `opening_balance` only |
| `categories` | Seeded per user on signup; income or expense |
| `transactions` | income / expense / transfer, amount always positive |
| `budgets`, `budget_items` | Monthly allowance per expense category |
| `goals`, `goal_contributions` | Savings goals and the ledger of money put toward them |
| `investments` | Simple investment holdings (quantity, cost, manual current value) |
| `debts` | Money owed by me and owed to me, with derived status |
| `account_balances` (view) | Derived balance; `security_invoker = true` |
| `goal_progress` (view) | Derived goal progress; `security_invoker = true` |
| `investment_holdings` (view) | Derived cost basis, market value and gain; `security_invoker = true` |
| `debt_details` (view) | Debts with derived status and settled amount; `security_invoker = true` |
| `transaction_details` (view) | Transactions joined to account/category names |
| `get_transaction_totals`, `get_monthly_summary`, `get_spending_by_category`, `get_net_worth`, `get_budget_status`, `copy_budget` | Aggregate RPCs |
| `get_balance_breakdown` | Non-archived balances split into spendable, savings, investments and open debts, plus net worth |
| `get_net_worth_history` | Reconstructed month-end **account-only** net worth (investments/debts have no history) |
| `get_portfolio_value` | Total market value of non-archived investment holdings |
| `normalize_search_term` | Shared search-term normaliser so the list and its totals agree |

### Key invariants

- **Money is `numeric`, never a float**, and amounts are always `> 0`. Direction
  comes from `type`.
- **Transfers are not expenses.** Every aggregate filters on `type`; transfers
  are reported separately and never counted as spending.
- **Balances are derived**, never stored, so there is no second source of truth.
- **Savings accounts are a type, not a separate ledger.** `savings` balances are
  split out from spendable cash in `get_balance_breakdown` for presentation;
  net worth is their exact sum, so the split cannot drift.
- **Investments are not spending.** A holding lives in its own table and is
  never counted as an expense. Its value contributes to net worth via
  `market_value` (the manual current value, falling back to cost).
- **Debts are not transactions.** Lending or borrowing is not consumption, so
  debts never touch expense totals. Only *open* debts affect net worth: money
  owed to me is an asset, money I owe is a liability. Status is derived, never
  stored, so it cannot contradict the outstanding amount.
- **Goal progress is derived** from `goal_contributions`, for the same reason:
  a goal has no stored `current_amount` to drift.
- **A goal contribution is not a transaction.** Putting money toward a goal is
  neither spending nor a transfer between accounts, so it lives in its own
  table and never inflates expenses.
- **Ownership uses composite foreign keys** (`(id, user_id)` targets), so a row
  physically cannot reference another user's account, category or budget.
- **RLS is enabled on every table.** A new table without policies returns zero
  rows by design.
- **Views use `security_invoker = true`.** Without it a view would run as its
  owner and bypass RLS, leaking other users' data.
