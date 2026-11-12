-- =====================================================================
-- SportStake – database schema for Supabase (PostgreSQL)
--
-- HOW TO USE
--   1. Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--   2. Never put the `service_role` key in the website. It is for server code only.
--
-- DESIGN RULES (do not weaken these)
--   • The browser can READ its own data but can NEVER write money tables directly.
--   • Every balance change goes through credit_wallet() – one row-locked, idempotent,
--     ledgered path. wallets.balance can never go negative (CHECK constraint).
--   • Bets are priced from the `odds` table on the server, never from client numbers.
--   • Settlement/payout functions are callable by service_role only.
--
-- STATUS: untested draft – review with a developer / test on a staging project
-- before real money. Gambling needs a licence and legal review in your country.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  phone                text unique,
  full_name            text not null default '',
  referred_by          text,
  kyc_status           text not null default 'none' check (kyc_status in ('none','pending','verified','rejected')),
  self_excluded_until  timestamptz,
  created_at           timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  balance     numeric(14,2) not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

-- Append-only record of every money movement.
create table if not exists public.ledger (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id),
  type           text not null check (type in ('deposit','withdrawal','bet_stake','bet_win','cashout','bonus','casino_stake','casino_win','refund','adjustment')),
  amount         numeric(14,2) not null,            -- + credit, - debit
  balance_after  numeric(14,2) not null,
  ref            text,                              -- provider reference / bet id (idempotency)
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists ledger_user_time on public.ledger (user_id, created_at desc);
-- the same (type, ref) can only be applied once → safe against double webhooks / retries
create unique index if not exists ledger_idempotent on public.ledger (type, ref) where ref is not null;

-- ---------------------------------------------------------------------
-- Sportsbook data (filled by your odds/results feed or an Edge Function)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id          text primary key,
  sport       text not null check (sport in ('football','v-football','basketball','v-basketball')),
  home        text not null,
  away        text not null,
  league      text not null,
  kickoff     timestamptz not null,
  status      text not null default 'scheduled' check (status in ('scheduled','live','finished','cancelled')),
  home_score  int  not null default 0,
  away_score  int  not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists events_kickoff on public.events (kickoff);

create table if not exists public.odds (
  event_id    text not null references public.events(id) on delete cascade,
  market      text not null,                        -- 1x2, dc, ou, btts, ml, hcp, tot
  selection   text not null,                        -- 1, X, 2, 1X, O, U, GG, NG, H1 ...
  label       text not null,
  price       numeric(8,2) not null check (price >= 1.01),
  suspended   boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (event_id, market, selection)
);

-- ---------------------------------------------------------------------
-- Bets
-- ---------------------------------------------------------------------
create table if not exists public.bets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id),
  kind             text not null check (kind in ('single','multiple')),
  stake            numeric(14,2) not null check (stake > 0),
  total_odds       numeric(12,2) not null,
  boost_pct        numeric(5,2) not null default 0,
  potential_win    numeric(14,2) not null,
  status           text not null default 'open' check (status in ('open','won','lost','cashed_out','void')),
  payout           numeric(14,2),
  idempotency_key  text,
  placed_at        timestamptz not null default now(),
  settled_at       timestamptz,
  unique (user_id, idempotency_key)
);
create index if not exists bets_user_time on public.bets (user_id, placed_at desc);
create index if not exists bets_open on public.bets (status) where status = 'open';

create table if not exists public.bet_legs (
  id         bigint generated always as identity primary key,
  bet_id     uuid not null references public.bets(id) on delete cascade,
  event_id   text not null references public.events(id),
  market     text not null,
  selection  text not null,
  odds       numeric(8,2) not null,
  result     text check (result in ('won','lost','void'))
);
create index if not exists bet_legs_bet on public.bet_legs (bet_id);
create index if not exists bet_legs_event on public.bet_legs (event_id);

