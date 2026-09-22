-- ============================================================================
-- RLS / integrity test suite.
--
-- Run with:
--   psql -d finance_schema_test -v ON_ERROR_STOP=1 -f supabase/tests/10_rls_test.sql
--
-- Uses SET LOCAL ROLE authenticated + request.jwt.claim.sub to emulate two
-- different logged-in users. Any RAISE EXCEPTION fails the run (ON_ERROR_STOP).
-- ============================================================================

\set ON_ERROR_STOP on

-- Deterministic test data -----------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com')
on conflict (id) do nothing;

-- Trigger should have created profiles and seeded categories.
do $$
declare
  alice_categories int;
  alice_profile    int;
begin
  select count(*) into alice_profile
  from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
  if alice_profile <> 1 then
    raise exception 'FAIL: profile not auto-created (got %)', alice_profile;
  end if;

  select count(*) into alice_categories
  from public.categories where user_id = '00000000-0000-0000-0000-00000000000a';
  if alice_categories <> 19 then
    raise exception 'FAIL: expected 19 seeded categories, got %', alice_categories;
  end if;
end $$;

-- Seed accounts directly as superuser (bypasses RLS for setup) ---------------
insert into public.accounts (id, user_id, name, type) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Alice Cash', 'cash'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Bob Cash',   'cash');

-- ---------------------------------------------------------------------------
-- Helper: run a block as a given authenticated user.
-- ---------------------------------------------------------------------------
create or replace function public.test_as_user(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
end $$;

-- ===========================================================================
-- 1. Alice can see only her own accounts.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare visible int;
  begin
    select count(*) into visible from public.accounts;
    if visible <> 1 then
      raise exception 'FAIL: Alice sees % accounts, expected 1', visible;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 2. Alice cannot insert an account owned by Bob (RLS WITH CHECK).
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  begin
    insert into public.accounts (user_id, name)
    values ('00000000-0000-0000-0000-00000000000b', 'Sneaky');
    raise exception 'FAIL: Alice was allowed to insert an account for Bob';
  exception
    when insufficient_privilege then null; -- expected: RLS rejected it
  end $$;
rollback;

-- ===========================================================================
-- 3. Alice cannot insert a transaction referencing Bob's account, even though
--    she sets user_id = herself. This is the composite-FK guarantee.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare alice_cat uuid;
  begin
    select id into alice_cat
    from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense'
    limit 1;

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values (
      '00000000-0000-0000-0000-00000000000a',
      'expense', 10,
      '10000000-0000-0000-0000-00000000000b', -- Bob's account
      alice_cat
    );
    raise exception 'FAIL: cross-user account reference was allowed';
  exception
    when foreign_key_violation then null; -- expected
  end $$;
rollback;

-- ===========================================================================
-- 4. Transaction shape constraints.
--    income requires a category; transfer forbids one and needs a destination.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    alice_cat  uuid;
    alice_acct uuid := '10000000-0000-0000-0000-00000000000a';
    alice_acct2 uuid;
  begin
    select id into alice_cat
    from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense'
    limit 1;

    -- A second account for transfer destination.
    insert into public.accounts (user_id, name, type)
    values ('00000000-0000-0000-0000-00000000000a', 'Alice Savings', 'savings')
    returning id into alice_acct2;

    -- income without category -> rejected
    begin
      insert into public.transactions (user_id, type, amount, account_id)
      values ('00000000-0000-0000-0000-00000000000a', 'income', 50, alice_acct);
      raise exception 'FAIL: income without category allowed';
    exception when check_violation then null; end;

    -- transfer with a category -> rejected
    begin
      insert into public.transactions
        (user_id, type, amount, account_id, transfer_account_id, category_id)
      values
        ('00000000-0000-0000-0000-00000000000a', 'transfer', 50,
         alice_acct, alice_acct2, alice_cat);
      raise exception 'FAIL: transfer with category allowed';
    exception when check_violation then null; end;

    -- transfer to the same account -> rejected
    begin
      insert into public.transactions
        (user_id, type, amount, account_id, transfer_account_id)
      values
        ('00000000-0000-0000-0000-00000000000a', 'transfer', 50,
         alice_acct, alice_acct);
      raise exception 'FAIL: self-transfer allowed';
    exception when check_violation then null; end;

    -- zero/negative amount -> rejected
    begin
      insert into public.transactions (user_id, type, amount, account_id, category_id)
      values ('00000000-0000-0000-0000-00000000000a', 'expense', 0, alice_acct, alice_cat);
      raise exception 'FAIL: zero amount allowed';
    exception when check_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 5. Expense transaction cannot use an income category (trigger).
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    income_cat uuid;
    acct uuid := '10000000-0000-0000-0000-00000000000a';
  begin
    select id into income_cat
    from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'income'
    limit 1;

    begin
      insert into public.transactions (user_id, type, amount, account_id, category_id)
      values ('00000000-0000-0000-0000-00000000000a', 'expense', 10, acct, income_cat);
      raise exception 'FAIL: expense accepted an income category';
    exception when check_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 6. A valid expense and a valid transfer both succeed, and balances derive.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    expense_cat uuid;
    acct        uuid := '10000000-0000-0000-0000-00000000000a';
    acct2       uuid;
    bal         numeric;
  begin
    select id into expense_cat
    from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense'
    limit 1;

    insert into public.accounts (user_id, name, type)
    values ('00000000-0000-0000-0000-00000000000a', 'Alice Savings', 'savings')
    returning id into acct2;

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'income', 1000, acct, (
      select id from public.categories
      where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'income' limit 1
    ));

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'expense', 250, acct, expense_cat);

    insert into public.transactions
      (user_id, type, amount, account_id, transfer_account_id)
    values
      ('00000000-0000-0000-0000-00000000000a', 'transfer', 300, acct, acct2);

    -- Derived balance for the main account: +1000 income - 250 expense - 300 transfer out
    select a.opening_balance
      + coalesce(sum(case
          when t.type = 'income'   then t.amount
          when t.type = 'expense'  then -t.amount
          when t.type = 'transfer' and t.account_id = a.id          then -t.amount
          when t.type = 'transfer' and t.transfer_account_id = a.id then t.amount
          else 0 end), 0)
    into bal
    from public.accounts a
    left join public.transactions t
      on t.account_id = a.id or t.transfer_account_id = a.id
    where a.id = acct
    group by a.id, a.opening_balance;

    if bal <> 450 then
      raise exception 'FAIL: derived balance expected 450, got %', bal;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 6b. account_balances view must respect RLS (security_invoker).
