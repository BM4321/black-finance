-- ============================================================================
-- 0003_new_user_bootstrap.sql
--
-- When a user signs up we must create their profile and seed their default
-- categories. Doing this in the database (rather than in the signup Server
-- Action) guarantees it happens for *every* signup path -- email/password,
-- OAuth, invite, admin-created -- not just the one flow we wrote today.
--
-- The function is SECURITY DEFINER because the trigger runs as the
-- auth-admin, and needs to insert into public tables as that owner.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, kind, icon)
  select
    new.id,
    defaults.name,
    defaults.kind::public.category_kind,
    defaults.icon
  from (values
    -- Expense categories
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
    -- Income categories
    ('Salary',        'income',  'briefcase'),
    ('Freelance',     'income',  'laptop'),
    ('Business',      'income',  'store'),
    ('Gift',          'income',  'gift'),
    ('Investment',    'income',  'trending-up'),
    ('Other',         'income',  'ellipsis')
  ) as defaults (name, kind, icon)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
