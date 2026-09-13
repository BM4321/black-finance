-- ============================================================================
-- 0010_budget_status.sql
--
-- Budget vs actual for a given month, computed entirely in PostgreSQL.
--
-- Returns one row per budget item with its category, budgeted amount, amount
-- spent (from expense transactions in that month), remaining, and percentage
-- used. Only expenses count; transfers are never spending.
--
-- SECURITY INVOKER, so RLS applies to budgets, budget_items and transactions.
-- ============================================================================

create or replace function public.get_budget_status(
  p_period_month date
)
returns table (
  budget_id       uuid,
  budget_name     text,
  period_month    date,
  item_id         uuid,
  category_id     uuid,
  category_name   text,
  budgeted        numeric,
  spent           numeric,
  remaining       numeric,
  percent_used    numeric
)
language sql
stable
as $$
  with month_bounds as (
    select
      date_trunc('month', p_period_month)::date as start_date,
      (date_trunc('month', p_period_month) + interval '1 month')::date as end_date
  ),
  spending as (
    select
      t.category_id,
      sum(t.amount) as spent
    from public.transactions t, month_bounds b
    where t.type = 'expense'
      and t.occurred_on >= b.start_date
      and t.occurred_on <  b.end_date
    group by t.category_id
  )
  select
    b.id           as budget_id,
    b.name         as budget_name,
    b.period_month as period_month,
    bi.id          as item_id,
    c.id           as category_id,
    c.name         as category_name,
    bi.amount      as budgeted,
    coalesce(s.spent, 0) as spent,
    bi.amount - coalesce(s.spent, 0) as remaining,
    case
      when bi.amount = 0 then
        -- Avoid division by zero; any spending against a zero budget is 100%.
        case when coalesce(s.spent, 0) > 0 then 100 else 0 end
      else
        round((coalesce(s.spent, 0) / bi.amount) * 100, 1)
    end as percent_used
  from public.budgets b
  join public.budget_items bi on bi.budget_id = b.id
  join public.categories c    on c.id = bi.category_id
  left join spending s        on s.category_id = bi.category_id
  where b.period_month = (select start_date from month_bounds)
  order by c.name;
$$;

comment on function public.get_budget_status is
  'Budget vs actual spending per category for a month. Expenses only; transfers excluded.';

-- ---------------------------------------------------------------------------
-- Copy a month's budget into another month.
--
-- Returns the new budget's id. Does nothing and returns the existing budget if
-- the target month already has one, so the button is safe to press twice.
-- SECURITY INVOKER: every insert is still subject to RLS.
-- ---------------------------------------------------------------------------
create or replace function public.copy_budget(
  p_from_month date,
  p_to_month   date
)
returns uuid
language plpgsql
as $$
declare
  v_user_id    uuid := auth.uid();
  v_new_budget uuid;
  v_existing   uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select id into v_existing
  from public.budgets
  where user_id = v_user_id
    and period_month = date_trunc('month', p_to_month)::date;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.budgets (user_id, period_month, name)
  select v_user_id, date_trunc('month', p_to_month)::date, b.name
  from public.budgets b
  where b.user_id = v_user_id
    and b.period_month = date_trunc('month', p_from_month)::date
  returning id into v_new_budget;

  if v_new_budget is null then
    raise exception 'No budget found for %', p_from_month
      using errcode = 'no_data_found';
  end if;

  insert into public.budget_items (budget_id, user_id, category_id, amount)
  select v_new_budget, v_user_id, bi.category_id, bi.amount
  from public.budget_items bi
  where bi.budget_id = (
    select id from public.budgets
    where user_id = v_user_id
      and period_month = date_trunc('month', p_from_month)::date
  );

  return v_new_budget;
end;
$$;

comment on function public.copy_budget is
  'Copies a budget from one month to another. Idempotent; returns the target budget id.';