-- Short shareable booking codes (like "Mx26ku")
create table if not exists public.booking_codes (
  code        text primary key,
  picks       jsonb not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  amount        numeric(14,2) not null check (amount > 0),
  method        text not null,
  account       text not null,
  status        text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  provider_ref  text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- New user → profile + wallet
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, full_name, referred_by)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'referred_by');
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- The ONLY way money moves: row-locked, idempotent, ledgered
-- ---------------------------------------------------------------------
create or replace function public.credit_wallet(p_user uuid, p_amount numeric, p_type text, p_ref text default null, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_bal numeric(14,2);
begin
  if p_amount is null or p_amount = 0 then raise exception 'zero_amount'; end if;

  select balance into v_bal from public.wallets where user_id = p_user for update;   -- row lock
  if not found then raise exception 'wallet_not_found'; end if;

  if p_ref is not null and exists (select 1 from public.ledger where type = p_type and ref = p_ref) then
    return v_bal;                                                                    -- already applied
  end if;

  if v_bal + p_amount < 0 then raise exception 'insufficient_funds'; end if;
  v_bal := round(v_bal + p_amount, 2);

  update public.wallets set balance = v_bal, updated_at = now() where user_id = p_user;
  insert into public.ledger (user_id, type, amount, balance_after, ref, note)
  values (p_user, p_type, round(p_amount, 2), v_bal, p_ref, p_note);
  return v_bal;
end $$;

-- ---------------------------------------------------------------------
-- Booking codes
-- ---------------------------------------------------------------------
create or replace function public.create_booking_code(p_picks jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_tries int := 0;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) not between 1 and 30 then
    raise exception 'bad_picks';
  end if;
  loop
    v_code := '';
    for k in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    begin
      insert into public.booking_codes (code, picks, created_by) values (v_code, p_picks, auth.uid());
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 10 then raise exception 'code_generation_failed'; end if;
    end;
  end loop;
end $$;

create or replace function public.load_booking_code(p_code text)
returns jsonb language sql security definer set search_path = public stable as $$
  select picks from public.booking_codes where code = p_code;
$$;

-- ---------------------------------------------------------------------
-- Place a bet – prices come from the odds table, never from the browser
--   p_picks: [{"event_id":"f01","market":"1x2","selection":"1","odds":2.10}, ...]
--   `odds` in a pick is only the price the user SAW; it is used to detect changes.
-- ---------------------------------------------------------------------
create or replace function public.place_bet(
  p_picks jsonb, p_stake numeric, p_mode text, p_idem text default null, p_accept_odds boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  v_excl       timestamptz;
  v_n          int;
  v_i          int;
  v_pick       jsonb;
  v_ev         public.events%rowtype;
  v_odd        public.odds%rowtype;
  v_total_odds numeric := 1;
  v_boost      numeric := 0;
  v_stake      numeric(14,2) := round(coalesce(p_stake, 0), 2);
  v_win        numeric(14,2);
  v_bet        uuid;
  v_ids        uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select self_excluded_until into v_excl from public.profiles where id = v_uid;
  if v_excl is not null and v_excl > now() then raise exception 'self_excluded'; end if;

  -- retry-safe: same idempotency key returns the original bets
  if p_idem is not null then
    select array_agg(id) into v_ids from public.bets where user_id = v_uid and starts_with(idempotency_key, p_idem || ':');
    if v_ids is not null then return jsonb_build_object('ok', true, 'duplicate', true, 'bet_ids', to_jsonb(v_ids)); end if;
  end if;

  if p_mode not in ('single','multiple') then raise exception 'bad_mode'; end if;
  v_n := coalesce(jsonb_array_length(p_picks), 0);
  if v_n < 1 or v_n > 30 then raise exception 'bad_selection_count'; end if;
  if p_mode = 'multiple' and v_n < 2 then raise exception 'multiple_needs_two'; end if;
  if v_stake < 1 or v_stake > 50000 then raise exception 'bad_stake'; end if;
  if (select count(distinct e->>'event_id') from jsonb_array_elements(p_picks) e) <> v_n then raise exception 'one_pick_per_match'; end if;

  -- validate every pick against live server data
  for v_i in 0 .. v_n - 1 loop
    v_pick := p_picks -> v_i;
    select * into v_ev from public.events where id = v_pick->>'event_id';
    if not found then raise exception 'event_not_found'; end if;
    if not (v_ev.status = 'live' or (v_ev.status = 'scheduled' and v_ev.kickoff > now())) then raise exception 'event_closed'; end if;

    select * into v_odd from public.odds
     where event_id = v_ev.id and market = v_pick->>'market' and selection = v_pick->>'selection';
    if not found then raise exception 'market_not_found'; end if;
    if v_odd.suspended then raise exception 'market_suspended'; end if;
    if not p_accept_odds and v_pick ? 'odds' and abs((v_pick->>'odds')::numeric - v_odd.price) > 0.001 then
      raise exception 'odds_changed';
    end if;
    v_total_odds := v_total_odds * v_odd.price;
  end loop;

  if p_mode = 'multiple' then
    v_boost := (array[0,0,3,5,8,10,12,13,15,18,20])[least(v_n, 10) + 1];
    v_win   := least(500000, round(v_stake * round(v_total_odds, 2) * (1 + v_boost / 100), 2));
    insert into public.bets (user_id, kind, stake, total_odds, boost_pct, potential_win, idempotency_key)
    values (v_uid, 'multiple', v_stake, round(v_total_odds, 2), v_boost, v_win, case when p_idem is null then null else p_idem || ':0' end)
    returning id into v_bet;

    insert into public.bet_legs (bet_id, event_id, market, selection, odds)
    select v_bet, p->>'event_id', p->>'market', p->>'selection', o.price
      from jsonb_array_elements(p_picks) p
      join public.odds o on o.event_id = p->>'event_id' and o.market = p->>'market' and o.selection = p->>'selection';

    perform public.credit_wallet(v_uid, -v_stake, 'bet_stake', v_bet::text, 'Multiple bet');
    v_ids := array[v_bet];
  else
    v_ids := '{}';
    for v_i in 0 .. v_n - 1 loop
      v_pick := p_picks -> v_i;
      select * into v_odd from public.odds where event_id = v_pick->>'event_id' and market = v_pick->>'market' and selection = v_pick->>'selection';
      v_win := least(500000, round(v_stake * v_odd.price, 2));
      insert into public.bets (user_id, kind, stake, total_odds, potential_win, idempotency_key)
      values (v_uid, 'single', v_stake, v_odd.price, v_win, case when p_idem is null then null else p_idem || ':' || v_i end)
      returning id into v_bet;
      insert into public.bet_legs (bet_id, event_id, market, selection, odds)
      values (v_bet, v_pick->>'event_id', v_pick->>'market', v_pick->>'selection', v_odd.price);
      perform public.credit_wallet(v_uid, -v_stake, 'bet_stake', v_bet::text, 'Single bet');
      v_ids := v_ids || v_bet;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'bet_ids', to_jsonb(v_ids), 'booking_code', public.create_booking_code(p_picks));
end $$;

-- ---------------------------------------------------------------------
-- Withdrawals (KYC required) – debits immediately, finance approves/pays
-- ---------------------------------------------------------------------
create or replace function public.request_withdrawal(p_amount numeric, p_method text, p_account text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_kyc text; v_amt numeric(14,2) := round(coalesce(p_amount,0), 2);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_amt < 5 then raise exception 'min_withdrawal'; end if;
  select kyc_status into v_kyc from public.profiles where id = auth.uid();
  if v_kyc is distinct from 'verified' then raise exception 'kyc_required'; end if;
  insert into public.withdrawals (id, user_id, amount, method, account) values (v_id, auth.uid(), v_amt, p_method, p_account);
  perform public.credit_wallet(auth.uid(), -v_amt, 'withdrawal', v_id::text, 'Withdrawal');
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Settlement payout (service_role only – your settlement job decides the result)
-- ---------------------------------------------------------------------
create or replace function public.settle_bet_final(p_bet uuid, p_status text, p_payout numeric default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v public.bets%rowtype;
begin
  select * into v from public.bets where id = p_bet for update;
  if not found then raise exception 'bet_not_found'; end if;
  if v.status <> 'open' then return; end if;                       -- already settled → no double pay

  if p_status = 'won' then
    perform public.credit_wallet(v.user_id, least(p_payout, 500000), 'bet_win', 'win:' || p_bet, 'Bet won');
    update public.bets set status = 'won', payout = least(p_payout, 500000), settled_at = now() where id = p_bet;
  elsif p_status = 'void' then
    perform public.credit_wallet(v.user_id, v.stake, 'refund', 'void:' || p_bet, 'Bet void – stake returned');
    update public.bets set status = 'void', payout = v.stake, settled_at = now() where id = p_bet;
  elsif p_status = 'lost' then
    update public.bets set status = 'lost', payout = 0, settled_at = now() where id = p_bet;
  else
    raise exception 'bad_status';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security: users read only their own data; nobody writes directly
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.wallets       enable row level security;
alter table public.ledger        enable row level security;
alter table public.bets          enable row level security;
alter table public.bet_legs      enable row level security;
alter table public.withdrawals   enable row level security;
alter table public.booking_codes enable row level security;   -- no policy → only via functions
alter table public.events        enable row level security;
alter table public.odds          enable row level security;

drop policy if exists own_profile    on public.profiles;
drop policy if exists own_wallet     on public.wallets;
drop policy if exists own_ledger     on public.ledger;
drop policy if exists own_bets       on public.bets;
drop policy if exists own_legs       on public.bet_legs;
drop policy if exists own_withdrawal on public.withdrawals;
drop policy if exists read_events    on public.events;
drop policy if exists read_odds      on public.odds;

create policy own_profile    on public.profiles    for select using (id = auth.uid());
create policy own_wallet     on public.wallets     for select using (user_id = auth.uid());
create policy own_ledger     on public.ledger      for select using (user_id = auth.uid());
create policy own_bets       on public.bets        for select using (user_id = auth.uid());
create policy own_legs       on public.bet_legs    for select using (exists (select 1 from public.bets b where b.id = bet_id and b.user_id = auth.uid()));
create policy own_withdrawal on public.withdrawals for select using (user_id = auth.uid());
create policy read_events    on public.events      for select using (true);
create policy read_odds      on public.odds        for select using (true);

-- belt and braces: no direct writes from the browser roles at all
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- functions: lock everything down, then open only what the app needs
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.place_bet(jsonb, numeric, text, text, boolean) to authenticated;
grant execute on function public.create_booking_code(jsonb)                     to authenticated;
grant execute on function public.load_booking_code(text)                        to anon, authenticated;
grant execute on function public.request_withdrawal(numeric, text, text)        to authenticated;
grant execute on function public.credit_wallet(uuid, numeric, text, text, text) to service_role;
grant execute on function public.settle_bet_final(uuid, text, numeric)          to service_role;

-- live updates to the browser (odds, scores, balance). Run once; ignore "already member" errors.
alter publication supabase_realtime add table public.odds, public.events, public.wallets;

-- ---------------------------------------------------------------------
-- PATCH 1 (run once if you already ran the schema above):
-- store the phone number from sign-up on the profile. Email-style logins have
-- no auth phone, so it is read from the sign-up metadata instead.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, full_name, referred_by)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'referred_by'
  )
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- PATCH 2 (run once): email + locked currency + phone duplicate check
--   • profiles.currency is GHS or NGN, chosen at registration, and can NEVER change.
--   • profiles.email is stored for support.
--   • phone_available() lets the sign-up form say "number already registered".
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists email    text;
alter table public.profiles add column if not exists currency text not null default 'GHS';

do $$ begin
  alter table public.profiles add constraint profiles_currency_check check (currency in ('GHS','NGN'));
exception when duplicate_object then null; end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cur text := upper(coalesce(new.raw_user_meta_data->>'currency', 'GHS'));
begin
  if v_cur not in ('GHS','NGN') then v_cur := 'GHS'; end if;
  insert into public.profiles (id, phone, email, currency, full_name, referred_by)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.email,
    v_cur,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'referred_by', '')
  )
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- currency can never be changed after registration (not even by server code)
create or replace function public.lock_currency()
returns trigger language plpgsql as $$
begin
  if new.currency is distinct from old.currency then
    raise exception 'currency_locked';
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_currency on public.profiles;
create trigger profiles_lock_currency before update on public.profiles
  for each row execute function public.lock_currency();

create or replace function public.phone_available(p_phone text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles where phone = p_phone);
$$;
revoke execute on function public.phone_available(text) from public;
grant  execute on function public.phone_available(text) to anon, authenticated;
