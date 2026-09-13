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
