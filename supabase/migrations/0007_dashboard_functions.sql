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
