-- ============================================================================
-- 0002_rls_policies.sql
--
-- Row Level Security for every table. This is the real authorization boundary:
-- the frontend, proxy and even a compromised anon key can only ever touch rows
-- owned by the authenticated user.
--
-- The composite foreign keys in 0001 already make *cross-user references*
-- impossible. RLS makes *cross-user reads/writes* impossible. Together they
-- cover both directions.
--
-- Note: enabling RLS with no policy denies everything by default. Every table
-- therefore gets explicit policies below.
-- ============================================================================

alter table public.profiles     enable row level security;
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   Users may read/update their own profile. Inserts happen via trigger, and
--   deletes cascade from auth.users, so no insert/delete policy is needed.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own"
  on public.accounts for select
  using (user_id = auth.uid());

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own"
  on public.accounts for insert
  with check (user_id = auth.uid());

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
  on public.accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own"
  on public.accounts for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
  on public.categories for select
  using (user_id = auth.uid());

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories for insert
  with check (user_id = auth.uid());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (user_id = auth.uid());

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (user_id = auth.uid());

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (user_id = auth.uid());
