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
