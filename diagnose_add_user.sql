-- READ-ONLY. Changes nothing. Run it and send me the result (screenshot is fine).
select 'columns on profiles' as what, string_agg(column_name, ', ' order by column_name) as result
  from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
union all
select 'triggers on auth.users',
       coalesce(string_agg(tgname || ' -> ' || p.proname || case when tgenabled = 'D' then ' (DISABLED)' else '' end, '; '), 'none')
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
union all
select 'triggers on public.profiles',
       coalesce(string_agg(tgname, ', '), 'none') from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal
union all
select 'triggers on public.wallets',
       coalesce(string_agg(tgname, ', '), 'none') from pg_trigger where tgrelid = 'public.wallets'::regclass and not tgisinternal
union all
select 'admin_agents.sql applied?', case when to_regclass('public.agents') is not null then 'yes (agents table exists)' else 'NO' end
union all
select 'patch 2 applied (currency column)?', case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='currency') then 'yes' else 'NO' end
union all
select 'existing profiles / auth users', (select count(*) from public.profiles)::text || ' / ' || (select count(*) from auth.users)::text
union all
select 'profiles with blank phone', (select count(*) from public.profiles where phone = '')::text;
