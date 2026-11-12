-- FIX for:  "Failed to create user: Database error creating new user"
--   Real cause (from your Supabase log): profiles has a NOT NULL column "country" that the sign-up
--   trigger did not fill in.
-- Safe to run more than once. Changes no existing data. Paste into SQL Editor and Run.
-- Click "Run and enable RLS" if the warning box appears.

-- 1) Unknown "must not be empty" columns on profiles / wallets (for example a `country` column that
--    something else added) can no longer block sign-ups. Nothing is deleted or changed in your data.
do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name in ('profiles', 'wallets')
      and c.is_nullable = 'NO' and c.column_default is null
      and coalesce(c.is_identity, 'NO') = 'NO' and coalesce(c.is_generated, 'NEVER') = 'NEVER'
      and c.column_name not in ('id', 'user_id')
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
    raise notice 'relaxed NOT NULL on public.%.%', r.table_name, r.column_name;
  end loop;
end $$;

-- 2) The sign-up trigger now fills `country` when that column exists, and a login created by hand
--    in the Supabase dashboard (admin / agent) can never be blocked. Customer sign-ups stay strict.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta    jsonb   := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_cur     text    := upper(coalesce(v_meta ->> 'currency', 'GHS'));
  v_phone   text    := nullif(trim(coalesce(new.phone, v_meta ->> 'phone', '')), '');
  -- Customers always register with a currency. A login created by hand in the Supabase
  -- dashboard (admin / agent) has none, and must never be blocked by this trigger.
  v_lenient boolean := not (v_meta ? 'currency');
  v_code text; v_agent public.agents%rowtype; v_flags text[] := '{}';
begin
  if v_cur not in ('GHS','NGN') then v_cur := 'GHS'; end if;

  begin
    insert into public.profiles (id, phone, email, currency, full_name, referred_by)
    values (new.id, v_phone, new.email, v_cur, coalesce(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'referred_by', ''))
    on conflict (id) do nothing;
    insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  exception when others then
    if not v_lenient then raise; end if;                    -- real customers: fail loudly, never half-create
    raise warning 'handle_new_user: profile/wallet skipped for % (%)', new.id, sqlerrm;
    return new;
  end;

  -- if the profiles table has a `country` column, fill it from the chosen currency (best effort)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'country') then
    begin
      execute 'update public.profiles set country = coalesce(country, $2) where id = $1' using new.id, case v_cur when 'NGN' then 'Nigeria' else 'Ghana' end;
    exception when others then
      begin
        execute 'update public.profiles set country = coalesce(country, $2) where id = $1' using new.id, case v_cur when 'NGN' then 'NG' else 'GH' end;
      exception when others then null;
      end;
    end;
  end if;

  begin   -- referral attribution must never be able to break registration
    v_code := upper(trim(coalesce(v_meta ->> 'referred_by', '')));
    if v_code <> '' and coalesce(v_meta ->> 'account_type', '') <> 'staff' then
      select * into v_agent from public.agents where upper(referral_code) = v_code and status = 'active';
      if found then
        if lower(v_agent.email) = lower(coalesce(new.email, ''))
           or (v_agent.phone is not null and v_agent.phone = coalesce(v_phone, ''))
           or v_agent.user_id = new.id then v_flags := array['self_referral']; end if;
        insert into public.referrals (user_id, agent_id, code_used, status, disqualified_reason, flags)
        values (new.id, v_agent.id, v_code,
                case when cardinality(v_flags) > 0 then 'disqualified' else 'registered' end,
                case when cardinality(v_flags) > 0 then 'self_referral' end, v_flags)
        on conflict (user_id) do nothing;
      end if;
    end if;
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
