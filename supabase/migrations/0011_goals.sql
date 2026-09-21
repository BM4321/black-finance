-- ============================================================================
-- 0011_goals.sql
--
-- Savings goals and the contributions made toward them.
--
-- Model:
--   goals               one row per goal ("Driving lessons")
--   goal_contributions  a ledger of money put toward a goal
--
-- IMPORTANT: progress is DERIVED from goal_contributions, exactly as account
-- balances are derived from transactions. There is no `current_amount` column,
-- so a goal's progress can never drift from the contributions that produced it.
--
-- A contribution is its own record, not a transaction. Putting money toward a
-- goal is not spending and is not a transfer between accounts, so keeping it
-- out of `transactions` means a contribution can never inflate expenses or be
-- miscounted as a transfer.
--
-- Ownership uses the composite-foreign-key pattern: goal_contributions carries
-- user_id and references goals(id, user_id), so a contribution can never attach
-- to another user's goal even if a query forgets to filter by user_id.
--
-- The model is deliberately contribution-oriented rather than a single stored
-- "current amount": future automation (recurring contributions, linking a
-- contribution to a transfer) can append to the ledger without a schema change.
-- ============================================================================

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 80),
  target_amount numeric(19, 4) not null check (target_amount > 0),
  -- Optional deadline. A DATE, not a timestamp, for the same timezone-safety
  -- reason transactions use `occurred_on`.
  target_date   date,
  notes         text,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (id, user_id)
);

create index if not exists goals_user_id_idx on public.goals (user_id);

-- A user cannot have two *active* goals with the same name. Archived goals are
-- exempt so a name can be reused after archiving.
create unique index if not exists goals_user_name_active_idx
  on public.goals (user_id, name)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- goal_contributions
--
-- Amounts are always positive, mirroring transactions: direction lives in the
-- sign of the derived sum, not in the stored value.
-- ---------------------------------------------------------------------------
create table if not exists public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  amount         numeric(19, 4) not null check (amount > 0),
  contributed_on date not null default current_date,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint goal_contributions_goal_fk
    foreign key (goal_id, user_id)
    references public.goals (id, user_id)
    on delete cascade
);

create index if not exists goal_contributions_goal_idx
  on public.goal_contributions (goal_id);
create index if not exists goal_contributions_user_idx
  on public.goal_contributions (user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

drop trigger if exists goal_contributions_set_updated_at on public.goal_contributions;
create trigger goal_contributions_set_updated_at
  before update on public.goal_contributions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goal_progress view
--
-- Derives each goal's current amount, remaining and completion percentage from
-- its contributions.
--
-- `security_invoker = true` is essential: without it the view would run as its
-- owner and bypass RLS, exposing every user's goals. With it, the caller's RLS
-- policies on goals/goal_contributions apply.
--
-- `target_amount > 0` is enforced by a CHECK, so the division cannot hit zero.
-- ---------------------------------------------------------------------------
create or replace view public.goal_progress
with (security_invoker = true)
as
select
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.target_date,
  g.notes,
  g.is_archived,
  g.created_at,
  g.updated_at,
  coalesce(sum(c.amount), 0)                             as current_amount,
  g.target_amount - coalesce(sum(c.amount), 0)           as remaining,
  round((coalesce(sum(c.amount), 0) / g.target_amount) * 100, 1) as percent_complete
from public.goals g
left join public.goal_contributions c on c.goal_id = g.id
group by g.id;

comment on view public.goal_progress is
  'Derived goal progress (current/remaining/percent) from contributions. security_invoker=true so RLS applies.';
