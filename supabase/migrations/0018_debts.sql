-- ============================================================================
-- 0018_debts.sql
--
-- Debt tracking (MVP): money owed by me, and money owed to me.
--
-- Model decision: a debt is ONE row holding the original `principal` and a
-- manually-maintained `remaining_amount`. This matches the MVP fields
-- (person/entity, amount, date, due date, status, notes) and keeps updates to a
-- single field. A payments ledger with a derived balance is a future upgrade
-- and would be additive, not a rewrite.
--
-- STATUS IS DERIVED, never stored. Storing both a status and a remaining amount
-- would create two sources of truth that can disagree (status 'open' with 0
-- remaining). Instead the view derives it, exactly as goal progress is derived
-- from contributions:
--
--   written_off  -> is_written_off = true
--   settled      -> remaining_amount <= 0
--   open         -> otherwise
--
-- IMPORTANT: a debt is not a transaction and not an expense. Lending or
-- borrowing money is not consumption; debts live in their own table and are
-- never counted in expense totals. Open debts DO affect net worth:
-- money owed to me is an asset (+), money I owe is a liability (-).
--
-- Ownership is direct (user_id) with RLS, like every other table.
-- ============================================================================

create table if not exists public.debts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  direction        text not null
                     check (direction in ('owed_by_me', 'owed_to_me')),
  counterparty     text not null check (length(trim(counterparty)) between 1 and 120),
  -- Original amount. Always positive; direction carries the sign.
  principal        numeric(19, 4) not null check (principal > 0),
  -- Outstanding amount, updated by the user as they pay or are paid.
  remaining_amount numeric(19, 4) not null check (remaining_amount >= 0),
  started_on       date not null default current_date,
  due_date         date,
  is_written_off   boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (id, user_id)
);

create index if not exists debts_user_id_idx on public.debts (user_id);
create index if not exists debts_user_direction_idx
  on public.debts (user_id, direction);

drop trigger if exists debts_set_updated_at on public.debts;
create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- debt_details view
--
-- Adds the derived `status` and `settled_amount` (how much has been repaid or
-- collected). `security_invoker = true` so the caller's RLS policies apply.
-- ---------------------------------------------------------------------------
create or replace view public.debt_details
with (security_invoker = true)
as
select
  d.id,
  d.user_id,
  d.direction,
  d.counterparty,
  d.principal,
  d.remaining_amount,
  d.started_on,
  d.due_date,
  d.is_written_off,
  d.notes,
  d.created_at,
  d.updated_at,
  round(d.principal - d.remaining_amount, 4) as settled_amount,
  case
    when d.is_written_off then 'written_off'
    when d.remaining_amount <= 0 then 'settled'
    else 'open'
  end as status
from public.debts d;

comment on view public.debt_details is
  'Debts with derived status and settled amount. security_invoker=true so RLS applies.';
