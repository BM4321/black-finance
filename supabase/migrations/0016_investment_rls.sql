-- ============================================================================
-- 0016_investment_rls.sql
--
-- Row Level Security for investments. Same ownership rule as every other table
-- (`user_id = auth.uid()`). Without policies, RLS denies everything.
-- ============================================================================

alter table public.investments enable row level security;

drop policy if exists "investments_select_own" on public.investments;
create policy "investments_select_own"
  on public.investments for select
  using (user_id = auth.uid());

drop policy if exists "investments_insert_own" on public.investments;
create policy "investments_insert_own"
  on public.investments for insert
  with check (user_id = auth.uid());

drop policy if exists "investments_update_own" on public.investments;
create policy "investments_update_own"
  on public.investments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "investments_delete_own" on public.investments;
create policy "investments_delete_own"
  on public.investments for delete
  using (user_id = auth.uid());
