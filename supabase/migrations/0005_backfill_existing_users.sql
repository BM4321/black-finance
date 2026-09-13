-- ============================================================================
-- 0005_backfill_existing_users.sql
--
-- The `on_auth_user_created` trigger from 0003 only runs for *new* signups.
-- Users who registered before the schema existed (or before the trigger was
-- applied) have no profile and no categories. This backfills them.
--
-- Idempotent: safe to run multiple times. `on conflict do nothing` means users
-- who already have a profile or categories are left untouched.
-- ============================================================================

-- Profiles for any auth user missing one.
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Default categories for any user missing them entirely.
-- Users who already have some categories are skipped so we never seed a
-- partial set on top of their custom ones.
insert into public.categories (user_id, name, kind, icon)
select
  u.id,
  defaults.name,
  defaults.kind::public.category_kind,
  defaults.icon
from auth.users u
cross join (values
  ('Food',          'expense', 'utensils'),
  ('Transport',     'expense', 'bus'),
  ('Education',     'expense', 'book'),
  ('Housing',       'expense', 'home'),
  ('Utilities',     'expense', 'bolt'),
  ('Communication', 'expense', 'phone'),
  ('Health',        'expense', 'heart'),
  ('Personal',      'expense', 'user'),
  ('Entertainment', 'expense', 'film'),
  ('Shopping',      'expense', 'bag'),
  ('Giving',        'expense', 'gift'),
  ('Debt',          'expense', 'receipt'),
  ('Other',         'expense', 'ellipsis'),
  ('Salary',        'income',  'briefcase'),
  ('Freelance',     'income',  'laptop'),
  ('Business',      'income',  'store'),
  ('Gift',          'income',  'gift'),
  ('Investment',    'income',  'trending-up'),
  ('Other',         'income',  'ellipsis')
) as defaults (name, kind, icon)
where not exists (
  select 1 from public.categories c where c.user_id = u.id
);