--     Alice must see exactly one balance row, never Bob's.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare visible int; wrong_user int;
  begin
    select count(*) into visible from public.account_balances;
    if visible <> 1 then
      raise exception 'FAIL: account_balances leaked % rows to Alice (expected 1)', visible;
    end if;

    select count(*) into wrong_user
    from public.account_balances
    where user_id <> '00000000-0000-0000-0000-00000000000a';
    if wrong_user <> 0 then
      raise exception 'FAIL: account_balances exposed another user''s rows';
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 6c. account_balances view computes the correct arithmetic.
--     Opening 100 + income 1000 - expense 250 - transfer out 300 = 550.
--     The destination account: opening 0 + transfer in 300 = 300.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    acct2 uuid;
    cat uuid;
    src_bal numeric;
    dst_bal numeric;
  begin
    select id into cat from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense' limit 1;

    update public.accounts set opening_balance = 100 where id = acct;

    insert into public.accounts (user_id, name, type)
    values ('00000000-0000-0000-0000-00000000000a', 'Alice Savings', 'savings')
    returning id into acct2;

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'income', 1000, acct, (
      select id from public.categories
      where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'income' limit 1
    ));
    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'expense', 250, acct, cat);
    insert into public.transactions
      (user_id, type, amount, account_id, transfer_account_id)
    values ('00000000-0000-0000-0000-00000000000a', 'transfer', 300, acct, acct2);

    select current_balance into src_bal from public.account_balances where account_id = acct;
    select current_balance into dst_bal from public.account_balances where account_id = acct2;

    if src_bal <> 550 then
      raise exception 'FAIL: source balance expected 550, got %', src_bal;
    end if;
    if dst_bal <> 300 then
      raise exception 'FAIL: destination balance expected 300, got %', dst_bal;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 9. transaction_details view: joins names and respects RLS.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    acct2 uuid;
    cat uuid;
    row_count int;
    acct_name text;
    transfer_name text;
    cat_name text;
  begin
    select id into cat from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense' limit 1;

    insert into public.accounts (user_id, name, type)
    values ('00000000-0000-0000-0000-00000000000a', 'A Savings', 'savings')
    returning id into acct2;

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'expense', 25, acct, cat);

    insert into public.transactions
      (user_id, type, amount, account_id, transfer_account_id)
    values ('00000000-0000-0000-0000-00000000000a', 'transfer', 300, acct, acct2);

    select count(*) into row_count from public.transaction_details;
    if row_count <> 2 then
      raise exception 'FAIL: transaction_details returned % rows, expected 2', row_count;
    end if;

    select account_name, category_name into acct_name, cat_name
    from public.transaction_details where type = 'expense';
    if acct_name is null or cat_name is null then
      raise exception 'FAIL: expense row missing joined names';
    end if;

    select transfer_account_name into transfer_name
    from public.transaction_details where type = 'transfer';
    if transfer_name <> 'A Savings' then
      raise exception 'FAIL: transfer destination name wrong (got %)', transfer_name;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 10. transaction_details must not leak another user's rows.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare leaked int;
  begin
    select count(*) into leaked from public.transaction_details
    where user_id <> '00000000-0000-0000-0000-00000000000a';
    if leaked <> 0 then
      raise exception 'FAIL: transaction_details leaked % rows', leaked;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 11. get_transaction_totals: correct sums, and transfers are NOT expenses.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    acct2 uuid;
    expense_cat uuid;
    income_cat uuid;
    inc numeric; exp numeric; trf numeric;
  begin
    select id into expense_cat from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense' limit 1;
    select id into income_cat from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'income' limit 1;

    insert into public.accounts (user_id, name, type)
    values ('00000000-0000-0000-0000-00000000000a', 'A Savings', 'savings')
    returning id into acct2;

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values
      ('00000000-0000-0000-0000-00000000000a', 'income', 1000, acct, income_cat),
      ('00000000-0000-0000-0000-00000000000a', 'expense', 250, acct, expense_cat),
      ('00000000-0000-0000-0000-00000000000a', 'expense', 50, acct, expense_cat);

    insert into public.transactions
      (user_id, type, amount, account_id, transfer_account_id)
    values ('00000000-0000-0000-0000-00000000000a', 'transfer', 300, acct, acct2);

    select income_total, expense_total, transfer_total into inc, exp, trf
    from public.get_transaction_totals();

    if inc <> 1000 then raise exception 'FAIL: income total % (expected 1000)', inc; end if;
    if exp <> 300  then raise exception 'FAIL: expense total % (expected 300)', exp; end if;
    if trf <> 300  then raise exception 'FAIL: transfer total % (expected 300)', trf; end if;

    -- Filtering to expenses must exclude the transfer and the income.
    select income_total, expense_total, transfer_total into inc, exp, trf
    from public.get_transaction_totals(p_type => 'expense');
    if inc <> 0 then raise exception 'FAIL: type filter leaked income'; end if;
    if exp <> 300 then raise exception 'FAIL: filtered expense total % (expected 300)', exp; end if;
    if trf <> 0 then raise exception 'FAIL: type filter leaked transfers into total'; end if;
  end $$;
