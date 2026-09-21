-- ============================================================================
-- 0012_goal_rls.sql
--
-- Row Level Security for goals and goal_contributions. Same ownership rule as
-- every other table: user_id = auth.uid(). Without policies, RLS defaults to
-- denying everything, so these are required.
-- ============================================================================

alter table public.goals               enable row level security;
alter table public.goal_contributions  enable row level security;

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own"
  on public.goals for select
  using (user_id = auth.uid());

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own"
  on public.goals for insert
  with check (user_id = auth.uid());

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own"
  on public.goals for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own"
  on public.goals for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- goal_contributions
-- ---------------------------------------------------------------------------
drop policy if exists "goal_contributions_select_own" on public.goal_contributions;
create policy "goal_contributions_select_own"
  on public.goal_contributions for select
  using (user_id = auth.uid());

drop policy if exists "goal_contributions_insert_own" on public.goal_contributions;
create policy "goal_contributions_insert_own"
  on public.goal_contributions for insert
  with check (user_id = auth.uid());

drop policy if exists "goal_contributions_update_own" on public.goal_contributions;
create policy "goal_contributions_update_own"
  on public.goal_contributions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "goal_contributions_delete_own" on public.goal_contributions;
create policy "goal_contributions_delete_own"
  on public.goal_contributions for delete
  using (user_id = auth.uid());
