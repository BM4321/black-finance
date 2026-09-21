/**
 * Transaction search-term handling.
 *
 * The list query searches through PostgREST (`ilike."*term*"` in an `or`
 * filter) and the totals RPC searches in SQL (`ilike '%' || term || '%'`).
 * These are two different parsers, so the same input can mean different things
 * unless it is normalised in one place first — and if they diverge, the totals
 * header silently disagrees with the table below it.
 *
 * PostgREST's actual semantics (verified against its `SqlFragment` and test
 * suite):
 *   - `*` in an `ilike` value is an alias for `%` (a wildcard).
 *   - `%` and `_` are passed through to Postgres, so they are wildcards too.
 *   - `\`, `"` and `,`/`(`/`)` are structural and must be handled carefully.
 *
 * Rather than duplicate that grammar, the term is sanitised identically on
 * both sides by:
 *   - stripping `"` and `\` (which would otherwise be parsed as syntax),
 *   - capping the length,
 *   - treating `*` as a wildcard (`normalize_search_term` does too).
 *
 * `%` and `_` are deliberately left as wildcards on both sides, matching native
 * Postgres `LIKE` behaviour, so the two queries always agree.
 */

const MAX_TERM_LENGTH = 100;

/** Trim, strip structural characters, and cap a raw search term. */
export function normalizeSearchTerm(term: string | undefined): string | null {
  if (!term) return null;
  const cleaned = term.trim().replace(/["\\]/g, "").slice(0, MAX_TERM_LENGTH);
  return cleaned === "" ? null : cleaned;
}

/**
 * Build the PostgREST `ilike` pattern for a search term.
 *
 * The value is wrapped in double quotes so commas, parentheses and dots inside
 * it are not parsed as `or`-filter syntax. `*` is left for PostgREST to expand
 * to `%`, which is why the value must not be pre-escaped.
 */
export function postgrestSearchPattern(term: string): string {
  return `"*${term}*"`;
}
