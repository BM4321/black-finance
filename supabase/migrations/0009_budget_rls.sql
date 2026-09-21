-- ============================================================================
-- 0009_budget_rls.sql
--
-- Row Level Security for budgets and budget_items. Same ownership rule as every
-- other table: user_id = auth.uid(). Without policies, RLS defaults to denying
-- everything, so these are required.
-- ============================================================================

alter table public.budgets      enable row level security;
alter table public.budget_items enable row level security;

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets for select
  using (user_id = auth.uid());

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own"
  on public.budgets for insert
  with check (user_id = auth.uid());

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own"
  on public.budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own"
  on public.budgets for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- budget_items
-- ---------------------------------------------------------------------------
drop policy if exists "budget_items_select_own" on public.budget_items;
create policy "budget_items_select_own"
  on public.budget_items for select
  using (user_id = auth.uid());

drop policy if exists "budget_items_insert_own" on public.budget_items;
create policy "budget_items_insert_own"
  on public.budget_items for insert
  with check (user_id = auth.uid());

drop policy if exists "budget_items_update_own" on public.budget_items;
create policy "budget_items_update_own"
  on public.budget_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "budget_items_delete_own" on public.budget_items;
create policy "budget_items_delete_own"
  on public.budget_items for delete
  using (user_id = auth.uid());
