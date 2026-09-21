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
