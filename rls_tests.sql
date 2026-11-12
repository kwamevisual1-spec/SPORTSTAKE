-- =====================================================================
-- RLS regression test. Run this after EVERY schema change.
-- Expected results are noted beside each check. If any check fails,
-- an attacker can read or write data they should not be able to.
-- =====================================================================

\echo '=== 1. anon (no JWT) must read nothing ==='
set local role anon;
select 'anon wallets'   as check, count(*) as rows_found from public.wallets;    -- expect 0
select 'anon profiles'  as check, count(*) as rows_found from public.profiles;   -- expect 0
select 'anon bets'      as check, count(*) as rows_found from public.bets;       -- expect 0
select 'anon agents'    as check, count(*) as rows_found from public.agents;     -- expect 0
select 'anon commissions' as check, count(*) as rows_found from public.commissions; -- expect 0
select 'anon audit_log' as check, count(*) as rows_found from public.audit_log;  -- expect 0
reset role;

\echo '=== 2. anon must not write ==='
set local role anon;
do $$ begin
  begin
    insert into public.profiles(id) values (gen_random_uuid());
    raise exception 'FAIL: anon inserted a profile';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS: anon insert rejected';
  end;
end $$;
reset role;

\echo '=== 3. a logged-in user must not read another user wallet (IDOR) ==='
-- Replace <OTHER-UUID> with a real second user id, run as the first user.
-- select * from public.wallets where user_id = '<OTHER-UUID>';   -- expect 0 rows

\echo '=== 4. a normal user must not call admin RPCs ==='
-- select public.admin_list_users();                              -- expect permission denied
-- select public.admin_overview('GHS', now()-interval '1 day', now(), 'day');  -- expect permission denied
-- select public.admin_create_agent(gen_random_uuid(),'x','x','x@x.com',null,'cpa','{}'::jsonb,0,'monthly'); -- expect permission denied

\echo '=== 5. a user must not move their own balance directly ==='
-- update public.wallets set balance = 999999;                    -- expect permission denied
-- insert into public.ledger(user_id,type,amount) values ('<SELF>','deposit',999999); -- expect permission denied

\echo '=== 6. audit_log must be append-only ==='
-- update public.audit_log set action='x';                        -- expect append_only error
-- delete from public.audit_log;                                  -- expect append_only error
-- truncate public.audit_log;                                     -- expect append_only error

\echo '=== 7. settled bets are locked ==='
-- update public.bets set status='won', payout=999999 where status='lost';  -- expect settled_bet_locked

\echo '=== 8. every table has RLS on ==='
select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relname;                                              -- expect rls_enabled = true for all
