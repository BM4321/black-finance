-- ============================================================================
-- 0013_search_consistency.sql
--
-- Makes the transaction list and its totals agree on search semantics.
--
-- The list searches through PostgREST with `description.ilike."*term*"`, and
-- `get_transaction_totals` searches in SQL with `ilike '%' || term || '%'`.
-- They are different parsers, and they disagreed on one important character:
--
--   * PostgREST maps `*` to `%` inside an `ilike` value (its wildcard alias),
--     so the list treated `*` as "match anything".
--   * The SQL function passed `*` straight to Postgres, where it is a literal.
--
-- So a search containing `*` matched different rows in the table and in the
-- totals header. `%` and `_` were already wildcards on both sides, and the
-- client already strips `"` and `\`, so those are handled below to stay in
-- lockstep with src/lib/data/search.ts.
--
-- `normalize_search_term` is the single SQL-side definition of that contract.
-- ============================================================================

create or replace function public.normalize_search_term(p_term text)
returns text
language sql
immutable
as $$
  select
    case
      when p_term is null or trim(p_term) = '' then null
      else
        -- Mirrors normalizeSearchTerm() + postgrestSearchPattern() in
        -- src/lib/data/search.ts: strip quotes/backslashes (structural in
        -- PostgREST's filter grammar), cap the length, and map `*` to `%`
        -- (PostgREST's ilike wildcard alias).
        replace(
          left(replace(replace(trim(p_term), '"', ''), '\', ''), 100),
          '*', '%'
        )
    end;
$$;

comment on function public.normalize_search_term is
  'Normalises a transaction search term to match the PostgREST list filter. Strips quotes/backslashes, caps length, maps * to %.';

-- ---------------------------------------------------------------------------
-- Re-create the totals function so its search predicate uses the shared
-- normaliser and therefore matches the list query exactly.
-- ---------------------------------------------------------------------------
create or replace function public.get_transaction_totals(
  p_search      text  default null,
  p_type        public.transaction_type default null,
  p_account_id  uuid  default null,
  p_category_id uuid  default null,
  p_date_from   date  default null,
  p_date_to     date  default null,
  p_amount_min  numeric default null,
  p_amount_max  numeric default null
)
returns table (
  income_total   numeric,
  expense_total  numeric,
  transfer_total numeric
)
language sql
stable
as $$
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)   as income_total,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)  as expense_total,
    coalesce(sum(t.amount) filter (where t.type = 'transfer'), 0) as transfer_total
  from public.transactions t
  where
    (p_search      is null
                   or public.normalize_search_term(p_search) is null
                   or t.description ilike '%' || public.normalize_search_term(p_search) || '%'
                   or t.payee       ilike '%' || public.normalize_search_term(p_search) || '%')
    and (p_type        is null or t.type = p_type)
    and (p_account_id  is null or t.account_id = p_account_id
                               or t.transfer_account_id = p_account_id)
    and (p_category_id is null or t.category_id = p_category_id)
    and (p_date_from   is null or t.occurred_on >= p_date_from)
    and (p_date_to     is null or t.occurred_on <= p_date_to)
    and (p_amount_min  is null or t.amount >= p_amount_min)
    and (p_amount_max  is null or t.amount <= p_amount_max);
$$;

comment on function public.get_transaction_totals is
  'DB-side income/expense/transfer totals for a filtered transaction set. Search uses normalize_search_term so it matches the list query.';
