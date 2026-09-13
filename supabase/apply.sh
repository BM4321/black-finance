#!/usr/bin/env bash
#
# Applies every migration to a Supabase database in one shot.
#
# Usage:
#   DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
#     ./supabase/apply.sh
#
# Find the connection string in: Supabase dashboard -> Project Settings ->
# Database -> Connection string -> URI (the "Direct connection" one).
#
# Alternatively, skip this script and paste supabase/apply_all.sql into the
# dashboard's SQL Editor.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  echo "Example: DATABASE_URL='postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres' $0" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="$ROOT/supabase/apply_all.sql"

echo "Applying migrations to the target database..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$FILE"

echo
echo "Done. Verifying tables..."
psql "$DATABASE_URL" -tAc \
  "select tablename from pg_tables where schemaname='public' order by tablename;"
psql "$DATABASE_URL" -tAc \
  "select viewname from pg_views where schemaname='public' order by viewname;"
