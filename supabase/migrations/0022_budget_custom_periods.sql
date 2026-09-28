-- ============================================================================
-- 0022_budget_custom_periods.sql
--
-- Budgets can cover a calendar month (1st to last day) or custom dates, so a
-- budget can run from payday to payday (e.g. 25 Sep – 24 Oct) when salary
-- does not land on the 1st.
--
-- Model:
--   period_type  'calendar' | 'custom'
--   start_date   first day counted (inclusive)
--   end_date     last day counted (inclusive)
--   period_month remains the budget's key: the first of the month the period
--                starts in. It stays unique per user, so navigation by month,
--                copy_budget and existing callers keep working.
--
-- A trigger keeps the three in step: a calendar budget is always the whole
-- month of period_month; a custom budget takes period_month from start_date.
-- Periods of one user may not overlap, so a transaction is never counted by
-- two budgets.
--
-- Existing budgets become calendar budgets covering their month, which is
-- exactly how they were already computed.
-- ============================================================================

alter table public.budgets
  add column if not exists period_type text not null default 'calendar';
alter table public.budgets add column if not exists start_date date;
alter table public.budgets add column if not exists end_date date;

update public.budgets
set start_date = period_month,
    end_date   = (period_month + interval '1 month' - interval '1 day')::date
where start_date is null or end_date is null;

alter table public.budgets alter column start_date set not null;
alter table public.budgets alter column end_date set not null;

alter table public.budgets drop constraint if exists budgets_period_type_check;
alter table public.budgets add constraint budgets_period_type_check
  check (period_type in ('calendar', 'custom'));

-- A period is at least one day, at most ~two months, and includes at least
-- one day of the month that keys it. (Relaxed by 0023 from "starts in that
-- month"; kept identical here so re-running the whole set cannot fail on
-- budgets that start in the previous month.)
alter table public.budgets drop constraint if exists budgets_period_range_check;
alter table public.budgets add constraint budgets_period_range_check
  check (
    end_date >= start_date
    and end_date - start_date <= 62
    and start_date <= (period_month + interval '1 month' - interval '1 day')::date
    and end_date >= period_month
  );

create index if not exists budgets_user_dates_idx
  on public.budgets (user_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- Keep period fields consistent and reject overlapping periods.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_budget_period()
returns trigger
language plpgsql
as $$
begin
  if new.period_type = 'custom' then
    if new.start_date is null then
      raise exception 'A custom budget needs a start date'
        using errcode = 'not_null_violation';
    end if;
    if new.end_date is null then
      -- Default: one month, ending the day before the same date next month.
      new.end_date := (new.start_date + interval '1 month' - interval '1 day')::date;
    end if;
    new.period_month := date_trunc('month', new.start_date)::date;
  else
    -- Calendar budgets (and inserts from older code that only set
    -- period_month) always cover the whole month.
    new.period_type := 'calendar';
    new.period_month := date_trunc('month', coalesce(new.period_month, new.start_date))::date;
    new.start_date := new.period_month;
    new.end_date := (new.period_month + interval '1 month' - interval '1 day')::date;
  end if;

  if exists (
    select 1
    from public.budgets b
    where b.user_id = new.user_id
      and b.id <> new.id
      and b.start_date <= new.end_date
      and b.end_date >= new.start_date
  ) then
    raise exception 'Budget period % to % overlaps another budget',
      new.start_date, new.end_date
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_normalize_period on public.budgets;
create trigger budgets_normalize_period
  before insert or update on public.budgets
  for each row execute function public.normalize_budget_period();

-- ---------------------------------------------------------------------------
-- Budget vs actual, counting spending between the budget's own dates.
-- The signature and columns are unchanged (so 0010 stays re-runnable); the
-- app reads the period dates from the budgets row itself.
-- ---------------------------------------------------------------------------
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
  with target as (
    select b.*
    from public.budgets b
    where b.period_month = date_trunc('month', p_period_month)::date
  ),
  spending as (
    select
      t.category_id,
      sum(t.amount) as spent
    from public.transactions t
    join target b on t.occurred_on between b.start_date and b.end_date
    where t.type = 'expense'
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
  from target b
  join public.budget_items bi on bi.budget_id = b.id
  join public.categories c    on c.id = bi.category_id
  left join spending s        on s.category_id = bi.category_id
  order by c.name;
$$;

comment on function public.get_budget_status is
  'Budget vs actual spending per category between the budget''s start and end dates. Expenses only; transfers excluded.';

-- ---------------------------------------------------------------------------
-- Copy a budget into another month, carrying its period style.
--
-- A custom period moves by the same number of months (25 Sep – 24 Oct copied
-- one month on becomes 25 Oct – 24 Nov); a calendar budget covers the target
-- month. Still idempotent: returns the existing budget if the target month
-- already has one.
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
  v_from       date := date_trunc('month', p_from_month)::date;
  v_to         date := date_trunc('month', p_to_month)::date;
  v_shift      interval;
  v_source     public.budgets%rowtype;
  v_new_budget uuid;
  v_existing   uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select id into v_existing
  from public.budgets
  where user_id = v_user_id
    and period_month = v_to;

  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_source
  from public.budgets
  where user_id = v_user_id
    and period_month = v_from;

  if not found then
    raise exception 'No budget found for %', p_from_month
      using errcode = 'no_data_found';
  end if;

  v_shift := make_interval(
    months => ((extract(year from v_to) - extract(year from v_from)) * 12
              + (extract(month from v_to) - extract(month from v_from)))::int
  );

  if v_source.period_type = 'custom' then
    insert into public.budgets (user_id, period_month, name, period_type, start_date, end_date)
    values (
      v_user_id,
      v_to,
      v_source.name,
      'custom',
      (v_source.start_date + v_shift)::date,
      (v_source.end_date + v_shift)::date
    )
    returning id into v_new_budget;
  else
    insert into public.budgets (user_id, period_month, name, period_type)
    values (v_user_id, v_to, v_source.name, 'calendar')
    returning id into v_new_budget;
  end if;

  insert into public.budget_items (budget_id, user_id, category_id, amount)
  select v_new_budget, v_user_id, bi.category_id, bi.amount
  from public.budget_items bi
  where bi.budget_id = v_source.id;

  return v_new_budget;
end;
$$;

comment on function public.copy_budget is
  'Copies a budget to another month, shifting custom periods by the same number of months. Idempotent; returns the target budget id.';
