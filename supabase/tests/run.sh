#!/usr/bin/env bash
#
# Applies all migrations to a throwaway local Postgres database and runs the
# RLS / integrity test suite against it.
#
# Requires a locally running Postgres and the `psql`/`createdb`/`dropdb` tools.
# Usage:  ./supabase/tests/run.sh
#
# This never touches your Supabase project. It exists so schema changes can be
# verified fast and offline before being applied to a real database.
set -euo pipefail

DB_NAME="${DB_NAME:-finance_schema_test}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! pg_isready -q; then
  echo "Postgres is not running. Start it first (e.g. brew services start postgresql@16)." >&2
  exit 1
fi

echo "Recreating '$DB_NAME'..."
dropdb --if-exists "$DB_NAME"
createdb "$DB_NAME"

echo "Applying Supabase stub..."
psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCRIPT_DIR/00_supabase_stub.sql" > /dev/null

echo "Applying migrations..."
for migration in "$SUPABASE_DIR"/migrations/*.sql; do
  echo "  - $(basename "$migration")"
  psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$migration" > /dev/null
done

echo "Running RLS / integrity tests..."
psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$SCRIPT_DIR/10_rls_test.sql"

echo "Dropping '$DB_NAME'..."
dropdb "$DB_NAME"
