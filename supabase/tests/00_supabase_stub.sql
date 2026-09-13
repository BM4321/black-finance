-- Local test harness: emulates the Supabase-provided objects the migration
-- depends on (auth schema, roles, auth.uid()). NOT part of the real migration.

create schema if not exists auth;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase's auth.uid() reads the JWT claim. For tests we emulate it with a
-- session setting so we can switch "current user" and validate RLS.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Supabase grants table privileges to these roles by default, relying on RLS
-- (not missing GRANTs) to restrict access. Emulate that here so the tests
-- exercise RLS rather than failing on privileges.
grant usage on schema public to anon, authenticated;
-- Real Supabase grants the API roles usage on the auth schema so that
-- auth.uid() is callable from RLS policies and SECURITY INVOKER functions.
grant usage on schema auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- Future tables created by the migration runner should also be granted.
alter default privileges in schema public
  grant all on tables to anon, authenticated;
alter default privileges in schema public
  grant all on sequences to anon, authenticated;
