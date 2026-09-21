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
