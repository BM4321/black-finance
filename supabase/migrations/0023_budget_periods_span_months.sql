-- ============================================================================
-- 0023_budget_periods_span_months.sql
--
-- Let a custom budget period start in the previous month.
--
-- 0022 required a custom period to start in the month that keys the budget,
-- so the October budget could not run 24 Sep – 25 Oct. Now a period only has
-- to include at least one day of its month: the October budget may start on
-- 24 September, the September budget may run 24 Aug – 23 Sep.
--
-- The key (period_month) is kept as given instead of being derived from the
-- start date, so a budget stays where the user filed it. Inserts that give
-- no key still take the start date's month. Overlaps remain rejected, so no
-- expense is ever counted by two budgets.
-- ============================================================================

alter table public.budgets drop constraint if exists budgets_period_range_check;
alter table public.budgets add constraint budgets_period_range_check
  check (
    end_date >= start_date
    and end_date - start_date <= 62
    and start_date <= (period_month + interval '1 month' - interval '1 day')::date
    and end_date >= period_month
  );

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
    -- Keep the month the budget was filed under; without one, use the month
    -- the period starts in.
    new.period_month := date_trunc('month', coalesce(new.period_month, new.start_date))::date;
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
