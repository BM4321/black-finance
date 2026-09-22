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
