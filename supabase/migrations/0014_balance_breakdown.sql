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

create or replace function public.get_balance_breakdown()
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
