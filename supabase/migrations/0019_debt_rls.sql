-- ============================================================================
-- 0019_debt_rls.sql
--
-- Row Level Security for debts. Same ownership rule as every other table
-- (`user_id = auth.uid()`). Without policies, RLS denies everything.
-- ============================================================================

alter table public.debts enable row level security;

drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own"
  on public.debts for select
  using (user_id = auth.uid());

drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own"
  on public.debts for insert
  with check (user_id = auth.uid());

drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own"
  on public.debts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own"
  on public.debts for delete
  using (user_id = auth.uid());
