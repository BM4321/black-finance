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
