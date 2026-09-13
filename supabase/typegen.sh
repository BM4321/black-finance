#!/usr/bin/env bash
#
# Regenerates src/types/database.ts from the real schema by applying every
# migration to a throwaway Postgres container and asking Supabase's
# postgres-meta image to emit TypeScript types.
#
# Why not `supabase gen types --linked`: that needs a linked project and
# credentials. This keeps type generation reproducible and offline.
#
# Requires: Docker running.
# Usage:  ./supabase/typegen.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK="finance-typegen"
DB_CONTAINER="finance-typegen-db"
META_CONTAINER="finance-typegen-meta"
META_PORT="8899"

cleanup() {
  docker rm -f "$META_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop first." >&2
  exit 1
fi

echo "Starting disposable Postgres + postgres-meta..."
docker network create "$NETWORK" >/dev/null 2>&1 || true
docker run -d --name "$DB_CONTAINER" --network "$NETWORK" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres \
  postgres:16-alpine >/dev/null

# Wait for Postgres to accept connections.
for _ in $(seq 1 30); do
  docker exec "$DB_CONTAINER" pg_isready -U postgres -q && break
  sleep 1
done

echo "Applying Supabase stub and migrations..."
docker exec -i "$DB_CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 \
  < "$ROOT/supabase/tests/00_supabase_stub.sql" >/dev/null
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "  - $(basename "$migration")"
  docker exec -i "$DB_CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 \
    < "$migration" >/dev/null
done

echo "Starting postgres-meta..."
docker run -d --name "$META_CONTAINER" --network "$NETWORK" \
  -p "$META_PORT:8080" \
  -e PG_META_DB_HOST="$DB_CONTAINER" \
  -e PG_META_DB_PORT=5432 \
  -e PG_META_DB_NAME=postgres \
  -e PG_META_DB_USER=postgres \
  -e PG_META_DB_PASSWORD=postgres \
  -e PG_META_DB_SSL_MODE=disable \
  public.ecr.aws/supabase/postgres-meta:v0.99.0 >/dev/null

# Wait for the HTTP API to become ready.
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:$META_PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "Generating types..."
curl -sf "http://localhost:$META_PORT/generators/typescript?included_schemas=public" \
  -o "$ROOT/src/types/database.ts"

echo "Wrote $(wc -l < "$ROOT/src/types/database.ts") lines to src/types/database.ts"
