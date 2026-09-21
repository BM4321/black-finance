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
