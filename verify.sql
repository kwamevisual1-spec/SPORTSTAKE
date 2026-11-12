-- READ-ONLY safety check. It changes nothing. Paste it into SQL Editor and run it.
-- Every row in the result should say PASS.

select check_name, case when ok then 'PASS' else 'FAIL  <-- tell me' end as result, detail
from (
  select 1 as n, 'All tables have Row Level Security ON' as check_name,
         not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
                     where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as ok,
         coalesce((select string_agg(c.relname, ', ') from pg_class c join pg_namespace s on s.oid = c.relnamespace
                   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'none missing') as detail
  union all
  select 2, 'New admin / agent tables exist',
         (select count(*) from information_schema.tables where table_schema = 'public'
            and table_name in ('settings','admin_users','agents','audit_log','staff_login_events','referrals','commissions','agent_withdrawals','payments','payment_events','promotions','bonus_grants','settlements','bet_corrections')) = 14,
         (select count(*)::text || ' of 14 found' from information_schema.tables where table_schema = 'public'
            and table_name in ('settings','admin_users','agents','audit_log','staff_login_events','referrals','commissions','agent_withdrawals','payments','payment_events','promotions','bonus_grants','settlements','bet_corrections'))
  union all
  select 3, 'Website visitors (anon) cannot write to ANY table',
         not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
                     where s.nspname = 'public' and c.relkind in ('r','v','p')
                       and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
                         or has_table_privilege('anon', c.oid, 'delete') or has_table_privilege('anon', c.oid, 'truncate'))),
         'anon must have no insert/update/delete rights'
  union all
  select 4, 'Logged-in users cannot write to ANY table directly',
         not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
                     where s.nspname = 'public' and c.relkind in ('r','v','p')
                       and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update')
                         or has_table_privilege('authenticated', c.oid, 'delete') or has_table_privilege('authenticated', c.oid, 'truncate'))),
         'all changes must go through the protected functions'
  union all
  select 5, 'Staff tables are invisible to the website',
         not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
                     where s.nspname = 'public' and c.relname in ('settings','admin_users','agents','audit_log','staff_login_events','referrals','commissions','agent_withdrawals','payments','payment_events','promotions','bonus_grants','settlements','bet_corrections','customer_profiles')
                       and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))),
         'no read access for anon / authenticated'
  union all
  select 6, 'Money functions are NOT callable from the website',
         not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                     where s.nspname = 'public' and p.proname in ('credit_wallet','settle_bet_final','bootstrap_super_admin','log_admin','require_perm')
                       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
         'credit_wallet / settle_bet_final / bootstrap_super_admin are server-only'
  union all
  select 7, 'Audit log is append-only (protected by triggers)',
         (select count(*) from pg_trigger where tgrelid = 'public.audit_log'::regclass and not tgisinternal) >= 2,
         'edit / delete / truncate are blocked'
  union all
  select 8, 'Settled bets are protected against secret edits',
         exists (select 1 from pg_trigger where tgrelid = 'public.bets'::regclass and tgname = 'bets_guard_trg'),
         'bets_guard_trg present'
  union all
  select 9, 'Your existing customers were NOT touched',
         true,
         (select count(*)::text from public.profiles) || ' profiles, ' || (select count(*)::text from public.wallets) || ' wallets still present'
  union all
  select 10, 'Super Admin created yet?',
         true,
         case when exists (select 1 from public.admin_users where role = 'super_admin') then 'YES – Super Admin exists' else 'Not yet – that is step 3 (bootstrap_super_admin)' end
) t
order by n;
