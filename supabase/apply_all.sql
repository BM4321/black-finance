-- ============================================================================
-- Combined migration. Paste this whole file into the Supabase SQL Editor and
-- run it once. It is the concatenation of supabase/migrations/*.sql in order.
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>> 0001_init_core.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0001_init_core.sql
--
-- Core financial schema: profiles, accounts, categories, transactions.
--
-- Design principles (see project README for the full rationale):
--   1. Money is NUMERIC, never float.
--   2. Amounts are always positive; direction comes from `type`.
--   3. Every row is owned by a user. Ownership is enforced with composite
--      foreign keys so a row can never reference another user's account, even
--      if a query forgets to filter by user_id.
--   4. Account balances are derived, never stored.
--   5. Transfers are a single row; they are not expenses.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
--
-- Postgres enums give us a constrained, self-documenting value set and prevent
-- typos at the database level (not just in TypeScript).
-- ---------------------------------------------------------------------------
create type public.account_type as enum (
  'cash',
  'bank',
  'savings',
  'mobile_money',
  'investment',
  'other'
);

create type public.category_kind as enum ('income', 'expense');

create type public.transaction_type as enum ('income', 'expense', 'transfer');

-- ---------------------------------------------------------------------------
-- profiles
--
-- One row per auth.users row, created automatically by a trigger. We do not
-- duplicate the email here (it lives in auth.users); this holds app-specific
-- preferences.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency     char(3) not null default 'TZS',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts
--
-- `opening_balance` is the only balance input we store. Current balance is
-- derived: opening_balance + signed(transactions). No balance column exists,
-- so there is no second source of truth to drift.
--
-- UNIQUE(id, user_id) is not redundant: it is the target of the composite
-- foreign keys below that guarantee cross-user references are impossible.
-- ---------------------------------------------------------------------------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 80),
  type            public.account_type not null default 'cash',
  currency        char(3) not null default 'TZS',
  opening_balance numeric(19, 4) not null default 0,
  is_archived     boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (id, user_id)
);

create index accounts_user_id_idx on public.accounts (user_id);

-- A user cannot have two *active* accounts with the same name. Archived
-- accounts are exempt, so a name can be reused after archiving.
create unique index accounts_user_name_active_idx
  on public.accounts (user_id, name)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- categories
--
-- Default categories are copied into each new user's account on signup, so
-- every category has a real owner. This keeps RLS and the composite-FK
-- ownership model uniform (no special-cased NULL user_id rows).
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  kind       public.category_kind not null,
  icon       text,
  color      text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id)
);

create index categories_user_id_idx on public.categories (user_id);
create index categories_user_kind_idx on public.categories (user_id, kind);

-- Names are unique per kind among active categories; archived ones are exempt.
create unique index categories_user_name_kind_active_idx
  on public.categories (user_id, name, kind)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- transactions
--
-- Exactly one shape is valid, enforced by `transactions_shape_check`:
--
--   income   : amount > 0, account_id set, category_id required,
--              transfer_account_id NULL
--   expense  : amount > 0, account_id set, category_id required,
--              transfer_account_id NULL
--   transfer : amount > 0, account_id (source) set, transfer_account_id
--              (destination) set, category_id NULL, source <> destination
--
-- The composite foreign keys (account_id, user_id) and
-- (transfer_account_id, user_id) reference accounts(id, user_id), so it is
-- impossible to reference an account owned by someone else.
--
-- `occurred_on` is a DATE, not a timestamp: a transaction happens on a
-- calendar day, and storing an instant invites timezone drift.
-- ---------------------------------------------------------------------------
create table public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  type                public.transaction_type not null,
  amount              numeric(19, 4) not null check (amount > 0),
  account_id          uuid not null,
  transfer_account_id uuid,
  category_id         uuid,
  occurred_on         date not null default current_date,
  description         text,
  payee               text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint transactions_account_fk
    foreign key (account_id, user_id)
    references public.accounts (id, user_id)
    on delete restrict,
  constraint transactions_transfer_account_fk
    foreign key (transfer_account_id, user_id)
    references public.accounts (id, user_id)
    on delete restrict,
  constraint transactions_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete restrict,

  constraint transactions_shape_check check (
    case type
      when 'income' then
        category_id is not null and transfer_account_id is null
      when 'expense' then
        category_id is not null and transfer_account_id is null
      when 'transfer' then
        category_id is null
        and transfer_account_id is not null
        and transfer_account_id <> account_id
    end
  )
);

create index transactions_user_occurred_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_user_account_idx
  on public.transactions (user_id, account_id);
create index transactions_transfer_account_idx
  on public.transactions (transfer_account_id)
  where transfer_account_id is not null;
create index transactions_user_category_idx
  on public.transactions (user_id, category_id)
  where category_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Category kind must match transaction type.
--
-- A composite foreign key cannot express "an expense transaction may only use
-- an expense category", so this is enforced with a trigger. This closes the
-- gap where an income could be categorised as "Food".
-- ---------------------------------------------------------------------------
create or replace function public.enforce_transaction_category_kind()
returns trigger
language plpgsql
as $$
declare
  category_kind public.category_kind;
begin
  if new.category_id is null then
    return new;
  end if;

  select kind into category_kind
  from public.categories
  where id = new.category_id and user_id = new.user_id;

  if category_kind is null then
    raise exception 'Category % does not exist for this user', new.category_id
      using errcode = 'foreign_key_violation';
  end if;

  if (new.type = 'income' and category_kind <> 'income')
     or (new.type = 'expense' and category_kind <> 'expense') then
    raise exception 'Transaction type % cannot use a % category',
      new.type, category_kind
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger transactions_enforce_category_kind
  before insert or update on public.transactions
  for each row execute function public.enforce_transaction_category_kind();

-- >>>>>>>>>>>>>>>>>>>> 0002_rls_policies.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0002_rls_policies.sql
--
-- Row Level Security for every table. This is the real authorization boundary:
-- the frontend, proxy and even a compromised anon key can only ever touch rows
-- owned by the authenticated user.
--
-- The composite foreign keys in 0001 already make *cross-user references*
-- impossible. RLS makes *cross-user reads/writes* impossible. Together they
-- cover both directions.
--
-- Note: enabling RLS with no policy denies everything by default. Every table
-- therefore gets explicit policies below.
-- ============================================================================

alter table public.profiles     enable row level security;
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   Users may read/update their own profile. Inserts happen via trigger, and
--   deletes cascade from auth.users, so no insert/delete policy is needed.
-- ---------------------------------------------------------------------------
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create policy "accounts_select_own"
  on public.accounts for select
  using (user_id = auth.uid());

create policy "accounts_insert_own"
  on public.accounts for insert
  with check (user_id = auth.uid());

create policy "accounts_update_own"
  on public.accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "accounts_delete_own"
  on public.accounts for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create policy "categories_select_own"
  on public.categories for select
  using (user_id = auth.uid());

create policy "categories_insert_own"
  on public.categories for insert
  with check (user_id = auth.uid());

create policy "categories_update_own"
  on public.categories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "categories_delete_own"
  on public.categories for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create policy "transactions_select_own"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (user_id = auth.uid());

create policy "transactions_update_own"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transactions_delete_own"
  on public.transactions for delete
  using (user_id = auth.uid());

-- >>>>>>>>>>>>>>>>>>>> 0003_new_user_bootstrap.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0003_new_user_bootstrap.sql
--
-- When a user signs up we must create their profile and seed their default
-- categories. Doing this in the database (rather than in the signup Server
-- Action) guarantees it happens for *every* signup path -- email/password,
-- OAuth, invite, admin-created -- not just the one flow we wrote today.
--
-- The function is SECURITY DEFINER because the trigger runs as the
-- auth-admin, and needs to insert into public tables as that owner.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, kind, icon)
  select
    new.id,
    defaults.name,
    defaults.kind::public.category_kind,
    defaults.icon
  from (values
    -- Expense categories
    ('Food',          'expense', 'utensils'),
    ('Transport',     'expense', 'bus'),
    ('Education',     'expense', 'book'),
    ('Housing',       'expense', 'home'),
    ('Utilities',     'expense', 'bolt'),
    ('Communication', 'expense', 'phone'),
    ('Health',        'expense', 'heart'),
    ('Personal',      'expense', 'user'),
    ('Entertainment', 'expense', 'film'),
    ('Shopping',      'expense', 'bag'),
    ('Giving',        'expense', 'gift'),
    ('Debt',          'expense', 'receipt'),
    ('Other',         'expense', 'ellipsis'),
    -- Income categories
    ('Salary',        'income',  'briefcase'),
    ('Freelance',     'income',  'laptop'),
    ('Business',      'income',  'store'),
    ('Gift',          'income',  'gift'),
    ('Investment',    'income',  'trending-up'),
    ('Other',         'income',  'ellipsis')
  ) as defaults (name, kind, icon)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- >>>>>>>>>>>>>>>>>>>> 0004_account_balances.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0004_account_balances.sql
--
-- A single, authoritative definition of "current account balance".
--
-- Balance = opening_balance
--         + income into the account
--         - expenses out of the account
--         - transfers out of the account
--         + transfers into the account
--
-- Balances are DERIVED, never stored, so there is no second source of truth
-- that can drift. Every feature (accounts list, dashboard, net worth) reads
-- this view instead of re-implementing the arithmetic.
--
-- SECURITY: `security_invoker = true` is essential. Without it the view would
-- execute with the privileges of its owner and BYPASS the Row Level Security
-- on accounts/transactions, exposing every user's balances. With it, the
-- caller's RLS policies apply to the underlying tables.
-- ============================================================================

create view public.account_balances
with (security_invoker = true)
as
select
  a.id           as account_id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.is_archived,
  a.notes,
  a.created_at,
  a.updated_at,
  a.opening_balance,
  a.opening_balance + coalesce(
    sum(
      case
        when t.type = 'income'   and t.account_id = a.id          then  t.amount
        when t.type = 'expense'  and t.account_id = a.id          then -t.amount
        when t.type = 'transfer' and t.account_id = a.id          then -t.amount
        when t.type = 'transfer' and t.transfer_account_id = a.id then  t.amount
        else 0
      end
    ),
    0
  ) as current_balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id or t.transfer_account_id = a.id
group by a.id;

comment on view public.account_balances is
  'Derived per-account balance. security_invoker=true so RLS applies.';

-- >>>>>>>>>>>>>>>>>>>> 0005_backfill_existing_users.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0005_backfill_existing_users.sql
--
-- The `on_auth_user_created` trigger from 0003 only runs for *new* signups.
-- Users who registered before the schema existed (or before the trigger was
-- applied) have no profile and no categories. This backfills them.
--
-- Idempotent: safe to run multiple times. `on conflict do nothing` means users
-- who already have a profile or categories are left untouched.
-- ============================================================================

-- Profiles for any auth user missing one.
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Default categories for any user missing them entirely.
-- Users who already have some categories are skipped so we never seed a
-- partial set on top of their custom ones.
insert into public.categories (user_id, name, kind, icon)
select
  u.id,
  defaults.name,
  defaults.kind::public.category_kind,
  defaults.icon
from auth.users u
cross join (values
  ('Food',          'expense', 'utensils'),
  ('Transport',     'expense', 'bus'),
  ('Education',     'expense', 'book'),
  ('Housing',       'expense', 'home'),
  ('Utilities',     'expense', 'bolt'),
  ('Communication', 'expense', 'phone'),
  ('Health',        'expense', 'heart'),
  ('Personal',      'expense', 'user'),
  ('Entertainment', 'expense', 'film'),
  ('Shopping',      'expense', 'bag'),
  ('Giving',        'expense', 'gift'),
  ('Debt',          'expense', 'receipt'),
  ('Other',         'expense', 'ellipsis'),
  ('Salary',        'income',  'briefcase'),
  ('Freelance',     'income',  'laptop'),
  ('Business',      'income',  'store'),
  ('Gift',          'income',  'gift'),
  ('Investment',    'income',  'trending-up'),
  ('Other',         'income',  'ellipsis')
) as defaults (name, kind, icon)
where not exists (
  select 1 from public.categories c where c.user_id = u.id
);

-- >>>>>>>>>>>>>>>>>>>> 0006_transaction_details.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0006_transaction_details.sql
--
-- Adds a read model and an aggregate function for the transactions feature.
--
-- 1. `transaction_details` joins each transaction to its account, category and
--    transfer destination so the UI can render a row from a single query
--    instead of N+1 lookups.
-- 2. `get_transaction_totals` aggregates income/expense/transfer totals in
--    PostgreSQL so the client never downloads rows just to sum them.
--
-- Both use the caller's identity (security_invoker view, SECURITY INVOKER
-- function), so Row Level Security on `transactions` still applies. Transfers
-- are reported separately and are NEVER counted as expenses.
-- ============================================================================

create view public.transaction_details
with (security_invoker = true)
as
select
  t.id,
  t.user_id,
  t.type,
  t.amount,
  t.occurred_on,
  t.description,
  t.payee,
  t.notes,
  t.account_id,
  acc.name  as account_name,
  t.transfer_account_id,
  tacc.name as transfer_account_name,
  t.category_id,
  cat.name  as category_name,
  cat.kind  as category_kind,
  t.created_at,
  t.updated_at
from public.transactions t
join public.accounts acc        on acc.id  = t.account_id
left join public.accounts tacc  on tacc.id = t.transfer_account_id
left join public.categories cat on cat.id  = t.category_id;

comment on view public.transaction_details is
  'Transaction read model with account/category names. security_invoker=true.';

-- Supports filtering the list and totals by type over a date range.
create index transactions_user_type_occurred_idx
  on public.transactions (user_id, type, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Aggregate totals for the currently filtered transaction set.
--
-- Every filter parameter is optional; NULL means "do not constrain on this".
-- The predicate list MUST stay in sync with the client-side list filter in
-- src/lib/data/transactions.ts. Keeping the aggregation here avoids loading
-- rows into the app just to add them up.
-- ---------------------------------------------------------------------------
create or replace function public.get_transaction_totals(
  p_search      text  default null,
  p_type        public.transaction_type default null,
  p_account_id  uuid  default null,
  p_category_id uuid  default null,
  p_date_from   date  default null,
  p_date_to     date  default null,
  p_amount_min  numeric default null,
  p_amount_max  numeric default null
)
returns table (
  income_total   numeric,
  expense_total  numeric,
  transfer_total numeric
)
language sql
stable
as $$
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)   as income_total,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)  as expense_total,
    coalesce(sum(t.amount) filter (where t.type = 'transfer'), 0) as transfer_total
  from public.transactions t
  where
    (p_search      is null or t.description ilike '%' || p_search || '%'
                           or t.payee       ilike '%' || p_search || '%')
    and (p_type        is null or t.type = p_type)
    and (p_account_id  is null or t.account_id = p_account_id
                               or t.transfer_account_id = p_account_id)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_date_from   is null or t.occurred_on >= p_date_from)
    and (p_date_to     is null or t.occurred_on <= p_date_to)
    and (p_amount_min  is null or t.amount >= p_amount_min)
    and (p_amount_max  is null or t.amount <= p_amount_max);
$$;

comment on function public.get_transaction_totals is
  'DB-side income/expense/transfer totals for a filtered transaction set.';

-- >>>>>>>>>>>>>>>>>>>> 0007_dashboard_functions.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0007_dashboard_functions.sql
--
-- Aggregation for the dashboard. Everything the dashboard shows is computed in
-- PostgreSQL and returned as a small result set, so the browser never downloads
-- transactions just to add them up.
--
-- CRITICAL: transfers are never counted as income or expenses. A transfer moves
-- money between the user's own accounts; counting it would inflate both sides
-- and make savings meaningless. Every function below filters on type.
--
-- All functions are SECURITY INVOKER, so RLS on `transactions` still applies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Monthly income / expense / transfer summary for a date range, grouped by
-- month. Powers the "this month" cards and the income-vs-expense trend.
-- ---------------------------------------------------------------------------
create or replace function public.get_monthly_summary(
  p_months integer default 6
)
returns table (
  month_start date,
  income numeric,
  expense numeric,
  transfer numeric,
  savings numeric
)
language sql
stable
as $$
  with bounds as (
    select date_trunc('month', current_date)::date as this_month
  ),
  months as (
    select generate_series(
      (select this_month from bounds) - make_interval(months => greatest(p_months, 1) - 1),
      (select this_month from bounds),
      interval '1 month'
    )::date as month_start
  )
  select
    m.month_start,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)   as income,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)  as expense,
    coalesce(sum(t.amount) filter (where t.type = 'transfer'), 0) as transfer,
    -- Savings is income minus expenses. Transfers are excluded on purpose.
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as savings
  from months m
  left join public.transactions t
    on t.occurred_on >= m.month_start
   and t.occurred_on < (m.month_start + interval '1 month')
  group by m.month_start
  order by m.month_start;
$$;

comment on function public.get_monthly_summary is
  'Income/expense/transfer totals per month for the last N months. Transfers excluded from savings.';

-- ---------------------------------------------------------------------------
-- Spending by category for a date range. Powers the category breakdown chart.
-- Expenses only: income categories would not be comparable.
-- ---------------------------------------------------------------------------
create or replace function public.get_spending_by_category(
  p_date_from date default null,
  p_date_to   date default null
)
returns table (
  category_id uuid,
  category_name text,
  total numeric
)
language sql
stable
as $$
  select
    c.id   as category_id,
    c.name as category_name,
    sum(t.amount) as total
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.type = 'expense'
    and (p_date_from is null or t.occurred_on >= p_date_from)
    and (p_date_to   is null or t.occurred_on <= p_date_to)
  group by c.id, c.name
  order by total desc;
$$;

comment on function public.get_spending_by_category is
  'Expense totals per category for a date range. Transfers and income excluded.';

-- ---------------------------------------------------------------------------
-- Total net worth: sum of every non-archived account's derived balance.
-- Reads the account_balances view, so it inherits RLS and exact arithmetic.
-- ---------------------------------------------------------------------------
create or replace function public.get_net_worth()
returns numeric
language sql
stable
as $$
  select coalesce(sum(current_balance), 0)
  from public.account_balances
  where not is_archived;
$$;

comment on function public.get_net_worth is
  'Sum of non-archived account balances (derived). Respects RLS.';

-- >>>>>>>>>>>>>>>>>>>> 0008_budgets.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0008_budgets.sql
--
-- Budgets: a monthly spending allowance per expense category.
--
-- Model:
--   budgets      one per user per month ("September 2026 budget")
--   budget_items one row per category, holding the budgeted amount
--
-- Ownership uses the same composite-foreign-key pattern as transactions:
-- budget_items carries user_id and references budgets(id, user_id) AND
-- categories(id, user_id), so it is structurally impossible to attach a
-- budget item to another user's budget or category.
--
-- IMPORTANT: a budget is not a balance. "Remaining" is an allowance for a
-- category this month, derived from expense transactions. It is NOT cash on
-- hand and must not be presented as such.
--
-- Spending is always computed from transactions, never stored, so budget
-- figures cannot drift from the ledger.
-- ============================================================================

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- First day of the month the budget applies to. Storing a DATE keeps range
  -- queries and the uniqueness rule trivial.
  period_month date not null,
  name         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (id, user_id),
  -- Exactly one budget per user per month.
  unique (user_id, period_month),
  -- Guard against nonsense dates: must be the first of a month.
  constraint budgets_first_of_month_check
    check (date_trunc('month', period_month)::date = period_month)
);

create index budgets_user_period_idx
  on public.budgets (user_id, period_month desc);

create table public.budget_items (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  amount      numeric(19, 4) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint budget_items_budget_fk
    foreign key (budget_id, user_id)
    references public.budgets (id, user_id)
    on delete cascade,
  constraint budget_items_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete restrict,

  -- One line per category within a budget.
  unique (budget_id, category_id)
);

create index budget_items_budget_idx on public.budget_items (budget_id);
create index budget_items_user_idx on public.budget_items (user_id);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

create trigger budget_items_set_updated_at
  before update on public.budget_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Budget items may only reference *expense* categories.
-- A composite FK cannot express this, so a trigger enforces it, mirroring
-- enforce_transaction_category_kind from 0001.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_budget_item_expense_category()
returns trigger
language plpgsql
as $$
declare
  category_kind public.category_kind;
begin
  select kind into category_kind
  from public.categories
  where id = new.category_id and user_id = new.user_id;

  if category_kind is null then
    raise exception 'Category % does not exist for this user', new.category_id
      using errcode = 'foreign_key_violation';
  end if;

  if category_kind <> 'expense' then
    raise exception 'Budgets can only be set on expense categories (got %)',
      category_kind
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger budget_items_enforce_expense_category
  before insert or update on public.budget_items
  for each row execute function public.enforce_budget_item_expense_category();

-- >>>>>>>>>>>>>>>>>>>> 0009_budget_rls.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0009_budget_rls.sql
--
-- Row Level Security for budgets and budget_items. Same ownership rule as every
-- other table: user_id = auth.uid(). Without policies, RLS defaults to denying
-- everything, so these are required.
-- ============================================================================

alter table public.budgets      enable row level security;
alter table public.budget_items enable row level security;

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
create policy "budgets_select_own"
  on public.budgets for select
  using (user_id = auth.uid());

create policy "budgets_insert_own"
  on public.budgets for insert
  with check (user_id = auth.uid());

create policy "budgets_update_own"
  on public.budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budgets_delete_own"
  on public.budgets for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- budget_items
-- ---------------------------------------------------------------------------
create policy "budget_items_select_own"
  on public.budget_items for select
  using (user_id = auth.uid());

create policy "budget_items_insert_own"
  on public.budget_items for insert
  with check (user_id = auth.uid());

create policy "budget_items_update_own"
  on public.budget_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budget_items_delete_own"
  on public.budget_items for delete
  using (user_id = auth.uid());

-- >>>>>>>>>>>>>>>>>>>> 0010_budget_status.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0010_budget_status.sql
--
-- Budget vs actual for a given month, computed entirely in PostgreSQL.
--
-- Returns one row per budget item with its category, budgeted amount, amount
-- spent (from expense transactions in that month), remaining, and percentage
-- used. Only expenses count; transfers are never spending.
--
-- SECURITY INVOKER, so RLS applies to budgets, budget_items and transactions.
-- ============================================================================

create or replace function public.get_budget_status(
  p_period_month date
)
returns table (
  budget_id       uuid,
  budget_name     text,
  period_month    date,
  item_id         uuid,
  category_id     uuid,
  category_name   text,
  budgeted        numeric,
  spent           numeric,
  remaining       numeric,
  percent_used    numeric
)
language sql
stable
as $$
  with month_bounds as (
    select
      date_trunc('month', p_period_month)::date as start_date,
      (date_trunc('month', p_period_month) + interval '1 month')::date as end_date
  ),
  spending as (
    select
      t.category_id,
      sum(t.amount) as spent
    from public.transactions t, month_bounds b
    where t.type = 'expense'
      and t.occurred_on >= b.start_date
      and t.occurred_on <  b.end_date
    group by t.category_id
  )
  select
    b.id           as budget_id,
    b.name         as budget_name,
    b.period_month as period_month,
    bi.id          as item_id,
    c.id           as category_id,
    c.name         as category_name,
    bi.amount      as budgeted,
    coalesce(s.spent, 0) as spent,
    bi.amount - coalesce(s.spent, 0) as remaining,
    case
      when bi.amount = 0 then
        -- Avoid division by zero; any spending against a zero budget is 100%.
        case when coalesce(s.spent, 0) > 0 then 100 else 0 end
      else
        round((coalesce(s.spent, 0) / bi.amount) * 100, 1)
    end as percent_used
  from public.budgets b
  join public.budget_items bi on bi.budget_id = b.id
  join public.categories c    on c.id = bi.category_id
  left join spending s        on s.category_id = bi.category_id
  where b.period_month = (select start_date from month_bounds)
  order by c.name;
$$;

comment on function public.get_budget_status is
  'Budget vs actual spending per category for a month. Expenses only; transfers excluded.';

-- ---------------------------------------------------------------------------
-- Copy a month's budget into another month.
--
-- Returns the new budget's id. Does nothing and returns the existing budget if
-- the target month already has one, so the button is safe to press twice.
-- SECURITY INVOKER: every insert is still subject to RLS.
-- ---------------------------------------------------------------------------
create or replace function public.copy_budget(
  p_from_month date,
  p_to_month   date
)
returns uuid
language plpgsql
as $$
declare
  v_user_id    uuid := auth.uid();
  v_new_budget uuid;
  v_existing   uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select id into v_existing
  from public.budgets
  where user_id = v_user_id
    and period_month = date_trunc('month', p_to_month)::date;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.budgets (user_id, period_month, name)
  select v_user_id, date_trunc('month', p_to_month)::date, b.name
  from public.budgets b
  where b.user_id = v_user_id
    and b.period_month = date_trunc('month', p_from_month)::date
  returning id into v_new_budget;

  if v_new_budget is null then
    raise exception 'No budget found for %', p_from_month
      using errcode = 'no_data_found';
  end if;

  insert into public.budget_items (budget_id, user_id, category_id, amount)
  select v_new_budget, v_user_id, bi.category_id, bi.amount
  from public.budget_items bi
  where bi.budget_id = (
    select id from public.budgets
    where user_id = v_user_id
      and period_month = date_trunc('month', p_from_month)::date
  );

  return v_new_budget;
end;
$$;

comment on function public.copy_budget is
  'Copies a budget from one month to another. Idempotent; returns the target budget id.';
