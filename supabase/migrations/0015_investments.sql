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
