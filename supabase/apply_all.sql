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
-- Wrapped in DO blocks so re-running the file is safe: `create type` has no
-- `if not exists`, but a duplicate_object can simply be ignored.
do $$ begin
  create type public.account_type as enum (
    'cash',
    'bank',
    'savings',
    'mobile_money',
    'investment',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles
--
-- One row per auth.users row, created automatically by a trigger. We do not
-- duplicate the email here (it lives in auth.users); this holds app-specific
-- preferences.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
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
create table if not exists public.accounts (
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

create index if not exists accounts_user_id_idx on public.accounts (user_id);

-- A user cannot have two *active* accounts with the same name. Archived
-- accounts are exempt, so a name can be reused after archiving.
create unique index if not exists accounts_user_name_active_idx
  on public.accounts (user_id, name)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- categories
--
-- Default categories are copied into each new user's account on signup, so
-- every category has a real owner. This keeps RLS and the composite-FK
-- ownership model uniform (no special-cased NULL user_id rows).
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
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

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists categories_user_kind_idx on public.categories (user_id, kind);

-- Names are unique per kind among active categories; archived ones are exempt.
create unique index if not exists categories_user_name_kind_active_idx
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
create table if not exists public.transactions (
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

create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);
create index if not exists transactions_user_account_idx
  on public.transactions (user_id, account_id);
create index if not exists transactions_transfer_account_idx
  on public.transactions (transfer_account_id)
  where transfer_account_id is not null;
create index if not exists transactions_user_category_idx
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
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

drop trigger if exists transactions_enforce_category_kind on public.transactions;
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
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own"
  on public.accounts for select
  using (user_id = auth.uid());

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own"
  on public.accounts for insert
  with check (user_id = auth.uid());

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
  on public.accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own"
  on public.accounts for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
  on public.categories for select
  using (user_id = auth.uid());

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories for insert
  with check (user_id = auth.uid());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (user_id = auth.uid());

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (user_id = auth.uid());

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "transactions_delete_own" on public.transactions;
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

create or replace view public.account_balances
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

create or replace view public.transaction_details
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
create index if not exists transactions_user_type_occurred_idx
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

create table if not exists public.budgets (
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

create index if not exists budgets_user_period_idx
  on public.budgets (user_id, period_month desc);

create table if not exists public.budget_items (
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

create index if not exists budget_items_budget_idx on public.budget_items (budget_id);
create index if not exists budget_items_user_idx on public.budget_items (user_id);

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

drop trigger if exists budget_items_set_updated_at on public.budget_items;
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

drop trigger if exists budget_items_enforce_expense_category on public.budget_items;
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
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets for select
  using (user_id = auth.uid());

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own"
  on public.budgets for insert
  with check (user_id = auth.uid());

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own"
  on public.budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own"
  on public.budgets for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- budget_items
-- ---------------------------------------------------------------------------
drop policy if exists "budget_items_select_own" on public.budget_items;
create policy "budget_items_select_own"
  on public.budget_items for select
  using (user_id = auth.uid());

drop policy if exists "budget_items_insert_own" on public.budget_items;
create policy "budget_items_insert_own"
  on public.budget_items for insert
  with check (user_id = auth.uid());

drop policy if exists "budget_items_update_own" on public.budget_items;
create policy "budget_items_update_own"
  on public.budget_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "budget_items_delete_own" on public.budget_items;
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


-- >>>>>>>>>>>>>>>>>>>> 0011_goals.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0011_goals.sql
--
-- Savings goals and the contributions made toward them.
--
-- Model:
--   goals               one row per goal ("Driving lessons")
--   goal_contributions  a ledger of money put toward a goal
--
-- IMPORTANT: progress is DERIVED from goal_contributions, exactly as account
-- balances are derived from transactions. There is no `current_amount` column,
-- so a goal's progress can never drift from the contributions that produced it.
--
-- A contribution is its own record, not a transaction. Putting money toward a
-- goal is not spending and is not a transfer between accounts, so keeping it
-- out of `transactions` means a contribution can never inflate expenses or be
-- miscounted as a transfer.
--
-- Ownership uses the composite-foreign-key pattern: goal_contributions carries
-- user_id and references goals(id, user_id), so a contribution can never attach
-- to another user's goal even if a query forgets to filter by user_id.
--
-- The model is deliberately contribution-oriented rather than a single stored
-- "current amount": future automation (recurring contributions, linking a
-- contribution to a transfer) can append to the ledger without a schema change.
-- ============================================================================

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 80),
  target_amount numeric(19, 4) not null check (target_amount > 0),
  -- Optional deadline. A DATE, not a timestamp, for the same timezone-safety
  -- reason transactions use `occurred_on`.
  target_date   date,
  notes         text,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (id, user_id)
);

create index if not exists goals_user_id_idx on public.goals (user_id);

-- A user cannot have two *active* goals with the same name. Archived goals are
-- exempt so a name can be reused after archiving.
create unique index if not exists goals_user_name_active_idx
  on public.goals (user_id, name)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- goal_contributions
--
-- Amounts are always positive, mirroring transactions: direction lives in the
-- sign of the derived sum, not in the stored value.
-- ---------------------------------------------------------------------------
create table if not exists public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  amount         numeric(19, 4) not null check (amount > 0),
  contributed_on date not null default current_date,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint goal_contributions_goal_fk
    foreign key (goal_id, user_id)
    references public.goals (id, user_id)
    on delete cascade
);

create index if not exists goal_contributions_goal_idx
  on public.goal_contributions (goal_id);
create index if not exists goal_contributions_user_idx
  on public.goal_contributions (user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

drop trigger if exists goal_contributions_set_updated_at on public.goal_contributions;
create trigger goal_contributions_set_updated_at
  before update on public.goal_contributions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goal_progress view
--
-- Derives each goal's current amount, remaining and completion percentage from
-- its contributions.
--
-- `security_invoker = true` is essential: without it the view would run as its
-- owner and bypass RLS, exposing every user's goals. With it, the caller's RLS
-- policies on goals/goal_contributions apply.
--
-- `target_amount > 0` is enforced by a CHECK, so the division cannot hit zero.
-- ---------------------------------------------------------------------------
create or replace view public.goal_progress
with (security_invoker = true)
as
select
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.target_date,
  g.notes,
  g.is_archived,
  g.created_at,
  g.updated_at,
  coalesce(sum(c.amount), 0)                             as current_amount,
  g.target_amount - coalesce(sum(c.amount), 0)           as remaining,
  round((coalesce(sum(c.amount), 0) / g.target_amount) * 100, 1) as percent_complete
from public.goals g
left join public.goal_contributions c on c.goal_id = g.id
group by g.id;

comment on view public.goal_progress is
  'Derived goal progress (current/remaining/percent) from contributions. security_invoker=true so RLS applies.';


-- >>>>>>>>>>>>>>>>>>>> 0012_goal_rls.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0012_goal_rls.sql
--
-- Row Level Security for goals and goal_contributions. Same ownership rule as
-- every other table: user_id = auth.uid(). Without policies, RLS defaults to
-- denying everything, so these are required.
-- ============================================================================

alter table public.goals               enable row level security;
alter table public.goal_contributions  enable row level security;

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own"
  on public.goals for select
  using (user_id = auth.uid());

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own"
  on public.goals for insert
  with check (user_id = auth.uid());

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own"
  on public.goals for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own"
  on public.goals for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- goal_contributions
-- ---------------------------------------------------------------------------
drop policy if exists "goal_contributions_select_own" on public.goal_contributions;
create policy "goal_contributions_select_own"
  on public.goal_contributions for select
  using (user_id = auth.uid());

drop policy if exists "goal_contributions_insert_own" on public.goal_contributions;
create policy "goal_contributions_insert_own"
  on public.goal_contributions for insert
  with check (user_id = auth.uid());

drop policy if exists "goal_contributions_update_own" on public.goal_contributions;
create policy "goal_contributions_update_own"
  on public.goal_contributions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "goal_contributions_delete_own" on public.goal_contributions;
create policy "goal_contributions_delete_own"
  on public.goal_contributions for delete
  using (user_id = auth.uid());


-- >>>>>>>>>>>>>>>>>>>> 0013_search_consistency.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0013_search_consistency.sql
--
-- Makes the transaction list and its totals agree on search semantics.
--
-- The list searches through PostgREST with `description.ilike."*term*"`, and
-- `get_transaction_totals` searches in SQL with `ilike '%' || term || '%'`.
-- They are different parsers, and they disagreed on one important character:
--
--   * PostgREST maps `*` to `%` inside an `ilike` value (its wildcard alias),
--     so the list treated `*` as "match anything".
--   * The SQL function passed `*` straight to Postgres, where it is a literal.
--
-- So a search containing `*` matched different rows in the table and in the
-- totals header. `%` and `_` were already wildcards on both sides, and the
-- client already strips `"` and `\`, so those are handled below to stay in
-- lockstep with src/lib/data/search.ts.
--
-- `normalize_search_term` is the single SQL-side definition of that contract.
-- ============================================================================

create or replace function public.normalize_search_term(p_term text)
returns text
language sql
immutable
as $$
  select
    case
      when p_term is null or trim(p_term) = '' then null
      else
        -- Mirrors normalizeSearchTerm() + postgrestSearchPattern() in
        -- src/lib/data/search.ts: strip quotes/backslashes (structural in
        -- PostgREST's filter grammar), cap the length, and map `*` to `%`
        -- (PostgREST's ilike wildcard alias).
        replace(
          left(replace(replace(trim(p_term), '"', ''), '\', ''), 100),
          '*', '%'
        )
    end;
$$;

comment on function public.normalize_search_term is
  'Normalises a transaction search term to match the PostgREST list filter. Strips quotes/backslashes, caps length, maps * to %.';

-- ---------------------------------------------------------------------------
-- Re-create the totals function so its search predicate uses the shared
-- normaliser and therefore matches the list query exactly.
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
    (p_search      is null
                   or public.normalize_search_term(p_search) is null
                   or t.description ilike '%' || public.normalize_search_term(p_search) || '%'
                   or t.payee       ilike '%' || public.normalize_search_term(p_search) || '%')
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
  'DB-side income/expense/transfer totals for a filtered transaction set. Search uses normalize_search_term so it matches the list query.';


-- >>>>>>>>>>>>>>>>>>>> 0014_balance_breakdown.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0014_balance_breakdown.sql
--
-- Splits the derived balances into "spendable" and "savings" so the dashboard
-- can show a savings account without it being lumped into everyday spending
-- money.
--
-- Definition:
--   spendable  = current_balance of every non-archived account whose type is
--                NOT 'savings' (cash, bank, mobile money, investment, other)
--   savings    = current_balance of non-archived 'savings' accounts only
--   net_worth  = spendable + savings (every non-archived account)
--
-- This is a presentation split, not a financial invariant: both figures come
-- from the same `account_balances` view, so they always agree and net_worth is
-- simply their sum. `get_net_worth` is left unchanged for callers (the AI
-- assistant) that want the single total.
--
-- SECURITY INVOKER, so RLS on the underlying view still applies.
-- ============================================================================

-- Dropped and recreated rather than `create or replace`: later migrations
-- (0017, 0020) change this function's return signature, and `create or replace`
-- cannot do that. Dropping first keeps this file idempotent when it is replayed
-- from apply_all.sql against a database that already has a newer shape.
drop function if exists public.get_balance_breakdown();

create function public.get_balance_breakdown()
returns table (
  spendable numeric,
  savings   numeric,
  net_worth numeric
)
language sql
stable
as $$
  select
    coalesce(sum(current_balance) filter (where type <> 'savings'), 0) as spendable,
    coalesce(sum(current_balance) filter (where type =  'savings'), 0) as savings,
    coalesce(sum(current_balance), 0)                                  as net_worth
  from public.account_balances
  where not is_archived;
$$;

comment on function public.get_balance_breakdown is
  'Non-archived balances split into spendable vs savings accounts, plus net worth. Respects RLS.';


-- >>>>>>>>>>>>>>>>>>>> 0015_investments.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0015_investments.sql
--
-- Investment tracking (MVP): simple holdings with a manually-updated current
-- value.
--
-- Model decision: a holding is ONE row (name, asset type, quantity, purchase
-- price/date, current value). This matches the MVP fields exactly and keeps
-- entry fast. A buy/sell ledger with derived quantity/cost basis is a future
-- upgrade and would be additive (an investment_transactions table plus a view),
-- not a rewrite of this table.
--
-- IMPORTANT: an investment is not a spending category. Buying an investment
-- moves value from cash into an asset; it is not consumption. Investments live
-- in their own table and are never counted as expenses. They DO contribute to
-- net worth, alongside spendable and savings balances.
--
-- `current_value` is nullable: a holding whose current value is unknown falls
-- back to cost (quantity * purchase_price) in the derived view, so net worth
-- never silently drops the holding. When set, it wins.
--
-- Ownership is direct (user_id) with RLS, like every other table.
-- ============================================================================

create table if not exists public.investments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 120),
  asset_type      text not null default 'other'
                    check (asset_type in ('stock','bond','fund','real_estate','crypto','other')),
  quantity        numeric(19, 8) not null default 1 check (quantity >= 0),
  -- Price per unit at purchase. Non-negative; a free acquisition is 0.
  purchase_price  numeric(19, 4) not null default 0 check (purchase_price >= 0),
  purchase_date   date,
  -- Manually-maintained market value of the whole holding. Optional.
  current_value   numeric(19, 4) check (current_value >= 0),
  notes           text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (id, user_id)
);

create index if not exists investments_user_id_idx on public.investments (user_id);

-- A user cannot have two *active* holdings with the same name. Archived ones
-- are exempt so a name can be reused.
create unique index if not exists investments_user_name_active_idx
  on public.investments (user_id, name)
  where not is_archived;

drop trigger if exists investments_set_updated_at on public.investments;
create trigger investments_set_updated_at
  before update on public.investments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- investment_holdings view
--
-- Derives cost basis, market value and gain/loss from the stored fields.
--   cost_basis  = quantity * purchase_price
--   market_value = current_value when set, else cost_basis
--   gain        = market_value - cost_basis
--
-- `security_invoker = true` so the caller's RLS policies apply (a view without
-- it runs as its owner and would leak every user's holdings).
-- ---------------------------------------------------------------------------
create or replace view public.investment_holdings
with (security_invoker = true)
as
select
  i.id,
  i.user_id,
  i.name,
  i.asset_type,
  i.quantity,
  i.purchase_price,
  i.purchase_date,
  i.current_value,
  i.notes,
  i.is_archived,
  i.created_at,
  i.updated_at,
  round(i.quantity * i.purchase_price, 4)                       as cost_basis,
  round(coalesce(i.current_value, i.quantity * i.purchase_price), 4) as market_value,
  round(coalesce(i.current_value, i.quantity * i.purchase_price)
        - i.quantity * i.purchase_price, 4)                     as gain
from public.investments i;

comment on view public.investment_holdings is
  'Investment holdings with derived cost basis, market value and gain. security_invoker=true so RLS applies.';

-- ---------------------------------------------------------------------------
-- Portfolio total for the dashboard/net worth.
--
-- SECURITY INVOKER, so RLS on the view applies. Uses market_value (which falls
-- back to cost), so an unpriced holding still counts.
-- ---------------------------------------------------------------------------
create or replace function public.get_portfolio_value()
returns numeric
language sql
stable
as $$
  select coalesce(sum(market_value), 0)
  from public.investment_holdings
  where not is_archived;
$$;

comment on function public.get_portfolio_value is
  'Total market value of non-archived investment holdings. Respects RLS.';


-- >>>>>>>>>>>>>>>>>>>> 0016_investment_rls.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0016_investment_rls.sql
--
-- Row Level Security for investments. Same ownership rule as every other table
-- (`user_id = auth.uid()`). Without policies, RLS denies everything.
-- ============================================================================

alter table public.investments enable row level security;

drop policy if exists "investments_select_own" on public.investments;
create policy "investments_select_own"
  on public.investments for select
  using (user_id = auth.uid());

drop policy if exists "investments_insert_own" on public.investments;
create policy "investments_insert_own"
  on public.investments for insert
  with check (user_id = auth.uid());

drop policy if exists "investments_update_own" on public.investments;
create policy "investments_update_own"
  on public.investments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "investments_delete_own" on public.investments;
create policy "investments_delete_own"
  on public.investments for delete
  using (user_id = auth.uid());


-- >>>>>>>>>>>>>>>>>>>> 0017_net_worth_with_investments.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0017_net_worth_with_investments.sql
--
-- Investments contribute to net worth. This extends the balance breakdown with
-- an `investments` figure and redefines net worth as:
--
--   net_worth = spendable + savings + investments
--
-- The change is a new migration rather than an edit to 0014 because the return
-- signature of `get_balance_breakdown` changes; Postgres cannot `create or
-- replace` a function with a different return type, so it is dropped first.
--
-- `get_net_worth` is redefined the same way, so there is a single consistent
-- definition of net worth for every caller (dashboard, assistant).
--
-- Both read `account_balances` and `investment_holdings`, which are
-- security_invoker and already RLS-scoped, so authorization is unchanged.
-- ============================================================================

drop function if exists public.get_balance_breakdown();

create function public.get_balance_breakdown()
returns table (
  spendable   numeric,
  savings     numeric,
  investments numeric,
  net_worth   numeric
)
language sql
stable
as $$
  with account_totals as (
    select
      coalesce(sum(current_balance) filter (where type <> 'savings'), 0) as spendable,
      coalesce(sum(current_balance) filter (where type =  'savings'), 0) as savings
    from public.account_balances
    where not is_archived
  ),
  portfolio as (
    select coalesce(sum(market_value), 0) as investments
    from public.investment_holdings
    where not is_archived
  )
  select
    a.spendable,
    a.savings,
    p.investments,
    a.spendable + a.savings + p.investments as net_worth
  from account_totals a, portfolio p;
$$;

comment on function public.get_balance_breakdown is
  'Non-archived balances split into spendable, savings and investments, plus net worth (their sum). Respects RLS.';

-- Redefine net worth to match, so no caller sees a different total.
create or replace function public.get_net_worth()
returns numeric
language sql
stable
as $$
  select
    coalesce((
      select sum(current_balance)
      from public.account_balances
      where not is_archived
    ), 0)
    + coalesce((
      select sum(market_value)
      from public.investment_holdings
      where not is_archived
    ), 0);
$$;

comment on function public.get_net_worth is
  'Net worth = non-archived account balances + investment market value. Respects RLS.';


-- >>>>>>>>>>>>>>>>>>>> 0018_debts.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0018_debts.sql
--
-- Debt tracking (MVP): money owed by me, and money owed to me.
--
-- Model decision: a debt is ONE row holding the original `principal` and a
-- manually-maintained `remaining_amount`. This matches the MVP fields
-- (person/entity, amount, date, due date, status, notes) and keeps updates to a
-- single field. A payments ledger with a derived balance is a future upgrade
-- and would be additive, not a rewrite.
--
-- STATUS IS DERIVED, never stored. Storing both a status and a remaining amount
-- would create two sources of truth that can disagree (status 'open' with 0
-- remaining). Instead the view derives it, exactly as goal progress is derived
-- from contributions:
--
--   written_off  -> is_written_off = true
--   settled      -> remaining_amount <= 0
--   open         -> otherwise
--
-- IMPORTANT: a debt is not a transaction and not an expense. Lending or
-- borrowing money is not consumption; debts live in their own table and are
-- never counted in expense totals. Open debts DO affect net worth:
-- money owed to me is an asset (+), money I owe is a liability (-).
--
-- Ownership is direct (user_id) with RLS, like every other table.
-- ============================================================================

create table if not exists public.debts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  direction        text not null
                     check (direction in ('owed_by_me', 'owed_to_me')),
  counterparty     text not null check (length(trim(counterparty)) between 1 and 120),
  -- Original amount. Always positive; direction carries the sign.
  principal        numeric(19, 4) not null check (principal > 0),
  -- Outstanding amount, updated by the user as they pay or are paid.
  remaining_amount numeric(19, 4) not null check (remaining_amount >= 0),
  started_on       date not null default current_date,
  due_date         date,
  is_written_off   boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (id, user_id)
);

create index if not exists debts_user_id_idx on public.debts (user_id);
create index if not exists debts_user_direction_idx
  on public.debts (user_id, direction);

drop trigger if exists debts_set_updated_at on public.debts;
create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- debt_details view
--
-- Adds the derived `status` and `settled_amount` (how much has been repaid or
-- collected). `security_invoker = true` so the caller's RLS policies apply.
-- ---------------------------------------------------------------------------
create or replace view public.debt_details
with (security_invoker = true)
as
select
  d.id,
  d.user_id,
  d.direction,
  d.counterparty,
  d.principal,
  d.remaining_amount,
  d.started_on,
  d.due_date,
  d.is_written_off,
  d.notes,
  d.created_at,
  d.updated_at,
  round(d.principal - d.remaining_amount, 4) as settled_amount,
  case
    when d.is_written_off then 'written_off'
    when d.remaining_amount <= 0 then 'settled'
    else 'open'
  end as status
from public.debts d;

comment on view public.debt_details is
  'Debts with derived status and settled amount. security_invoker=true so RLS applies.';


-- >>>>>>>>>>>>>>>>>>>> 0019_debt_rls.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0019_debt_rls.sql
--
-- Row Level Security for debts. Same ownership rule as every other table
-- (`user_id = auth.uid()`). Without policies, RLS denies everything.
-- ============================================================================

alter table public.debts enable row level security;

drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own"
  on public.debts for select
  using (user_id = auth.uid());

drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own"
  on public.debts for insert
  with check (user_id = auth.uid());

drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own"
  on public.debts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own"
  on public.debts for delete
  using (user_id = auth.uid());


-- >>>>>>>>>>>>>>>>>>>> 0020_net_worth_with_debts.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0020_net_worth_with_debts.sql
--
-- Outstanding debts affect net worth:
--   owed_to_me  = open money owed to me   (an asset, +)
--   owed_by_me  = open money I owe        (a liability, -)
--
--   net_worth = spendable + savings + investments + owed_to_me - owed_by_me
--
-- Only debts that are still OPEN count: settled and written-off debts are
-- excluded, so paying one off does not leave a phantom liability on the books.
--
-- The return signature changes, so `get_balance_breakdown` is dropped and
-- recreated (Postgres cannot `create or replace` a different return type).
-- `get_net_worth` is redefined to match, keeping one definition for every
-- caller (dashboard, assistant).
--
-- All sources are security_invoker views, so RLS is unchanged.
-- ============================================================================

drop function if exists public.get_balance_breakdown();

create function public.get_balance_breakdown()
returns table (
  spendable   numeric,
  savings     numeric,
  investments numeric,
  owed_to_me  numeric,
  owed_by_me  numeric,
  net_worth   numeric
)
language sql
stable
as $$
  with account_totals as (
    select
      coalesce(sum(current_balance) filter (where type <> 'savings'), 0) as spendable,
      coalesce(sum(current_balance) filter (where type =  'savings'), 0) as savings
    from public.account_balances
    where not is_archived
  ),
  portfolio as (
    select coalesce(sum(market_value), 0) as investments
    from public.investment_holdings
    where not is_archived
  ),
  debt_totals as (
    select
      coalesce(sum(remaining_amount) filter (where direction = 'owed_to_me'), 0) as owed_to_me,
      coalesce(sum(remaining_amount) filter (where direction = 'owed_by_me'), 0) as owed_by_me
    from public.debts
    -- "open": not written off and still outstanding. Matches debt_details.status.
    where not is_written_off and remaining_amount > 0
  )
  select
    a.spendable,
    a.savings,
    p.investments,
    d.owed_to_me,
    d.owed_by_me,
    a.spendable + a.savings + p.investments + d.owed_to_me - d.owed_by_me as net_worth
  from account_totals a, portfolio p, debt_totals d;
$$;

comment on function public.get_balance_breakdown is
  'Non-archived balances split into spendable, savings and investments, plus open debts, plus net worth. Respects RLS.';

-- Redefine net worth to match, so no caller sees a different total.
create or replace function public.get_net_worth()
returns numeric
language sql
stable
as $$
  select
    coalesce((select sum(current_balance) from public.account_balances where not is_archived), 0)
    + coalesce((select sum(market_value) from public.investment_holdings where not is_archived), 0)
    + coalesce((select sum(remaining_amount) from public.debts where not is_written_off and remaining_amount > 0 and direction = 'owed_to_me'), 0)
    - coalesce((select sum(remaining_amount) from public.debts where not is_written_off and remaining_amount > 0 and direction = 'owed_by_me'), 0);
$$;

comment on function public.get_net_worth is
  'Net worth = account balances + investments + open money owed to me - open money I owe. Respects RLS.';


-- >>>>>>>>>>>>>>>>>>>> 0021_net_worth_history.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 0021_net_worth_history.sql
--
-- Month-by-month net worth reconstructed from the ledger.
--
-- HONEST SCOPE: only *account* net worth has history. Account balances derive
-- from opening balances plus dated transactions, so a past month's balance can
-- be reconstructed exactly. Investments and debts have no dated history (each
-- holding stores only a single current value), so they cannot be reconstructed
-- for past months and are deliberately NOT included. The UI labels this series
-- "accounts only" so the number is never mistaken for total net worth.
--
-- Method: for each month start, sum each account's opening_balance plus all
-- signed transactions with occurred_on < the next month start. This is the same
-- arithmetic as `account_balances`, evaluated as of a past date. Transfers move
-- money between accounts, so they cancel out in a per-user total; they are
-- still applied per-account via the CASE, exactly as the balance view does.
--
-- SECURITY INVOKER, so RLS on accounts and transactions applies.
-- ============================================================================

create or replace function public.get_net_worth_history(
  p_months integer default 12
)
returns table (
  month_start     date,
  account_total   numeric
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
  ),
  account_openings as (
    -- Opening balance only counts for accounts that existed at that month's
    -- start; using created_at keeps a brand-new account from appearing in the
    -- past with its opening balance.
    select m.month_start, sum(a.opening_balance) as opening
    from months m
    join public.accounts a
      on a.created_at < (m.month_start + interval '1 month')
    where not a.is_archived
    group by m.month_start
  ),
  account_movements as (
    -- Restricted to the same non-archived accounts the opening CTE uses, so
    -- the two halves of the sum describe the same set of accounts.
    select
      m.month_start,
      coalesce(sum(
        case
          when t.type = 'income'   then  t.amount
          when t.type = 'expense'  then -t.amount
          -- Transfers net to zero across a user's own accounts (money leaves
          -- one account and arrives in another), so they add nothing to the
          -- per-user total. A transfer is a single row, counted once.
          when t.type = 'transfer' then 0
          else 0
        end
      ), 0) as movement
    from months m
    left join public.transactions t
      on t.occurred_on < (m.month_start + interval '1 month')
    left join public.accounts a on a.id = t.account_id
    where t.id is null or not a.is_archived
    group by m.month_start
  )
  select
    m.month_start,
    coalesce(o.opening, 0) + coalesce(v.movement, 0) as account_total
  from months m
  left join account_openings o  on o.month_start = m.month_start
  left join account_movements v on v.month_start = m.month_start
  order by m.month_start;
$$;

comment on function public.get_net_worth_history is
  'Reconstructed month-end net worth from account balances only (investments/debts have no history). Respects RLS.';