rollback;

-- ===========================================================================
-- 12. get_transaction_totals respects RLS (cannot see other users' rows).
-- ===========================================================================
begin;
  -- Superuser setup: give Bob a large income that Alice must never see.
  do $$
  declare
    bob_acct uuid := '10000000-0000-0000-0000-00000000000b';
    bob_cat uuid;
  begin
    select id into bob_cat from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'income' limit 1;
    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000b', 'income', 999, bob_acct, bob_cat);
  end $$;

  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare inc numeric;
  begin
    select income_total into inc from public.get_transaction_totals();
    if inc is distinct from 0 then
      raise exception 'FAIL: totals leaked another user''s income (%)', inc;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 13. Dashboard functions: monthly summary excludes transfers from savings.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    acct2 uuid;
    ecat uuid; icat uuid;
    row_income numeric; row_expense numeric; row_savings numeric; row_transfer numeric;
  begin
    select id into ecat from public.categories where user_id=uid and kind='expense' limit 1;
    select id into icat from public.categories where user_id=uid and kind='income' limit 1;

    insert into public.accounts (user_id, name, type)
    values (uid, 'A Savings', 'savings') returning id into acct2;

    insert into public.transactions (user_id,type,amount,account_id,category_id,occurred_on) values
      (uid,'income',2000,acct,icat,current_date),
      (uid,'expense',500,acct,ecat,current_date);
    insert into public.transactions (user_id,type,amount,account_id,transfer_account_id,occurred_on)
    values (uid,'transfer',700,acct,acct2,current_date);

    select income, expense, transfer, savings
      into row_income, row_expense, row_transfer, row_savings
    from public.get_monthly_summary(1);

    if row_income <> 2000 then raise exception 'FAIL: month income % (expected 2000)', row_income; end if;
    if row_expense <> 500 then raise exception 'FAIL: month expense % (expected 500)', row_expense; end if;
    if row_transfer <> 700 then raise exception 'FAIL: month transfer % (expected 700)', row_transfer; end if;
    -- Savings = income - expense = 1500. The 700 transfer must NOT reduce it.
    if row_savings <> 1500 then raise exception 'FAIL: savings % (expected 1500, transfer leaked?)', row_savings; end if;

    if (select coalesce(sum(total),0) from public.get_spending_by_category()) <> 500 then
      raise exception 'FAIL: spending_by_category included non-expenses';
    end if;

    if public.get_net_worth() is null then raise exception 'FAIL: net worth is null'; end if;
  end $$;
rollback;

-- ===========================================================================
-- 14. Dashboard functions must not leak another user's data.
-- ===========================================================================
begin;
  do $$
  declare bob uuid := '00000000-0000-0000-0000-00000000000b';
  begin
    insert into public.transactions (user_id,type,amount,account_id,category_id,occurred_on)
    select bob,'income',999999,'10000000-0000-0000-0000-00000000000b', c.id, current_date
    from public.categories c where c.user_id=bob and c.kind='income' limit 1;
  end $$;

  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare inc numeric;
  begin
    select coalesce(sum(income),0) into inc from public.get_monthly_summary(1);
    if inc <> 0 then raise exception 'FAIL: monthly summary leaked income (%)', inc; end if;
    if exists (select 1 from public.get_spending_by_category() where total > 0) then
      raise exception 'FAIL: spending leaked another user';
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 15. Budgets: RLS, expense-only trigger, status math, transfer exclusion.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    acct2 uuid;
    ecat uuid; icat uuid;
    bid uuid;
    item_budgeted numeric; item_spent numeric; item_remaining numeric; item_pct numeric;
  begin
    select id into ecat from public.categories where user_id=uid and kind='expense' limit 1;
    select id into icat from public.categories where user_id=uid and kind='income' limit 1;
    insert into public.accounts (user_id, name, type)
      values (uid, 'A Savings', 'savings') returning id into acct2;

    insert into public.budgets (user_id, period_month)
      values (uid, date_trunc('month', current_date)::date) returning id into bid;

    insert into public.budget_items (budget_id, user_id, category_id, amount)
      values (bid, uid, ecat, 1000);

    -- Spending: an expense of 250 and a transfer of 700 (must not count).
    insert into public.transactions (user_id,type,amount,account_id,category_id,occurred_on)
      values (uid,'expense',250,acct,ecat,current_date);
    insert into public.transactions (user_id,type,amount,account_id,transfer_account_id,occurred_on)
      values (uid,'transfer',700,acct,acct2,current_date);

    select budgeted, spent, remaining, percent_used
      into item_budgeted, item_spent, item_remaining, item_pct
    from public.get_budget_status(date_trunc('month', current_date)::date)
    where category_id = ecat;

    if item_budgeted <> 1000 then raise exception 'FAIL: budgeted % (expected 1000)', item_budgeted; end if;
    if item_spent <> 250 then raise exception 'FAIL: spent % (expected 250, transfer leaked?)', item_spent; end if;
    if item_remaining <> 750 then raise exception 'FAIL: remaining % (expected 750)', item_remaining; end if;
    if item_pct <> 25 then raise exception 'FAIL: percent % (expected 25)', item_pct; end if;

    -- A budget item on an income category must be rejected.
    begin
      insert into public.budget_items (budget_id, user_id, category_id, amount)
        values (bid, uid, icat, 500);
      raise exception 'FAIL: budget item accepted an income category';
    exception when check_violation then null; end;

    -- A second budget for the same month is rejected.
    begin
      insert into public.budgets (user_id, period_month)
        values (uid, date_trunc('month', current_date)::date);
      raise exception 'FAIL: duplicate monthly budget allowed';
    exception when unique_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 16. Budgets must not leak across users, and copy_budget is idempotent.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    bid uuid; item uuid; visible int;
    copy1 uuid; copy2 uuid;
  begin
    select id into item from public.categories where user_id=uid and kind='expense' limit 1;
    insert into public.budgets (user_id, period_month)
      values (uid, date_trunc('month', current_date)::date) returning id into bid;
    insert into public.budget_items (budget_id, user_id, category_id, amount)
      values (bid, uid, item, 300);

    -- Must not see Bob's budget items (Bob has none in this rolled-back test).
    select count(*) into visible from public.budget_items
      where user_id <> uid;
    if visible <> 0 then raise exception 'FAIL: budget_items leaked % rows', visible; end if;

    -- copy_budget into next month, twice; second call returns the same id.
    copy1 := public.copy_budget(
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month')::date
    );
    copy2 := public.copy_budget(
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month')::date
    );
    if copy1 <> copy2 then raise exception 'FAIL: copy_budget not idempotent'; end if;
    if (select count(*) from public.budget_items where budget_id = copy1) <> 1 then
      raise exception 'FAIL: copied budget missing items';
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 17. Goals: progress derives from contributions, RLS isolates users, and a
--     contribution cannot reference another user's goal.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    gid uuid;
    cur numeric; rem numeric; pct numeric;
    visible int;
  begin
    insert into public.goals (user_id, name, target_amount, target_date)
      values (uid, 'Driving lessons', 300000, current_date + 90)
      returning id into gid;

    insert into public.goal_contributions (goal_id, user_id, amount)
      values (gid, uid, 70000), (gid, uid, 50000);

    select current_amount, remaining, percent_complete
      into cur, rem, pct
    from public.goal_progress where id = gid;

    if cur <> 120000 then raise exception 'FAIL: goal current % (expected 120000)', cur; end if;
    if rem <> 180000 then raise exception 'FAIL: goal remaining % (expected 180000)', rem; end if;
    if pct <> 40 then raise exception 'FAIL: goal percent % (expected 40)', pct; end if;

    -- Goals and contributions must not leak across users.
    select count(*) into visible from public.goal_progress where user_id <> uid;
    if visible <> 0 then raise exception 'FAIL: goal_progress leaked % rows', visible; end if;
    select count(*) into visible from public.goal_contributions where user_id <> uid;
    if visible <> 0 then raise exception 'FAIL: goal_contributions leaked % rows', visible; end if;

    -- A contribution must be positive.
    begin
      insert into public.goal_contributions (goal_id, user_id, amount)
        values (gid, uid, 0);
      raise exception 'FAIL: zero goal contribution allowed';
    exception when check_violation then null; end;

    -- A goal must be positive too.
    begin
      insert into public.goals (user_id, name, target_amount)
        values (uid, 'Nonsense', 0);
      raise exception 'FAIL: zero target goal allowed';
    exception when check_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 18. A goal contribution cannot reference another user's goal (composite FK).
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare bob_goal uuid;
  begin
    -- Create a goal owned by Bob, as Bob.
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
    insert into public.goals (user_id, name, target_amount)
      values ('00000000-0000-0000-0000-00000000000b', 'Bob goal', 1000)
      returning id into bob_goal;

    -- As Alice, try to contribute to Bob's goal while claiming ownership.
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
    begin
      insert into public.goal_contributions (goal_id, user_id, amount)
        values (bob_goal, '00000000-0000-0000-0000-00000000000a', 500);
      raise exception 'FAIL: cross-user goal contribution was allowed';
    exception when foreign_key_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 19. Deleting a goal cascades to its contributions.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    gid uuid; remaining int;
  begin
    insert into public.goals (user_id, name, target_amount)
      values (uid, 'Temp goal', 5000) returning id into gid;
    insert into public.goal_contributions (goal_id, user_id, amount)
      values (gid, uid, 1000);

    delete from public.goals where id = gid;

    select count(*) into remaining
    from public.goal_contributions where goal_id = gid;
    if remaining <> 0 then
      raise exception 'FAIL: goal delete left % contributions', remaining;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 20. Search consistency: normalize_search_term maps `*` to `%` (PostgREST's
--     ilike wildcard) and strips structural quotes/backslashes, so the totals
--     RPC and the list filter agree on what a search term means.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    ecat uuid;
    normalized text;
    matched int;
  begin
    select id into ecat from public.categories where user_id=uid and kind='expense' limit 1;

    insert into public.transactions (user_id,type,amount,account_id,category_id,description)
      values
        (uid,'expense',100,acct,ecat,'coffee shop'),
        (uid,'expense',200,acct,ecat,'50% off shoes');

    -- `*` is a wildcard, exactly as PostgREST's ilike treats it.
    normalized := public.normalize_search_term('cof*ee');
    if normalized <> 'cof%ee' then
      raise exception 'FAIL: normalize_search_term returned % (expected cof%%ee)', normalized;
    end if;

    select count(*) into matched
    from public.transactions
    where description ilike '%' || public.normalize_search_term('cof*ee') || '%';
    if matched <> 1 then
      raise exception 'FAIL: star search matched % rows (expected 1)', matched;
    end if;

    -- Blank input normalises to null, meaning "no search constraint".
    if public.normalize_search_term('   ') is not null then
      raise exception 'FAIL: blank search did not normalise to null';
    end if;

    -- The totals RPC uses the same normaliser, so it must find the same row.
    if (
      select expense_total
      from public.get_transaction_totals(p_search => 'cof*ee')
    ) <> 100 then
      raise exception 'FAIL: totals search disagrees with the list search';
    end if;

    -- A literal `%` stays a wildcard on both sides (native LIKE semantics).
    select count(*) into matched
    from public.transactions
    where description ilike '%' || public.normalize_search_term('50%') || '%';
    if matched <> 1 then
      raise exception 'FAIL: percent search matched % rows (expected 1)', matched;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 21. Balance breakdown: savings separated from spendable, investments
--     included, and net worth is exactly their sum. RLS still applies.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    cash uuid := '10000000-0000-0000-0000-00000000000a';
    savings uuid;
    spendable numeric; sav numeric; inv numeric; net numeric;
  begin
    -- Cash account with an opening balance of 100, plus a savings account.
    update public.accounts set opening_balance = 100 where id = cash;
    insert into public.accounts (user_id, name, type, opening_balance)
      values (uid, 'A Savings Account', 'savings', 5000)
      returning id into savings;

    -- One investment worth 20000.
    insert into public.investments
      (user_id, name, quantity, purchase_price, current_value)
      values (uid, 'Test Fund', 1, 20000, 20000);

    select b.spendable, b.savings, b.investments, b.net_worth
      into spendable, sav, inv, net
    from public.get_balance_breakdown() b;

    -- Cash 100 spendable; savings 5000; investments 20000; net 25100
    -- (no debts in this test).
    if spendable <> 100 then
      raise exception 'FAIL: spendable % (expected 100; savings/investments leaked?)', spendable;
    end if;
    if sav <> 5000 then
      raise exception 'FAIL: savings % (expected 5000)', sav;
    end if;
    if inv <> 20000 then
      raise exception 'FAIL: investments % (expected 20000)', inv;
    end if;
    if net <> 25100 then
      raise exception 'FAIL: net worth % (expected 25100)', net;
    end if;
    if net <> spendable + sav + inv then
      raise exception 'FAIL: net worth is not spendable + savings + investments';
    end if;

    -- get_net_worth must still report the same total (AI callers rely on it).
    if public.get_net_worth() <> net then
      raise exception 'FAIL: get_net_worth (%) disagrees with breakdown (%)',
        public.get_net_worth(), net;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 22. An archived savings account is excluded from the breakdown.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    sav uuid;
    savings_total numeric;
  begin
    insert into public.accounts (user_id, name, type, opening_balance, is_archived)
      values (uid, 'Archived Savings', 'savings', 9999, true)
      returning id into sav;

    select b.savings into savings_total from public.get_balance_breakdown() b;
    if savings_total <> 0 then
      raise exception 'FAIL: archived savings counted in breakdown (%)', savings_total;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 23. The breakdown must not leak another user's savings.
-- ===========================================================================
begin;
  do $$
  begin
    insert into public.accounts (user_id, name, type, opening_balance)
      values ('00000000-0000-0000-0000-00000000000b', 'Bob Savings', 'savings', 888888);
  end $$;

  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare sav numeric;
  begin
    select b.savings into sav from public.get_balance_breakdown() b;
    if sav <> 0 then
      raise exception 'FAIL: breakdown leaked another user''s savings (%)', sav;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 24. Investments: derived cost/market/gain, RLS isolation, and that an
--     investment never affects expense totals.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    inv uuid;
    cost numeric; market numeric; gain numeric; portfolio numeric;
    visible int;
  begin
    -- 10 units at 1000 each = cost 10000; current value 12000 -> gain 2000.
    insert into public.investments
      (user_id, name, asset_type, quantity, purchase_price, current_value)
      values (uid, 'NMB shares', 'stock', 10, 1000, 12000)
      returning id into inv;

    select h.cost_basis, h.market_value, h.gain into cost, market, gain
    from public.investment_holdings h where h.id = inv;

    if cost <> 10000 then raise exception 'FAIL: cost basis % (expected 10000)', cost; end if;
    if market <> 12000 then raise exception 'FAIL: market value % (expected 12000)', market; end if;
    if gain <> 2000 then raise exception 'FAIL: gain % (expected 2000)', gain; end if;

    if public.get_portfolio_value() <> 12000 then
      raise exception 'FAIL: portfolio value % (expected 12000)', public.get_portfolio_value();
    end if;

    -- A holding with no current value falls back to cost.
    insert into public.investments
      (user_id, name, asset_type, quantity, purchase_price)
      values (uid, 'Unpriced fund', 'fund', 5, 2000);
    select h.cost_basis, h.market_value into cost, market
    from public.investment_holdings h where h.name = 'Unpriced fund';
    if cost <> 10000 or market <> 10000 then
      raise exception 'FAIL: unpriced holding cost/market %/% (expected 10000/10000)', cost, market;
    end if;

    -- Investments must not leak across users.
    select count(*) into visible from public.investment_holdings where user_id <> uid;
    if visible <> 0 then raise exception 'FAIL: investment_holdings leaked % rows', visible; end if;

    -- A negative quantity or price is rejected.
    begin
      insert into public.investments (user_id, name, quantity, purchase_price)
        values (uid, 'Bad qty', -1, 100);
      raise exception 'FAIL: negative quantity allowed';
    exception when check_violation then null; end;

    -- An unknown asset type is rejected.
    begin
      insert into public.investments (user_id, name, asset_type)
        values (uid, 'Bad type', 'nft');
      raise exception 'FAIL: unknown asset type allowed';
    exception when check_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 25. An archived investment is excluded from the portfolio value.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
  begin
    insert into public.investments
      (user_id, name, quantity, purchase_price, current_value, is_archived)
      values (uid, 'Archived holding', 1, 1000, 5000, true);

    if public.get_portfolio_value() <> 0 then
      raise exception 'FAIL: archived investment counted in portfolio (%)',
        public.get_portfolio_value();
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 26. Investment RLS: Alice cannot see or create Bob's investments.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare visible int;
  begin
    begin
      insert into public.investments (user_id, name, quantity, purchase_price)
        values ('00000000-0000-0000-0000-00000000000b', 'Sneaky', 1, 100);
      raise exception 'FAIL: Alice inserted an investment for Bob';
    exception when insufficient_privilege then null; end;

    select count(*) into visible from public.investments where user_id <> '00000000-0000-0000-0000-00000000000a';
    if visible <> 0 then raise exception 'FAIL: investments leaked % rows', visible; end if;
  end $$;
rollback;

-- ===========================================================================
-- 27. Debts: derived status, net-worth effect, RLS isolation.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    owed_to uuid; owed_by uuid;
    st text; net numeric; owed_to_total numeric; owed_by_total numeric;
    visible int;
  begin
    -- Money owed to me: 5000 open.
    insert into public.debts (user_id, direction, counterparty, principal, remaining_amount)
      values (uid, 'owed_to_me', 'John', 5000, 5000) returning id into owed_to;
    -- Money I owe: 2000 open.
    insert into public.debts (user_id, direction, counterparty, principal, remaining_amount)
      values (uid, 'owed_by_me', 'Bank', 2000, 2000) returning id into owed_by;

    select d.status into st from public.debt_details d where d.id = owed_to;
    if st <> 'open' then raise exception 'FAIL: debt status % (expected open)', st; end if;

    select b.owed_to_me, b.owed_by_me, b.net_worth into owed_to_total, owed_by_total, net
    from public.get_balance_breakdown() b;
    if owed_to_total <> 5000 then raise exception 'FAIL: owed_to_me % (expected 5000)', owed_to_total; end if;
    if owed_by_total <> 2000 then raise exception 'FAIL: owed_by_me % (expected 2000)', owed_by_total; end if;
    -- Net worth includes +5000 -2000 = +3000 from debts (accounts/investments are 0 here).
    if net <> 3000 then raise exception 'FAIL: net worth % (expected 3000)', net; end if;

    -- Settling a debt removes it from net worth.
    update public.debts set remaining_amount = 0 where id = owed_to;
    select d.status into st from public.debt_details d where d.id = owed_to;
    if st <> 'settled' then raise exception 'FAIL: settled status % (expected settled)', st; end if;
    select b.owed_to_me into owed_to_total from public.get_balance_breakdown() b;
    if owed_to_total <> 0 then raise exception 'FAIL: settled debt still counted %', owed_to_total; end if;

    -- A written-off debt is excluded too, regardless of remaining.
    update public.debts set is_written_off = true where id = owed_by;
    select b.owed_by_me into owed_by_total from public.get_balance_breakdown() b;
    if owed_by_total <> 0 then raise exception 'FAIL: written-off debt still counted %', owed_by_total; end if;

    -- Debts must not leak across users.
    select count(*) into visible from public.debt_details where user_id <> uid;
    if visible <> 0 then raise exception 'FAIL: debt_details leaked % rows', visible; end if;

    -- A non-positive principal / negative remaining / bad direction is rejected.
    begin
      insert into public.debts (user_id, direction, counterparty, principal, remaining_amount)
        values (uid, 'owed_by_me', 'Bad', 0, 0);
      raise exception 'FAIL: zero principal allowed';
    exception when check_violation then null; end;

    begin
      insert into public.debts (user_id, direction, counterparty, principal, remaining_amount)
        values (uid, 'sideways', 'Bad', 100, 100);
      raise exception 'FAIL: bad direction allowed';
    exception when check_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 28. Debt RLS: Alice cannot see or create Bob's debts.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare visible int;
  begin
    begin
      insert into public.debts (user_id, direction, counterparty, principal, remaining_amount)
        values ('00000000-0000-0000-0000-00000000000b', 'owed_by_me', 'Sneaky', 1, 1);
      raise exception 'FAIL: Alice inserted a debt for Bob';
    exception when insufficient_privilege then null; end;

    select count(*) into visible from public.debts where user_id <> '00000000-0000-0000-0000-00000000000a';
    if visible <> 0 then raise exception 'FAIL: debts leaked % rows', visible; end if;
  end $$;
rollback;

-- ===========================================================================
-- 29. Net worth history: reconstructed account-only totals, transfers net to
--     zero, and RLS isolation.
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    uid uuid := '00000000-0000-0000-0000-00000000000a';
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    acct2 uuid;
    ecat uuid; icat uuid;
    this_month numeric; rows int;
  begin
    -- Cash account: opening 0; add 1000 income and 200 expense this month.
    update public.accounts set opening_balance = 0 where id = acct;
    insert into public.accounts (user_id, name, type, opening_balance)
      values (uid, 'A Savings', 'savings', 0) returning id into acct2;

    select id into ecat from public.categories where user_id=uid and kind='expense' limit 1;
    select id into icat from public.categories where user_id=uid and kind='income' limit 1;

    insert into public.transactions (user_id,type,amount,account_id,category_id,occurred_on)
      values (uid,'income',1000,acct,icat,current_date),
             (uid,'expense',200,acct,ecat,current_date);

    -- A transfer between the user's own accounts must not change the total.
    insert into public.transactions (user_id,type,amount,account_id,transfer_account_id,occurred_on)
      values (uid,'transfer',300,acct,acct2,current_date);

    -- Latest month's account total should be 1000 - 200 = 800 (transfer nets 0).
    select h.account_total into this_month
    from public.get_net_worth_history(12) h
    order by h.month_start desc limit 1;

    if this_month <> 800 then
      raise exception 'FAIL: latest history total % (expected 800; transfer leaked?)', this_month;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 30. Net worth history must not leak another user's data.
-- ===========================================================================
begin;
  do $$
  begin
    insert into public.transactions (user_id,type,amount,account_id,category_id,occurred_on)
    select '00000000-0000-0000-0000-00000000000b','income',999999,
      '10000000-0000-0000-0000-00000000000b', c.id, current_date
    from public.categories c where c.user_id='00000000-0000-0000-0000-00000000000b' and c.kind='income' limit 1;
  end $$;

  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare leaked numeric;
  begin
    select coalesce(max(h.account_total),0) into leaked from public.get_net_worth_history(12) h;
    if leaked <> 0 then
      raise exception 'FAIL: net worth history leaked another user (%)', leaked;
    end if;
  end $$;
rollback;

-- ===========================================================================
-- 7. Deleting an account that has transactions must be blocked (RESTRICT).
-- ===========================================================================
begin;
  set local role authenticated;
  select public.test_as_user('00000000-0000-0000-0000-00000000000a');
  do $$
  declare
    acct uuid := '10000000-0000-0000-0000-00000000000a';
    cat uuid;
  begin
    select id into cat from public.categories
    where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'expense' limit 1;

    insert into public.transactions (user_id, type, amount, account_id, category_id)
    values ('00000000-0000-0000-0000-00000000000a', 'expense', 5, acct, cat);

    begin
      delete from public.accounts where id = acct;
      raise exception 'FAIL: deleted an account that still has transactions';
    exception when foreign_key_violation then null; end;
  end $$;
rollback;

-- ===========================================================================
-- 8. Deleting an auth user cascades to their financial data.
-- ===========================================================================
do $$
declare remaining int;
begin
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
  select count(*) into remaining
  from public.accounts where user_id = '00000000-0000-0000-0000-00000000000b';
  if remaining <> 0 then
    raise exception 'FAIL: cascade delete left % accounts', remaining;
  end if;
end $$;

\echo 'ALL RLS/INTEGRITY TESTS PASSED'
