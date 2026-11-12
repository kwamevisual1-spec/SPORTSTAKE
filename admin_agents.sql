-- =====================================================================
-- SportStake – Super Admin, Agents & Referrals  (MIGRATION 2)
--
-- RUN ORDER: schema.sql (incl. PATCH 1 + PATCH 2) first, then this file.
-- Safe to re-run. Additive only: it never drops tables or deletes data.
--
-- SECURITY MODEL
--   • Every new table has Row Level Security ON and NO policies, and all rights are
--     revoked from the browser roles → the browser can never read/write them directly.
--   • All access goes through SECURITY DEFINER functions that check, on the SERVER:
--       who you are (auth.uid()), your role/permissions, and that you passed 2FA
--       (JWT claim aal = 'aal2'). A stolen password alone is useless.
--   • Money only moves through credit_wallet(); settled bets are locked by triggers;
--     the audit log is append-only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Prerequisites on existing tables (additive)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists email        text;
alter table public.profiles add column if not exists currency     text not null default 'GHS';
alter table public.profiles add column if not exists status       text not null default 'active';
alter table public.profiles add column if not exists status_reason text;
alter table public.profiles add column if not exists risk_flag    boolean not null default false;
alter table public.profiles add column if not exists risk_note    text;
alter table public.profiles add column if not exists kyc_note     text;
do $$ begin
  alter table public.profiles add constraint profiles_status_check check (status in ('active','restricted','suspended'));
exception when duplicate_object then null; end $$;

alter table public.ledger drop constraint if exists ledger_type_check;
alter table public.ledger add constraint ledger_type_check check (type in
  ('deposit','withdrawal','bet_stake','bet_win','cashout','bonus','casino_stake','casino_win','refund','adjustment','chargeback','commission'));

alter table public.odds       add column if not exists line numeric;
alter table public.bet_legs   add column if not exists line numeric;
alter table public.withdrawals add column if not exists reviewed_by    uuid;
alter table public.withdrawals add column if not exists reviewed_at    timestamptz;
alter table public.withdrawals add column if not exists reject_reason  text;
alter table public.withdrawals add column if not exists payout_ref     text;
alter table public.withdrawals add column if not exists first_approver uuid;

-- ---------------------------------------------------------------------
-- 1. Settings (all admin-controlled limits & rules live here)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('stake_limits',            '{"GHS":{"min":1,"max":50000},"NGN":{"min":100,"max":5000000}}'),
  ('max_payout',              '{"GHS":500000,"NGN":50000000}'),
  ('qualification',           '{"min_deposit":{"GHS":50,"NGN":5000},"min_settled_stake":{"GHS":50,"NGN":5000},"require_kyc":false,"window_days":30}'),
  ('withdrawal_dual_approval','{"GHS":0,"NGN":0}'),
  ('agent_min_withdrawal',    '{"GHS":50,"NGN":5000}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Staff: administrators, agents, audit, logins
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null default '',
  role          text not null default 'support',
  permissions   text[] not null default '{}',
  status        text not null default 'active' check (status in ('active','suspended')),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create sequence if not exists public.agent_code_seq start 1;
create table if not exists public.agents (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid unique references auth.users(id) on delete restrict,
  username             text not null,
  full_name            text not null,
  email                text not null,
  phone                text,
  referral_code        text not null,
  status               text not null default 'active' check (status in ('active','suspended','deactivated')),
  model                text not null default 'revshare' check (model in ('cpa','revshare','hybrid')),
  cpa_amount           jsonb not null default '{"GHS":0,"NGN":0}',
  rev_share_pct        numeric(5,2) not null default 0 check (rev_share_pct between 0 and 100),
  period               text not null default 'monthly' check (period in ('weekly','monthly')),
  must_change_password boolean not null default true,
  payout_method        text,
  payout_account       text,
  payout_name          text,
  payout_status        text not null default 'none' check (payout_status in ('none','pending','approved','rejected')),
  created_by           uuid,
  created_at           timestamptz not null default now(),
  last_login_at        timestamptz
);
create unique index if not exists agents_username_uq on public.agents (lower(username));
create unique index if not exists agents_code_uq     on public.agents (upper(referral_code));

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  actor_type  text not null default 'admin',
  action      text not null,
  entity_type text,
  entity_id   text,
  details     jsonb not null default '{}',
  ip          text
);
create index if not exists audit_at on public.audit_log (at desc);

create table if not exists public.staff_login_events (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  email      text,
  portal     text,
  kind       text not null,
  success    boolean not null default false,
  ip         text,
  user_agent text
);
create index if not exists sle_at on public.staff_login_events (at desc);
create index if not exists sle_email on public.staff_login_events (lower(email), at desc);

-- Customers only (never staff) – used by every statistic. Not readable by browser roles.
create or replace view public.customer_profiles as
  select p.id, p.phone, p.email, p.currency, p.full_name, p.status, p.kyc_status, p.risk_flag, p.referred_by, p.created_at
  from public.profiles p
  where not exists (select 1 from public.admin_users a where a.user_id = p.id)
    and not exists (select 1 from public.agents g where g.user_id = p.id);

-- ---------------------------------------------------------------------
-- 3. Referrals, commissions, payouts
-- ---------------------------------------------------------------------
create table if not exists public.referrals (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  agent_id            uuid not null references public.agents(id),
  code_used           text not null,
  registered_at       timestamptz not null default now(),
  status              text not null default 'registered' check (status in ('registered','qualified','disqualified')),
  qualified_at        timestamptz,
  disqualified_reason text,
  flags               text[] not null default '{}'
);
create index if not exists referrals_agent on public.referrals (agent_id, registered_at desc);

create table if not exists public.commissions (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.agents(id),
  kind         text not null check (kind in ('cpa','revshare')),
  user_id      uuid references public.profiles(id),
  currency     text not null check (currency in ('GHS','NGN')),
  period_start timestamptz,
  period_end   timestamptz,
  base_amount  numeric(14,2) not null default 0,
  rate         numeric(8,2),
  amount       numeric(14,2) not null check (amount >= 0),
  status       text not null default 'pending' check (status in ('pending','approved','rejected','void')),
  details      jsonb not null default '{}',
  note         text,
  created_at   timestamptz not null default now(),
  reviewed_by  uuid,
  reviewed_at  timestamptz
);
create unique index if not exists commissions_cpa_uq on public.commissions (agent_id, user_id) where kind = 'cpa';
create unique index if not exists commissions_rev_uq on public.commissions (agent_id, currency, period_start, period_end) where kind = 'revshare';

create table if not exists public.agent_withdrawals (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.agents(id),
  currency     text not null check (currency in ('GHS','NGN')),
  amount       numeric(14,2) not null check (amount > 0),
  method       text not null,
  account      text not null,
  account_name text,
  status       text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  reject_reason text,
  payout_ref   text,
  requested_at timestamptz not null default now(),
  reviewed_by  uuid,
  reviewed_at  timestamptz
);

-- ---------------------------------------------------------------------
-- 4. Payments (gateway records), bonuses, settlement audit
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id),
  kind          text not null check (kind in ('deposit','withdrawal')),
  provider      text not null,
  provider_ref  text,
  amount        numeric(14,2) not null,
  currency      text not null check (currency in ('GHS','NGN')),
  status        text not null default 'pending' check (status in ('pending','succeeded','failed','reversed','chargeback')),
  reconciled    boolean not null default false,
  reconciled_by uuid,
  reconciled_at timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  unique (provider, provider_ref)
);
create table if not exists public.payment_events (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  provider    text,
  event       text,
  provider_ref text,
  payload     jsonb,
  processed   boolean not null default false,
  error       text
);

create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('welcome','campaign','free_bet','referral')),
  description text,
  amount      jsonb not null default '{"GHS":0,"NGN":0}',
  percent     numeric(6,2) not null default 0,
  max_amount  jsonb not null default '{"GHS":0,"NGN":0}',
  min_deposit jsonb not null default '{"GHS":0,"NGN":0}',
  wagering_multiple numeric(6,2) not null default 1,
  eligibility jsonb not null default '{}',
  starts_at   timestamptz,
  ends_at     timestamptz,
  budget      jsonb not null default '{"GHS":0,"NGN":0}',
  active      boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create table if not exists public.bonus_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id),
  promotion_id uuid references public.promotions(id),
  kind         text,
  amount       numeric(14,2) not null check (amount > 0),
  currency     text not null,
  status       text not null default 'active' check (status in ('active','used','expired','revoked')),
  granted_by   uuid,
  granted_at   timestamptz not null default now(),
  note         text,
  unique (user_id, promotion_id)
);

create table if not exists public.settlements (
  id          bigint generated always as identity primary key,
  event_id    text not null,
  at          timestamptz not null default now(),
  by_user     uuid,
  home_score  int,
  away_score  int,
  voided      boolean not null default false,
  bets_won    int not null default 0,
  bets_lost   int not null default 0,
  bets_void   int not null default 0,
  bets_open   int not null default 0
);
create table if not exists public.bet_corrections (
  id         bigint generated always as identity primary key,
  bet_id     uuid not null,
  at         timestamptz not null default now(),
  by_user    uuid,
  old_status text,
  old_payout numeric(14,2),
  new_status text,
  new_payout numeric(14,2),
  delta      numeric(14,2),
  reason     text not null
);

-- ---------------------------------------------------------------------
-- 5. Lock everything: RLS on, no policies, no direct rights for browser roles
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','admin_users','agents','audit_log','staff_login_events','referrals','commissions',
                           'agent_withdrawals','payments','payment_events','promotions','bonus_grants','settlements','bet_corrections']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;
revoke all on public.customer_profiles from public, anon, authenticated;
revoke all on sequence public.agent_code_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Append-only & immutability guards
-- ---------------------------------------------------------------------
create or replace function public.deny_change() returns trigger language plpgsql as $$
begin raise exception 'append_only: this table cannot be changed or deleted'; end $$;

do $$
declare t text;
begin
  foreach t in array array['audit_log','staff_login_events','settlements','bet_corrections']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_ro', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.deny_change()', t || '_ro', t);
    execute format('drop trigger if exists %I on public.%I', t || '_notrunc', t);
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.deny_change()', t || '_notrunc', t);
  end loop;
end $$;

-- A bet's money fields never change; its result can only change while open,
-- or through admin_correct_bet() which sets a transaction-local flag and writes an audit trail.
create or replace function public.bets_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'bets_are_immutable'; end if;
  if new.user_id is distinct from old.user_id or new.stake is distinct from old.stake or new.total_odds is distinct from old.total_odds
     or new.kind is distinct from old.kind or new.placed_at is distinct from old.placed_at or new.boost_pct is distinct from old.boost_pct
     or new.potential_win is distinct from old.potential_win then
    raise exception 'bet_core_fields_locked';
  end if;
  if old.status <> 'open' and (new.status is distinct from old.status or new.payout is distinct from old.payout)
     and coalesce(current_setting('app.bet_correction', true), '') <> 'on' then
    raise exception 'settled_bet_locked: use an authorised correction';
  end if;
  return new;
end $$;
drop trigger if exists bets_guard_trg on public.bets;
create trigger bets_guard_trg before update or delete on public.bets for each row execute function public.bets_guard();

create or replace function public.bet_legs_guard() returns trigger language plpgsql as $$
declare v_status text;
begin
  if tg_op = 'DELETE' then raise exception 'bet_legs_are_immutable'; end if;
  if new.bet_id is distinct from old.bet_id or new.event_id is distinct from old.event_id or new.market is distinct from old.market
     or new.selection is distinct from old.selection or new.odds is distinct from old.odds or new.line is distinct from old.line then
    raise exception 'bet_leg_core_fields_locked';
  end if;
  select status into v_status from public.bets where id = old.bet_id;
  if v_status <> 'open' and new.result is distinct from old.result and coalesce(current_setting('app.bet_correction', true), '') <> 'on' then
    raise exception 'settled_bet_locked';
  end if;
  return new;
end $$;
drop trigger if exists bet_legs_guard_trg on public.bet_legs;
create trigger bet_legs_guard_trg before update or delete on public.bet_legs for each row execute function public.bet_legs_guard();

-- finished events keep their result
create or replace function public.events_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.bet_legs where event_id = old.id) then raise exception 'event_has_bets'; end if;
    return old;
  end if;
  if old.status in ('finished','cancelled') and (new.status is distinct from old.status or new.home_score is distinct from old.home_score or new.away_score is distinct from old.away_score) then
    raise exception 'event_result_locked';
  end if;
  return new;
end $$;
drop trigger if exists events_guard_trg on public.events;
create trigger events_guard_trg before update or delete on public.events for each row execute function public.events_guard();

-- admin-controlled stake limits, payout cap and account status on every new bet
create or replace function public.bets_limits() returns trigger language plpgsql security definer set search_path = public as $$
declare v_cur text; v_status text; v_min numeric; v_max numeric; v_cap numeric;
begin
  select currency, status into v_cur, v_status from public.profiles where id = new.user_id;
  if v_status is distinct from 'active' then raise exception 'account_not_active'; end if;
  select (value -> v_cur ->> 'min')::numeric, (value -> v_cur ->> 'max')::numeric into v_min, v_max from public.settings where key = 'stake_limits';
  if v_min is not null and new.stake < v_min then raise exception 'stake_below_min'; end if;
  if v_max is not null and new.stake > v_max then raise exception 'stake_above_max'; end if;
  select (value ->> v_cur)::numeric into v_cap from public.settings where key = 'max_payout';
  if v_cap is not null then new.potential_win := least(new.potential_win, v_cap); end if;
  return new;
end $$;
drop trigger if exists bets_limits_trg on public.bets;
create trigger bets_limits_trg before insert on public.bets for each row execute function public.bets_limits();

create or replace function public.withdrawals_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.profiles where id = new.user_id;
  if v_status not in ('active','restricted') then raise exception 'account_not_active'; end if;
  return new;
end $$;
drop trigger if exists withdrawals_guard_trg on public.withdrawals;
create trigger withdrawals_guard_trg before insert on public.withdrawals for each row execute function public.withdrawals_guard();

-- ---------------------------------------------------------------------
-- 7. Authorisation helpers (server-side RBAC + 2FA)
-- ---------------------------------------------------------------------
create or replace function public.all_permissions() returns text[] language sql immutable as $$
  select array['dashboard.view','users.view','users.manage','users.kyc','finance.view','withdrawals.approve','payments.reconcile',
               'betting.view','betting.manage','betting.settle','bets.correct','agents.view','agents.manage','commissions.view',
               'commissions.calculate','commissions.approve','agent_payouts.process','promotions.manage','audit.view','settings.edit','admins.manage'] $$;

create or replace function public.role_permissions(p_role text) returns text[] language sql immutable as $$
  select case p_role
    when 'finance'           then array['dashboard.view','users.view','finance.view','withdrawals.approve','payments.reconcile','commissions.view','agent_payouts.process']
    when 'support'           then array['dashboard.view','users.view','users.kyc']
    when 'risk'              then array['dashboard.view','users.view','users.manage','users.kyc','finance.view','audit.view']
    when 'trader'            then array['dashboard.view','betting.view','betting.manage','betting.settle']
    when 'affiliate_manager' then array['dashboard.view','users.view','agents.view','agents.manage','commissions.view','commissions.calculate','commissions.approve']
    when 'marketing'         then array['dashboard.view','promotions.manage','agents.view','commissions.view']
    else array['dashboard.view'] end $$;

create or replace function public.staff_aal2() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

create or replace function public.has_perm(p text) returns boolean language sql stable security definer set search_path = public as $$
  select public.staff_aal2() and exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.status = 'active' and (a.role = 'super_admin' or p = any (a.permissions))) $$;

create or replace function public.is_super() returns boolean language sql stable security definer set search_path = public as $$
  select public.staff_aal2() and exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.status = 'active' and a.role = 'super_admin') $$;

create or replace function public.require_perm(p text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.status = 'active') then raise exception 'forbidden'; end if;
  if not public.staff_aal2() then raise exception 'mfa_required'; end if;
  if not public.has_perm(p) then raise exception 'forbidden'; end if;
end $$;

create or replace function public.require_super() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.status = 'active') then raise exception 'forbidden'; end if;
  if not public.staff_aal2() then raise exception 'mfa_required'; end if;
  if not public.is_super() then raise exception 'forbidden'; end if;
end $$;

create or replace function public.client_ip() returns text language sql stable as $$
  select nullif(trim(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1))), '') $$;

create or replace function public.client_ua() returns text language sql stable as $$
  select left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 300) $$;

create or replace function public.log_admin(p_action text, p_entity text, p_id text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_type text := 'admin';
begin
  select email into v_email from public.admin_users where user_id = auth.uid();
  if v_email is null then
    select email into v_email from public.agents where user_id = auth.uid();
    if v_email is not null then v_type := 'agent'; end if;
  end if;
  insert into public.audit_log (actor_id, actor_email, actor_type, action, entity_type, entity_id, details, ip)
  values (auth.uid(), v_email, case when auth.uid() is null then 'system' else v_type end, p_action, p_entity, p_id, coalesce(p_details, '{}'), public.client_ip());
end $$;

create or replace function public.boost_for(n int) returns numeric language sql immutable as $$
  select (array[0,0,3,5,8,10,12,13,15,18,20])[least(greatest(n, 0), 10) + 1]::numeric $$;

-- ---------------------------------------------------------------------
-- 8. Creating the FIRST Super Admin (run once, by you, in the SQL editor)
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_super_admin(p_email text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  if exists (select 1 from public.admin_users where role = 'super_admin') then raise exception 'super_admin_already_exists'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'auth_user_not_found: create the user first in Supabase → Authentication → Users'; end if;
  insert into public.admin_users (user_id, email, full_name, role, permissions, status)
  values (v_id, lower(trim(p_email)), 'Super Admin', 'super_admin', '{}', 'active');
  insert into public.audit_log (actor_id, actor_email, actor_type, action, entity_type, entity_id)
  values (v_id, lower(trim(p_email)), 'system', 'admin.bootstrap', 'admin_user', v_id::text);
  return 'Super Admin created for ' || lower(trim(p_email));
end $$;
revoke all on function public.bootstrap_super_admin(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Who am I / login tracking / brute-force helpers
-- ---------------------------------------------------------------------
create or replace function public.admin_me() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.admin_users%rowtype;
begin
  select * into a from public.admin_users where user_id = auth.uid();
  if not found then return jsonb_build_object('is_admin', false); end if;
  return jsonb_build_object('is_admin', a.status = 'active', 'status', a.status, 'role', a.role, 'email', a.email, 'full_name', a.full_name,
    'permissions', case when a.role = 'super_admin' then to_jsonb(public.all_permissions()) else to_jsonb(a.permissions) end,
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'));
end $$;

create or replace function public.agent_me() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g public.agents%rowtype;
begin
  select * into g from public.agents where user_id = auth.uid();
  if not found then return jsonb_build_object('is_agent', false); end if;
  return jsonb_build_object('is_agent', true, 'status', g.status, 'username', g.username, 'full_name', g.full_name,
                            'must_change_password', g.must_change_password);
end $$;

create or replace function public.staff_login_locked(p_email text) returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.staff_login_events e
          where e.kind = 'login_failed' and lower(e.email) = lower(coalesce(p_email, '')) and e.at > now() - interval '15 minutes') >= 5 $$;

create or replace function public.staff_login_failed(p_email text, p_portal text) returns void language plpgsql security definer set search_path = public as $$
declare v_ip text := public.client_ip();
begin
  if v_ip is not null and (select count(*) from public.staff_login_events where ip = v_ip and at > now() - interval '1 minute') >= 20 then return; end if;
  insert into public.staff_login_events (email, portal, kind, success, ip, user_agent)
  values (left(coalesce(p_email, ''), 200), left(coalesce(p_portal, ''), 20), 'login_failed', false, v_ip, public.client_ua());
end $$;

create or replace function public.staff_login_ok(p_portal text) returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_portal = 'admin' then
    select email into v_email from public.admin_users where user_id = auth.uid();
    if v_email is null then raise exception 'forbidden'; end if;
    update public.admin_users set last_login_at = now() where user_id = auth.uid();
  elsif p_portal = 'agent' then
    select email into v_email from public.agents where user_id = auth.uid();
    if v_email is null then raise exception 'forbidden'; end if;
    update public.agents set last_login_at = now() where user_id = auth.uid();
  else raise exception 'bad_portal'; end if;
  insert into public.staff_login_events (user_id, email, portal, kind, success, ip, user_agent)
  values (auth.uid(), v_email, p_portal, 'login', true, public.client_ip(), public.client_ua());
end $$;

-- username → email so agents can sign in with their username (rate limited per IP)
create or replace function public.agent_login_email(p_username text) returns text language plpgsql security definer set search_path = public as $$
declare v_ip text := public.client_ip(); v_email text;
begin
  if v_ip is not null then
    if (select count(*) from public.staff_login_events where ip = v_ip and kind = 'lookup' and at > now() - interval '1 minute') >= 10 then return null; end if;
    insert into public.staff_login_events (portal, kind, success, ip, user_agent) values ('agent', 'lookup', false, v_ip, public.client_ua());
  end if;
  select email into v_email from public.agents where lower(username) = lower(trim(coalesce(p_username, ''))) and status <> 'deactivated';
  return v_email;
end $$;

-- ---------------------------------------------------------------------
-- 10. Referral attribution at sign-up (server side – the browser cannot fake it)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 11. Dashboard statistics (per currency – GHS and NGN are never mixed)
-- ---------------------------------------------------------------------
create or replace function public._metrics(p_cur text, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_new int; v_dep numeric; v_wd numeric; v_stake numeric; v_bets int;
  v_settled int; v_won int; v_lost int; v_cash int; v_sstake numeric; v_spay numeric; v_casino numeric; v_bonus numeric;
  v_ggr numeric;
begin
  select count(*) into v_new from customer_profiles p where p.currency = p_cur and p.created_at >= p_from and p.created_at < p_to;
  select coalesce(sum(l.amount), 0) into v_dep from ledger l join customer_profiles p on p.id = l.user_id
    where p.currency = p_cur and l.type = 'deposit' and l.created_at >= p_from and l.created_at < p_to;
  select coalesce(sum(w.amount), 0) into v_wd from withdrawals w join customer_profiles p on p.id = w.user_id
    where p.currency = p_cur and w.status = 'paid' and coalesce(w.reviewed_at, w.created_at) >= p_from and coalesce(w.reviewed_at, w.created_at) < p_to;
  select coalesce(sum(b.stake), 0), count(*) into v_stake, v_bets from bets b join customer_profiles p on p.id = b.user_id
    where p.currency = p_cur and b.status <> 'void' and b.placed_at >= p_from and b.placed_at < p_to;
  select count(*), count(*) filter (where b.status = 'won'), count(*) filter (where b.status = 'lost'), count(*) filter (where b.status = 'cashed_out'),
         coalesce(sum(b.stake), 0), coalesce(sum(coalesce(b.payout, 0)), 0)
    into v_settled, v_won, v_lost, v_cash, v_sstake, v_spay
    from bets b join customer_profiles p on p.id = b.user_id
    where p.currency = p_cur and b.status in ('won','lost','cashed_out') and b.settled_at >= p_from and b.settled_at < p_to;
  select coalesce(-sum(l.amount), 0) into v_casino from ledger l join customer_profiles p on p.id = l.user_id
    where p.currency = p_cur and l.type in ('casino_stake','casino_win') and l.created_at >= p_from and l.created_at < p_to;
  select coalesce(sum(l.amount), 0) into v_bonus from ledger l join customer_profiles p on p.id = l.user_id
    where p.currency = p_cur and l.type = 'bonus' and l.created_at >= p_from and l.created_at < p_to;
  v_ggr := (v_sstake - v_spay) + v_casino;
  return jsonb_build_object('new_users', v_new, 'deposits', v_dep, 'withdrawals_paid', v_wd, 'stakes', v_stake, 'bets_placed', v_bets,
    'settled_bets', v_settled, 'winning_bets', v_won, 'losing_bets', v_lost, 'cashed_out_bets', v_cash,
    'settled_stake', v_sstake, 'settled_payout', v_spay, 'sports_ggr', v_sstake - v_spay, 'casino_ggr', v_casino,
    'ggr', v_ggr, 'bonuses', v_bonus, 'ngr', v_ggr - v_bonus);
end $$;

create or replace function public.admin_overview(p_currency text, p_from timestamptz, p_to timestamptz, p_gran text default 'day')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gran text := case when p_gran in ('day','week','month') then p_gran else 'day' end;
        v_from timestamptz; v_series jsonb; v_counts jsonb;
begin
  perform require_perm('dashboard.view');
  if p_currency not in ('GHS','NGN') then raise exception 'bad_currency'; end if;
  if p_to is null or p_from is null or p_to <= p_from then raise exception 'bad_period'; end if;
  v_from := case v_gran when 'day' then greatest(p_from, p_to - interval '120 days')
                        when 'week' then greatest(p_from, p_to - interval '400 days')
                        else greatest(p_from, p_to - interval '1100 days') end;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', b.bucket) ||
           public._metrics(p_currency, greatest(b.bucket, v_from), least(b.bucket + ('1 ' || v_gran)::interval, p_to)) order by b.bucket), '[]'::jsonb)
    into v_series
    from generate_series(date_trunc(v_gran, v_from), date_trunc(v_gran, p_to), ('1 ' || v_gran)::interval) as b(bucket);
  select jsonb_build_object(
    'users', (select count(*) from customer_profiles where currency = p_currency),
    'active_users', (select count(distinct b.user_id) from bets b join customer_profiles p on p.id = b.user_id where p.currency = p_currency and b.placed_at >= now() - interval '30 days'),
    'pending_withdrawals', (select count(*) from withdrawals w join customer_profiles p on p.id = w.user_id where p.currency = p_currency and w.status in ('pending','approved')),
    'pending_withdrawals_amount', (select coalesce(sum(w.amount), 0) from withdrawals w join customer_profiles p on p.id = w.user_id where p.currency = p_currency and w.status in ('pending','approved')),
    'open_bets', (select count(*) from bets b join customer_profiles p on p.id = b.user_id where p.currency = p_currency and b.status = 'open'),
    'player_balances', (select coalesce(sum(w.balance), 0) from wallets w join customer_profiles p on p.id = w.user_id where p.currency = p_currency),
    'agents', (select count(*) from agents),
    'agents_active', (select count(*) from agents where status = 'active'),
    'commissions_approved', (select coalesce(sum(amount), 0) from commissions where currency = p_currency and status = 'approved'),
    'commissions_pending', (select coalesce(sum(amount), 0) from commissions where currency = p_currency and status = 'pending'),
    'commissions_paid_out', (select coalesce(sum(amount), 0) from agent_withdrawals where currency = p_currency and status = 'paid'),
    'flagged_users', (select count(*) from customer_profiles where currency = p_currency and (risk_flag or status <> 'active'))
  ) into v_counts;
  return jsonb_build_object('currency', p_currency, 'gran', v_gran, 'period', public._metrics(p_currency, p_from, p_to),
    'all_time', public._metrics(p_currency, timestamptz '2000-01-01', now() + interval '1 day'), 'counts', v_counts, 'series', v_series);
end $$;

create or replace function public.admin_alerts() returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb := '[]'::jsonb;
  procedure_n int;
begin
  if auth.uid() is null or not exists (select 1 from admin_users where user_id = auth.uid() and status = 'active') then raise exception 'forbidden'; end if;
  if not staff_aal2() then raise exception 'mfa_required'; end if;
  if has_perm('withdrawals.approve') or has_perm('finance.view') then
    select count(*) into procedure_n from withdrawals where status in ('pending','approved');
    if procedure_n > 0 then v := v || jsonb_build_object('key','withdrawals','label','Withdrawals waiting for action','count',procedure_n,'severity','warn','section','finance'); end if;
    select count(*) into procedure_n from payments where status in ('failed','chargeback') and created_at > now() - interval '7 days';
    if procedure_n > 0 then v := v || jsonb_build_object('key','payments','label','Failed / charged-back payments (7d)','count',procedure_n,'severity','danger','section','finance'); end if;
  end if;
  if has_perm('users.view') then
    select count(*) into procedure_n from customer_profiles where risk_flag or status <> 'active';
    if procedure_n > 0 then v := v || jsonb_build_object('key','flagged','label','Flagged / restricted accounts','count',procedure_n,'severity','warn','section','users'); end if;
  end if;
  if has_perm('betting.settle') then
    select count(*) into procedure_n from events where status in ('scheduled','live') and kickoff < now() - interval '3 hours';
    if procedure_n > 0 then v := v || jsonb_build_object('key','settle','label','Events overdue for settlement','count',procedure_n,'severity','warn','section','betting'); end if;
  end if;
  if has_perm('commissions.approve') then
    select count(*) into procedure_n from commissions where status = 'pending';
    if procedure_n > 0 then v := v || jsonb_build_object('key','commissions','label','Commissions to review','count',procedure_n,'severity','info','section','commissions'); end if;
  end if;
  if has_perm('agent_payouts.process') then
    select count(*) into procedure_n from agent_withdrawals where status in ('pending','approved');
    if procedure_n > 0 then v := v || jsonb_build_object('key','agent_wd','label','Agent payouts waiting','count',procedure_n,'severity','warn','section','commissions'); end if;
    select count(*) into procedure_n from agents where payout_status = 'pending';
    if procedure_n > 0 then v := v || jsonb_build_object('key','agent_payout','label','Agent payment details to approve','count',procedure_n,'severity','info','section','commissions'); end if;
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- 12. User management
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users(p_search text default null, p_status text default null, p_currency text default null, p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v jsonb;
begin
  perform require_perm('users.view');
  with f as (
    select p.id, coalesce(p.email, au.email) as email, p.phone, p.full_name, p.currency, p.status, p.kyc_status, p.risk_flag, p.created_at, coalesce(w.balance, 0) as balance
    from customer_profiles p left join auth.users au on au.id = p.id left join wallets w on w.user_id = p.id
    where (coalesce(p_search, '') = '' or p.id::text ilike '%' || p_search || '%' or coalesce(p.email, au.email) ilike '%' || p_search || '%'
           or p.phone ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or p.status = p_status)
      and (coalesce(p_currency, '') = '' or p.currency = p_currency))
  select jsonb_build_object('total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (select * from f order by created_at desc limit least(coalesce(p_limit, 25), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb)) into v;
  return v;
end $$;

create or replace function public.admin_user_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v jsonb; v_cur text;
begin
  perform require_perm('users.view');
  select currency into v_cur from customer_profiles where id = p_id;
  if v_cur is null then raise exception 'user_not_found'; end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(t) from (select p.id, coalesce(p.email, au.email) as email, p.phone, p.full_name, p.currency, p.status, p.status_reason, p.kyc_status, p.kyc_note,
                 p.risk_flag, p.risk_note, p.created_at, p.referred_by, p.self_excluded_until from profiles p left join auth.users au on au.id = p.id where p.id = p_id) t),
    'balance', (select balance from wallets where user_id = p_id),
    'totals', jsonb_build_object(
       'deposits', (select coalesce(sum(amount), 0) from ledger where user_id = p_id and type = 'deposit'),
       'withdrawals_paid', (select coalesce(sum(amount), 0) from withdrawals where user_id = p_id and status = 'paid'),
       'stakes', (select coalesce(sum(stake), 0) from bets where user_id = p_id and status <> 'void'),
       'bets', (select count(*) from bets where user_id = p_id),
       'settled_stake', (select coalesce(sum(stake), 0) from bets where user_id = p_id and status in ('won','lost','cashed_out')),
       'settled_payout', (select coalesce(sum(coalesce(payout, 0)), 0) from bets where user_id = p_id and status in ('won','lost','cashed_out')),
       'bonuses', (select coalesce(sum(amount), 0) from ledger where user_id = p_id and type = 'bonus')),
    'referral', (select to_jsonb(t) from (select g.username as agent, g.referral_code, r.status, r.registered_at, r.flags from referrals r join agents g on g.id = r.agent_id where r.user_id = p_id) t),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from (select id, amount, method, status, created_at, reject_reason from withdrawals where user_id = p_id order by created_at desc limit 20) w), '[]'::jsonb)
  ) into v;
  perform log_admin('user.view', 'user', p_id::text, '{}');
  return v;
end $$;

create or replace function public.admin_user_ledger(p_id uuid, p_limit int default 100) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('users.view');
  return coalesce((select jsonb_agg(to_jsonb(t)) from (select id, created_at, type, amount, balance_after, ref, note from ledger where user_id = p_id order by created_at desc, id desc limit least(coalesce(p_limit, 100), 500)) t), '[]'::jsonb);
end $$;

create or replace function public.admin_set_user_status(p_id uuid, p_status text, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform require_perm('users.manage');
  if p_status not in ('active','restricted','suspended') then raise exception 'bad_status'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select status into v_old from customer_profiles where id = p_id;
  if v_old is null then raise exception 'user_not_found'; end if;
  update profiles set status = p_status, status_reason = case when p_status = 'active' then null else trim(p_reason) end where id = p_id;
  perform log_admin('user.status', 'user', p_id::text, jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_set_kyc(p_id uuid, p_status text, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform require_perm('users.kyc');
  if p_status not in ('none','pending','verified','rejected') then raise exception 'bad_status'; end if;
  select kyc_status into v_old from customer_profiles where id = p_id;
  if v_old is null then raise exception 'user_not_found'; end if;
  update profiles set kyc_status = p_status, kyc_note = p_note where id = p_id;
  perform log_admin('user.kyc', 'user', p_id::text, jsonb_build_object('from', v_old, 'to', p_status, 'note', p_note));
end $$;

create or replace function public.admin_flag_user(p_id uuid, p_flag boolean, p_note text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('users.manage');
  if not exists (select 1 from customer_profiles where id = p_id) then raise exception 'user_not_found'; end if;
  if p_flag and length(trim(coalesce(p_note, ''))) < 5 then raise exception 'reason_required'; end if;
  update profiles set risk_flag = p_flag, risk_note = case when p_flag then trim(p_note) else null end where id = p_id;
  perform log_admin(case when p_flag then 'user.flag' else 'user.unflag' end, 'user', p_id::text, jsonb_build_object('note', p_note));
end $$;

-- ---------------------------------------------------------------------
-- 13. Finance
-- ---------------------------------------------------------------------
create or replace function public.admin_list_withdrawals(p_status text default null, p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform require_perm('finance.view');
  return jsonb_build_object(
    'total', (select count(*) from withdrawals w where coalesce(p_status, '') = '' or w.status = p_status),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select w.id, w.created_at, w.amount, w.method, w.account, w.status, w.reject_reason, w.payout_ref, w.reviewed_at, w.first_approver,
             p.currency, coalesce(p.email, au.email) as email, p.phone, p.kyc_status, p.status as user_status, coalesce(wl.balance, 0) as balance
      from withdrawals w join profiles p on p.id = w.user_id left join auth.users au on au.id = w.user_id left join wallets wl on wl.user_id = w.user_id
      where coalesce(p_status, '') = '' or w.status = p_status
      order by case when w.status in ('pending','approved') then 0 else 1 end, w.created_at desc
      limit least(coalesce(p_limit, 25), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_process_withdrawal(p_id uuid, p_action text, p_note text default null, p_ref text default null) returns text
language plpgsql security definer set search_path = public as $$
declare w public.withdrawals%rowtype; v_cur text; v_thr numeric;
begin
  perform require_perm('withdrawals.approve');
  select * into w from withdrawals where id = p_id for update;
  if not found then raise exception 'withdrawal_not_found'; end if;
  select currency into v_cur from profiles where id = w.user_id;
  if p_action = 'approve' then
    if w.status <> 'pending' then raise exception 'not_actionable'; end if;
    select coalesce((value ->> v_cur)::numeric, 0) into v_thr from settings where key = 'withdrawal_dual_approval';
    if v_thr > 0 and w.amount >= v_thr then
      if w.first_approver is null then
        update withdrawals set first_approver = auth.uid() where id = p_id;
        perform log_admin('withdrawal.first_approval', 'withdrawal', p_id::text, jsonb_build_object('amount', w.amount, 'note', p_note));
        return 'awaiting_second_approver';
      end if;
      if w.first_approver = auth.uid() then raise exception 'second_approver_required'; end if;
    end if;
    update withdrawals set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    perform log_admin('withdrawal.approve', 'withdrawal', p_id::text, jsonb_build_object('amount', w.amount, 'currency', v_cur, 'note', p_note));
    return 'approved';
  elsif p_action = 'pay' then
    if w.status <> 'approved' then raise exception 'must_be_approved_first'; end if;
    if length(trim(coalesce(p_ref, ''))) < 3 then raise exception 'payout_reference_required'; end if;
    update withdrawals set status = 'paid', payout_ref = trim(p_ref), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    perform log_admin('withdrawal.paid', 'withdrawal', p_id::text, jsonb_build_object('amount', w.amount, 'currency', v_cur, 'ref', p_ref));
    return 'paid';
  elsif p_action = 'reject' then
    if w.status not in ('pending','approved') then raise exception 'not_actionable'; end if;
    if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'reason_required'; end if;
    update withdrawals set status = 'rejected', reject_reason = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
    perform public.credit_wallet(w.user_id, w.amount, 'refund', 'wdrej:' || p_id::text, 'Withdrawal rejected – returned');
    perform log_admin('withdrawal.reject', 'withdrawal', p_id::text, jsonb_build_object('amount', w.amount, 'currency', v_cur, 'reason', p_note));
    return 'rejected';
  end if;
  raise exception 'bad_action';
end $$;

create or replace function public.admin_list_payments(p_status text default null, p_kind text default null, p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform require_perm('finance.view');
  return jsonb_build_object(
    'total', (select count(*) from payments x where (coalesce(p_status, '') = '' or x.status = p_status) and (coalesce(p_kind, '') = '' or x.kind = p_kind)),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select x.id, x.created_at, x.kind, x.provider, x.provider_ref, x.amount, x.currency, x.status, x.reconciled, x.note, coalesce(p.email, au.email) as email
      from payments x left join profiles p on p.id = x.user_id left join auth.users au on au.id = x.user_id
      where (coalesce(p_status, '') = '' or x.status = p_status) and (coalesce(p_kind, '') = '' or x.kind = p_kind)
      order by x.created_at desc limit least(coalesce(p_limit, 25), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_list_payment_events(p_limit int default 50) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('finance.view');
  return coalesce((select jsonb_agg(to_jsonb(t)) from (select id, received_at, provider, event, provider_ref, processed, error from payment_events order by received_at desc limit least(coalesce(p_limit, 50), 200)) t), '[]'::jsonb);
end $$;

create or replace function public.admin_list_ledger(p_search text default null, p_type text default null, p_currency text default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform require_perm('finance.view');
  return jsonb_build_object(
    'total', (select count(*) from ledger l join profiles p on p.id = l.user_id where (coalesce(p_type, '') = '' or l.type = p_type) and (coalesce(p_currency, '') = '' or p.currency = p_currency)
              and (coalesce(p_search, '') = '' or l.ref ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select l.id, l.created_at, l.type, l.amount, l.balance_after, l.ref, l.note, p.currency, coalesce(p.email, au.email) as email
      from ledger l join profiles p on p.id = l.user_id left join auth.users au on au.id = l.user_id
      where (coalesce(p_type, '') = '' or l.type = p_type) and (coalesce(p_currency, '') = '' or p.currency = p_currency)
        and (coalesce(p_search, '') = '' or l.ref ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
      order by l.created_at desc, l.id desc limit least(coalesce(p_limit, 50), 200) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_reconcile_summary(p_currency text, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('finance.view');
  return jsonb_build_object(
    'gateway_total', (select coalesce(sum(amount), 0) from payments where kind = 'deposit' and status = 'succeeded' and currency = p_currency and created_at >= p_from and created_at < p_to),
    'ledger_total', (select coalesce(sum(l.amount), 0) from ledger l join profiles p on p.id = l.user_id where l.type = 'deposit' and p.currency = p_currency and l.created_at >= p_from and l.created_at < p_to),
    'payments_missing_in_ledger', coalesce((select jsonb_agg(to_jsonb(t)) from (select id, created_at, provider, provider_ref, amount from payments x
        where x.kind = 'deposit' and x.status = 'succeeded' and x.currency = p_currency and x.created_at >= p_from and x.created_at < p_to
          and not exists (select 1 from ledger l where l.type = 'deposit' and l.ref = x.provider_ref) order by created_at limit 100) t), '[]'::jsonb),
    'ledger_missing_payment', coalesce((select jsonb_agg(to_jsonb(t)) from (select l.id, l.created_at, l.ref, l.amount from ledger l join profiles p on p.id = l.user_id
        where l.type = 'deposit' and p.currency = p_currency and l.created_at >= p_from and l.created_at < p_to
          and not exists (select 1 from payments x where x.provider_ref = l.ref and x.status = 'succeeded') order by l.created_at limit 100) t), '[]'::jsonb));
end $$;

create or replace function public.admin_reconcile_payment(p_id uuid, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('payments.reconcile');
  update payments set reconciled = true, reconciled_by = auth.uid(), reconciled_at = now(), note = coalesce(p_note, note) where id = p_id;
  if not found then raise exception 'payment_not_found'; end if;
  perform log_admin('payment.reconcile', 'payment', p_id::text, jsonb_build_object('note', p_note));
end $$;

create or replace function public.admin_record_chargeback(p_id uuid, p_note text) returns void language plpgsql security definer set search_path = public as $$
declare x public.payments%rowtype; v_bal numeric; v_debit numeric;
begin
  perform require_perm('payments.reconcile');
  if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into x from payments where id = p_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if x.kind <> 'deposit' or x.status <> 'succeeded' or x.user_id is null then raise exception 'not_chargeable'; end if;
  select balance into v_bal from wallets where user_id = x.user_id for update;
  v_debit := least(x.amount, coalesce(v_bal, 0));
  if v_debit > 0 then perform public.credit_wallet(x.user_id, -v_debit, 'chargeback', 'cb:' || p_id::text, p_note);
  else insert into ledger (user_id, type, amount, balance_after, ref, note) values (x.user_id, 'chargeback', 0.01, coalesce(v_bal,0) + 0.01, 'cb:' || p_id::text, p_note) on conflict do nothing; end if;
  update payments set status = 'chargeback', note = p_note where id = p_id;
  perform log_admin('payment.chargeback', 'payment', p_id::text, jsonb_build_object('amount', x.amount, 'debited', v_debit, 'note', p_note));
end $$;

-- ---------------------------------------------------------------------
-- 14. Betting management
-- ---------------------------------------------------------------------
create or replace function public.leg_result(p_market text, p_sel text, p_line numeric, h int, a int) returns text language plpgsql immutable as $$
declare o text; tot int := h + a; diff numeric;
begin
  o := case when h > a then '1' when h = a then 'X' else '2' end;
  if p_market = '1x2' then return case when p_sel = o then 'won' else 'lost' end;
  elsif p_market = 'dc' then return case when (p_sel = '1X' and o in ('1','X')) or (p_sel = '12' and o in ('1','2')) or (p_sel = 'X2' and o in ('X','2')) then 'won' else 'lost' end;
  elsif p_market in ('ou','tot') then
    if p_line is null then if p_market = 'ou' then p_line := 2.5; else raise exception 'missing_line'; end if; end if;
    if tot = p_line then return 'void'; end if;
    return case when (p_sel = 'O' and tot > p_line) or (p_sel = 'U' and tot < p_line) then 'won' else 'lost' end;
  elsif p_market = 'btts' then return case when (p_sel = 'GG' and h > 0 and a > 0) or (p_sel = 'NG' and not (h > 0 and a > 0)) then 'won' else 'lost' end;
  elsif p_market = 'ml' then
    if h = a then return 'void'; end if;
    return case when (p_sel = '1' and h > a) or (p_sel = '2' and a > h) then 'won' else 'lost' end;
  elsif p_market = 'hcp' then
    if p_line is null then raise exception 'missing_line'; end if;
    diff := h + p_line - a;
    if diff = 0 then return 'void'; end if;
    return case when (p_sel = 'H1' and diff > 0) or (p_sel = 'H2' and diff < 0) then 'won' else 'lost' end;
  end if;
  raise exception 'unknown_market: %', p_market;
end $$;

-- same as before but WITHOUT the hard-coded payout cap (the cap is now an admin setting)
create or replace function public.settle_bet_final(p_bet uuid, p_status text, p_payout numeric default 0) returns void
language plpgsql security definer set search_path = public as $$
declare v public.bets%rowtype;
begin
  select * into v from public.bets where id = p_bet for update;
  if not found then raise exception 'bet_not_found'; end if;
  if v.status <> 'open' then return; end if;
  if p_status = 'won' then
    perform public.credit_wallet(v.user_id, p_payout, 'bet_win', 'win:' || p_bet, 'Bet won');
    update public.bets set status = 'won', payout = p_payout, settled_at = now() where id = p_bet;
  elsif p_status = 'void' then
    perform public.credit_wallet(v.user_id, v.stake, 'refund', 'void:' || p_bet, 'Bet void – stake returned');
    update public.bets set status = 'void', payout = v.stake, settled_at = now() where id = p_bet;
  elsif p_status = 'lost' then
    update public.bets set status = 'lost', payout = 0, settled_at = now() where id = p_bet;
  else raise exception 'bad_status'; end if;
end $$;
revoke all on function public.settle_bet_final(uuid, text, numeric) from public, anon, authenticated;

create or replace function public._settle_event(p_event text, p_h int, p_a int, p_void boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare lg record; b public.bets%rowtype; v_res text; v_won int := 0; v_lost int := 0; v_void int := 0; v_open int := 0;
        v_n int; v_prod numeric; v_pay numeric; v_cap numeric; v_cur text;
begin
  for lg in select l.id, l.market, l.selection, coalesce(l.line, o.line) as line from bet_legs l
            left join odds o on o.event_id = l.event_id and o.market = l.market and o.selection = l.selection
            where l.event_id = p_event and l.result is null loop
    v_res := case when p_void then 'void' else public.leg_result(lg.market, lg.selection, lg.line, p_h, p_a) end;
    update bet_legs set result = v_res where id = lg.id;
  end loop;
  for b in select * from bets where status = 'open' and id in (select bet_id from bet_legs where event_id = p_event) for update loop
    if exists (select 1 from bet_legs where bet_id = b.id and result = 'lost') then
      perform public.settle_bet_final(b.id, 'lost', 0); v_lost := v_lost + 1;
    elsif exists (select 1 from bet_legs where bet_id = b.id and result is null) then
      v_open := v_open + 1;
    else
      select count(*) filter (where result = 'won'), coalesce(exp(sum(ln(odds::numeric)) filter (where result = 'won')), 1) into v_n, v_prod from bet_legs where bet_id = b.id;
      if v_n = 0 then perform public.settle_bet_final(b.id, 'void', 0); v_void := v_void + 1;
      else
        select currency into v_cur from profiles where id = b.user_id;
        select (value ->> v_cur)::numeric into v_cap from settings where key = 'max_payout';
        v_pay := round(b.stake * round(v_prod, 2) * (1 + case when b.kind = 'multiple' then public.boost_for(v_n) else 0 end / 100), 2);
        if v_cap is not null then v_pay := least(v_pay, v_cap); end if;
        perform public.settle_bet_final(b.id, 'won', v_pay); v_won := v_won + 1;
      end if;
    end if;
  end loop;
  insert into settlements (event_id, by_user, home_score, away_score, voided, bets_won, bets_lost, bets_void, bets_open)
  values (p_event, auth.uid(), p_h, p_a, p_void, v_won, v_lost, v_void, v_open);
  return jsonb_build_object('won', v_won, 'lost', v_lost, 'void', v_void, 'still_open', v_open);
end $$;

create or replace function public.admin_settle_event(p_event text, p_home int, p_away int) returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.events%rowtype; r jsonb;
begin
  perform require_perm('betting.settle');
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 then raise exception 'bad_score'; end if;
  select * into ev from events where id = p_event for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status in ('finished','cancelled') then raise exception 'event_already_settled'; end if;
  update events set status = 'finished', home_score = p_home, away_score = p_away, updated_at = now() where id = p_event;
  r := public._settle_event(p_event, p_home, p_away, false);
  perform log_admin('event.settle', 'event', p_event, jsonb_build_object('home', p_home, 'away', p_away) || r);
  return r;
end $$;

create or replace function public.admin_cancel_event(p_event text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.events%rowtype; r jsonb;
begin
  perform require_perm('betting.settle');
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into ev from events where id = p_event for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status in ('finished','cancelled') then raise exception 'event_already_settled'; end if;
  update events set status = 'cancelled', updated_at = now() where id = p_event;
  r := public._settle_event(p_event, 0, 0, true);
  perform log_admin('event.cancel', 'event', p_event, jsonb_build_object('reason', p_reason) || r);
  return r;
end $$;

create or replace function public.admin_correct_bet(p_bet uuid, p_status text, p_payout numeric, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare b public.bets%rowtype; v_old numeric; v_new numeric; v_delta numeric; v_n int;
begin
  perform require_perm('bets.correct');
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'reason_required_min_10_chars'; end if;
  if p_status not in ('won','lost','void','cashed_out') then raise exception 'bad_status'; end if;
  select * into b from bets where id = p_bet for update;
  if not found then raise exception 'bet_not_found'; end if;
  if b.status = 'open' then raise exception 'bet_still_open_use_settlement'; end if;
  v_old := case when b.status in ('won','cashed_out','void') then coalesce(b.payout, 0) else 0 end;
  v_new := case p_status when 'lost' then 0 when 'void' then b.stake else coalesce(p_payout, 0) end;
  if v_new < 0 then raise exception 'bad_payout'; end if;
  v_delta := round(v_new - v_old, 2);
  select count(*) + 1 into v_n from bet_corrections where bet_id = p_bet;
  if v_delta <> 0 then perform public.credit_wallet(b.user_id, v_delta, 'adjustment', 'corr:' || p_bet::text || ':' || v_n, left(p_reason, 200)); end if;
  perform set_config('app.bet_correction', 'on', true);
  update bets set status = p_status, payout = v_new, settled_at = now() where id = p_bet;
  perform set_config('app.bet_correction', 'off', true);
  insert into bet_corrections (bet_id, by_user, old_status, old_payout, new_status, new_payout, delta, reason) values (p_bet, auth.uid(), b.status, b.payout, p_status, v_new, v_delta, p_reason);
  perform log_admin('bet.correct', 'bet', p_bet::text, jsonb_build_object('from', b.status, 'to', p_status, 'old_payout', b.payout, 'new_payout', v_new, 'delta', v_delta, 'reason', p_reason));
end $$;

create or replace function public.admin_list_events(p_status text default null, p_search text default null, p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('betting.view');
  return jsonb_build_object(
    'total', (select count(*) from events e where (coalesce(p_status, '') = '' or e.status = p_status) and (coalesce(p_search, '') = '' or e.home ilike '%' || p_search || '%' or e.away ilike '%' || p_search || '%' or e.league ilike '%' || p_search || '%')),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select e.id, e.sport, e.home, e.away, e.league, e.kickoff, e.status, e.home_score, e.away_score,
             (select count(*) from odds o where o.event_id = e.id) as markets,
             (select count(*) from odds o where o.event_id = e.id and o.suspended) as suspended,
             (select count(distinct bl.bet_id) from bet_legs bl join bets bt on bt.id = bl.bet_id where bl.event_id = e.id and bt.status = 'open') as open_bets
      from events e where (coalesce(p_status, '') = '' or e.status = p_status) and (coalesce(p_search, '') = '' or e.home ilike '%' || p_search || '%' or e.away ilike '%' || p_search || '%' or e.league ilike '%' || p_search || '%')
      order by e.kickoff desc limit least(coalesce(p_limit, 25), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_upsert_event(p_id text, p_sport text, p_home text, p_away text, p_league text, p_kickoff timestamptz) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text := nullif(trim(coalesce(p_id, '')), '');
begin
  perform require_perm('betting.manage');
  if p_sport not in ('football','v-football','basketball','v-basketball') then raise exception 'bad_sport'; end if;
  if length(trim(coalesce(p_home, ''))) < 2 or length(trim(coalesce(p_away, ''))) < 2 or length(trim(coalesce(p_league, ''))) < 2 then raise exception 'missing_fields'; end if;
  if v_id is null then
    v_id := 'ev' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    insert into events (id, sport, home, away, league, kickoff) values (v_id, p_sport, trim(p_home), trim(p_away), trim(p_league), p_kickoff);
    perform log_admin('event.create', 'event', v_id, jsonb_build_object('home', p_home, 'away', p_away, 'league', p_league, 'kickoff', p_kickoff));
  else
    update events set sport = p_sport, home = trim(p_home), away = trim(p_away), league = trim(p_league), kickoff = p_kickoff, updated_at = now()
    where id = v_id and status in ('scheduled','live');
    if not found then raise exception 'event_not_editable'; end if;
    perform log_admin('event.update', 'event', v_id, jsonb_build_object('home', p_home, 'away', p_away, 'league', p_league, 'kickoff', p_kickoff));
  end if;
  return v_id;
end $$;

create or replace function public.admin_set_event_status(p_id text, p_status text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('betting.manage');
  if p_status not in ('scheduled','live') then raise exception 'use_settle_or_cancel'; end if;
  update events set status = p_status, updated_at = now() where id = p_id and status in ('scheduled','live');
  if not found then raise exception 'event_not_editable'; end if;
  perform log_admin('event.status', 'event', p_id, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_list_odds(p_event text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('betting.view');
  return coalesce((select jsonb_agg(to_jsonb(o) order by o.market, o.selection) from (select market, selection, label, price, line, suspended, updated_at from odds where event_id = p_event) o), '[]'::jsonb);
end $$;

create or replace function public.admin_upsert_odds(p_event text, p_market text, p_selection text, p_label text, p_price numeric, p_line numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_old numeric;
begin
  perform require_perm('betting.manage');
  if p_price is null or p_price < 1.01 or p_price > 1000 then raise exception 'bad_price'; end if;
  if p_market not in ('1x2','dc','ou','btts','ml','hcp','tot') then raise exception 'bad_market'; end if;
  if not exists (select 1 from events where id = p_event and status in ('scheduled','live')) then raise exception 'event_not_editable'; end if;
  select price into v_old from odds where event_id = p_event and market = p_market and selection = p_selection;
  insert into odds (event_id, market, selection, label, price, line) values (p_event, p_market, p_selection, coalesce(nullif(trim(p_label), ''), p_selection), round(p_price, 2), p_line)
  on conflict (event_id, market, selection) do update set label = excluded.label, price = excluded.price, line = excluded.line, updated_at = now();
  perform log_admin('odds.set', 'event', p_event, jsonb_build_object('market', p_market, 'selection', p_selection, 'from', v_old, 'to', p_price, 'line', p_line));
end $$;

create or replace function public.admin_set_market_suspended(p_event text, p_market text, p_suspended boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('betting.manage');
  update odds set suspended = p_suspended, updated_at = now() where event_id = p_event and (coalesce(p_market, '') = '' or market = p_market);
  perform log_admin(case when p_suspended then 'market.suspend' else 'market.resume' end, 'event', p_event, jsonb_build_object('market', p_market));
end $$;

create or replace function public.admin_list_bets(p_status text default null, p_search text default null, p_user uuid default null, p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  if p_user is null then perform require_perm('betting.view'); else perform require_perm('users.view'); end if;
  return jsonb_build_object(
    'total', (select count(*) from bets b left join profiles p on p.id = b.user_id where (coalesce(p_status, '') = '' or b.status = p_status) and (p_user is null or b.user_id = p_user)
              and (coalesce(p_search, '') = '' or b.id::text ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select b.id, b.placed_at, b.settled_at, b.kind, b.stake, b.total_odds, b.potential_win, b.status, b.payout, p.currency, coalesce(p.email, au.email) as email,
             (select count(*) from bet_corrections c where c.bet_id = b.id) as corrections,
             coalesce((select jsonb_agg(jsonb_build_object('event', coalesce(e.home || ' vs ' || e.away, l.event_id), 'market', l.market, 'selection', l.selection, 'odds', l.odds, 'result', l.result) order by l.id)
                       from bet_legs l left join events e on e.id = l.event_id where l.bet_id = b.id), '[]'::jsonb) as legs
      from bets b left join profiles p on p.id = b.user_id left join auth.users au on au.id = b.user_id
      where (coalesce(p_status, '') = '' or b.status = p_status) and (p_user is null or b.user_id = p_user)
        and (coalesce(p_search, '') = '' or b.id::text ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
      order by b.placed_at desc limit least(coalesce(p_limit, 25), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_get_settings() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('dashboard.view');
  return coalesce((select jsonb_object_agg(key, value) from settings), '{}'::jsonb);
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v_old jsonb; c text;
begin
  perform require_perm('settings.edit');
  if p_key not in ('stake_limits','max_payout','qualification','withdrawal_dual_approval','agent_min_withdrawal') then raise exception 'unknown_setting'; end if;
  if p_key = 'stake_limits' then
    foreach c in array array['GHS','NGN'] loop
      if (p_value -> c ->> 'min') is null or (p_value -> c ->> 'max') is null or (p_value -> c ->> 'min')::numeric <= 0 or (p_value -> c ->> 'max')::numeric < (p_value -> c ->> 'min')::numeric then raise exception 'bad_stake_limits'; end if;
    end loop;
  elsif p_key in ('max_payout','withdrawal_dual_approval','agent_min_withdrawal') then
    foreach c in array array['GHS','NGN'] loop
      if (p_value ->> c) is null or (p_value ->> c)::numeric < 0 then raise exception 'bad_value'; end if;
    end loop;
  elsif p_key = 'qualification' then
    if (p_value ->> 'window_days') is null or (p_value ->> 'window_days')::int < 1 or (p_value ->> 'window_days')::int > 365 then raise exception 'bad_window'; end if;
  end if;
  select value into v_old from settings where key = p_key;
  insert into settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform log_admin('settings.update', 'setting', p_key, jsonb_build_object('from', v_old, 'to', p_value));
end $$;

-- ---------------------------------------------------------------------
-- 15. Agents, referrals & commissions
-- ---------------------------------------------------------------------
create or replace function public._agent_balance(p_agent uuid, p_cur text) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from commissions where agent_id = p_agent and currency = p_cur and status = 'approved'), 0)
       - coalesce((select sum(amount) from agent_withdrawals where agent_id = p_agent and currency = p_cur and status in ('pending','approved','paid')), 0) $$;

create or replace function public.admin_create_agent(p_user_id uuid, p_username text, p_full_name text, p_email text, p_phone text,
  p_model text, p_cpa jsonb, p_rev numeric, p_period text, p_code text default null) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_user text := lower(trim(coalesce(p_username, ''))); v_code text := upper(nullif(trim(coalesce(p_code, '')), '')); v_au auth.users%rowtype; v_row public.agents%rowtype; i int := 0;
begin
  perform require_perm('agents.manage');
  if v_user !~ '^[a-z0-9_]{3,24}$' then raise exception 'bad_username'; end if;
  if p_model not in ('cpa','revshare','hybrid') then raise exception 'bad_model'; end if;
  if p_period not in ('weekly','monthly') then raise exception 'bad_period'; end if;
  if coalesce(p_rev, 0) < 0 or coalesce(p_rev, 0) > 100 then raise exception 'bad_rate'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 or position('@' in coalesce(p_email, '')) < 2 then raise exception 'missing_fields'; end if;
  select * into v_au from auth.users where id = p_user_id;
  if not found then raise exception 'auth_user_not_found'; end if;
  if lower(coalesce(v_au.email, '')) <> lower(trim(p_email)) then raise exception 'email_mismatch'; end if;
  if v_au.created_at < now() - interval '60 minutes' then raise exception 'auth_user_not_new'; end if;
  if exists (select 1 from agents where user_id = p_user_id) or exists (select 1 from admin_users where user_id = p_user_id) then raise exception 'already_staff'; end if;
  if exists (select 1 from ledger where user_id = p_user_id) or exists (select 1 from bets where user_id = p_user_id) then raise exception 'account_has_activity'; end if;
  if exists (select 1 from agents where lower(username) = v_user) then raise exception 'username_taken'; end if;
  if v_code is null then
    loop
      v_code := 'AGENT' || lpad(nextval('agent_code_seq')::text, 3, '0');
      exit when not exists (select 1 from agents where upper(referral_code) = v_code);
      i := i + 1; exit when i > 50;
    end loop;
  elsif v_code !~ '^[A-Z0-9]{4,16}$' then raise exception 'bad_code';
  elsif exists (select 1 from agents where upper(referral_code) = v_code) then raise exception 'code_taken';
  end if;
  insert into agents (user_id, username, full_name, email, phone, referral_code, model, cpa_amount, rev_share_pct, period, created_by)
  values (p_user_id, v_user, trim(p_full_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''), v_code, p_model,
          jsonb_build_object('GHS', coalesce((p_cpa ->> 'GHS')::numeric, 0), 'NGN', coalesce((p_cpa ->> 'NGN')::numeric, 0)), coalesce(p_rev, 0), p_period, auth.uid())
  returning * into v_row;
  perform log_admin('agent.create', 'agent', v_row.id::text, jsonb_build_object('username', v_user, 'code', v_code, 'model', p_model, 'cpa', p_cpa, 'rev', p_rev, 'period', p_period));
  return jsonb_build_object('id', v_row.id, 'username', v_row.username, 'referral_code', v_row.referral_code);
end $$;

create or replace function public.admin_update_agent(p_id uuid, p_full_name text, p_phone text, p_model text, p_cpa jsonb, p_rev numeric, p_period text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.agents%rowtype;
begin
  perform require_perm('agents.manage');
  select * into g from agents where id = p_id for update;
  if not found then raise exception 'agent_not_found'; end if;
  if p_model not in ('cpa','revshare','hybrid') then raise exception 'bad_model'; end if;
  if p_period not in ('weekly','monthly') then raise exception 'bad_period'; end if;
  if coalesce(p_rev, 0) < 0 or coalesce(p_rev, 0) > 100 then raise exception 'bad_rate'; end if;
  update agents set full_name = coalesce(nullif(trim(p_full_name), ''), full_name), phone = nullif(trim(coalesce(p_phone, '')), ''), model = p_model,
    cpa_amount = jsonb_build_object('GHS', coalesce((p_cpa ->> 'GHS')::numeric, 0), 'NGN', coalesce((p_cpa ->> 'NGN')::numeric, 0)), rev_share_pct = coalesce(p_rev, 0), period = p_period where id = p_id;
  perform log_admin('agent.update', 'agent', p_id::text, jsonb_build_object('from', jsonb_build_object('model', g.model, 'cpa', g.cpa_amount, 'rev', g.rev_share_pct, 'period', g.period),
                    'to', jsonb_build_object('model', p_model, 'cpa', p_cpa, 'rev', p_rev, 'period', p_period)));
end $$;

create or replace function public.admin_set_agent_status(p_id uuid, p_status text, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform require_perm('agents.manage');
  if p_status not in ('active','suspended','deactivated') then raise exception 'bad_status'; end if;
  select status into v_old from agents where id = p_id;
  if v_old is null then raise exception 'agent_not_found'; end if;
  if p_status <> 'active' and length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update agents set status = p_status where id = p_id;
  perform log_admin('agent.status', 'agent', p_id::text, jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_list_agents() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('agents.view');
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
    select g.id, g.username, g.full_name, g.email, g.phone, g.referral_code, g.status, g.model, g.cpa_amount, g.rev_share_pct, g.period, g.payout_status, g.created_at, g.last_login_at,
      (select count(*) from referrals r where r.agent_id = g.id) as referrals,
      (select count(*) from referrals r where r.agent_id = g.id and r.status = 'qualified') as qualified,
      (select count(*) from referrals r where r.agent_id = g.id and r.status = 'disqualified') as disqualified,
      (select coalesce(jsonb_object_agg(c.currency, c.s), '{}'::jsonb) from (select currency, sum(amount) s from commissions where agent_id = g.id and status = 'approved' group by currency) c) as approved,
      (select coalesce(jsonb_object_agg(c.currency, c.s), '{}'::jsonb) from (select currency, sum(amount) s from commissions where agent_id = g.id and status = 'pending' group by currency) c) as pending
    from agents g) t), '[]'::jsonb);
end $$;

create or replace function public.admin_agent_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v jsonb;
begin
  perform require_perm('agents.view');
  select to_jsonb(g) - 'user_id' into v from agents g where g.id = p_id;
  if v is null then raise exception 'agent_not_found'; end if;
  return jsonb_build_object('agent', v,
    'referrals', coalesce((select jsonb_agg(to_jsonb(t) order by t.registered_at desc) from (
        select r.user_id, r.registered_at, r.status, r.qualified_at, r.disqualified_reason, r.flags, p.currency, coalesce(p.email, au.email) as email, p.status as user_status,
               (select coalesce(sum(amount), 0) from ledger l where l.user_id = r.user_id and l.type = 'deposit') as deposits
        from referrals r join profiles p on p.id = r.user_id left join auth.users au on au.id = r.user_id where r.agent_id = p_id order by r.registered_at desc limit 200) t), '[]'::jsonb),
    'balances', jsonb_build_object('GHS', public._agent_balance(p_id, 'GHS'), 'NGN', public._agent_balance(p_id, 'NGN')),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) order by w.requested_at desc) from (select id, requested_at, currency, amount, status, payout_ref, reject_reason from agent_withdrawals where agent_id = p_id order by requested_at desc limit 50) w), '[]'::jsonb));
end $$;

create or replace function public.admin_disqualify_referral(p_user uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('agents.manage');
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update referrals set status = 'disqualified', disqualified_reason = trim(p_reason) where user_id = p_user and status <> 'disqualified';
  if not found then raise exception 'referral_not_found'; end if;
  update commissions set status = 'void', note = 'Customer disqualified: ' || trim(p_reason) where user_id = p_user and kind = 'cpa' and status = 'pending';
  perform log_admin('referral.disqualify', 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_calculate_commissions(p_from timestamptz, p_to timestamptz, p_agent uuid default null, p_commit boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q jsonb; v_win int; v_kyc boolean; a public.agents%rowtype; r record; cur text; out jsonb := '[]'::jsonb; el jsonb; act text;
  v_dep numeric; v_cb boolean; v_stk numeric; v_ok boolean; v_cpa numeric; v_new uuid[]; v_ids uuid[]; v_ngr numeric; v_carry numeric; v_base numeric; v_amt numeric; v_cnt int;
  v_exist public.commissions%rowtype;
begin
  if p_commit then perform require_perm('commissions.calculate'); else perform require_perm('commissions.view'); end if;
  if p_from is null or p_to is null or p_to <= p_from then raise exception 'bad_period'; end if;
  if p_to - p_from > interval '400 days' then raise exception 'period_too_long'; end if;
  select value into q from settings where key = 'qualification';
  v_win := coalesce((q ->> 'window_days')::int, 30);
  v_kyc := coalesce((q ->> 'require_kyc')::boolean, false);

  for a in select * from agents where status = 'active' and (p_agent is null or id = p_agent) order by created_at loop
    v_new := '{}';
    -- A) qualification of new referrals (real deposit + real settled stake, clean account, no chargebacks)
    for r in select rf.user_id, rf.registered_at, p.currency, p.status as pstatus, p.risk_flag, p.kyc_status
             from referrals rf join profiles p on p.id = rf.user_id where rf.agent_id = a.id and rf.status = 'registered' and rf.registered_at < p_to loop
      v_ok := false;
      if r.pstatus = 'active' and not r.risk_flag and (not v_kyc or r.kyc_status = 'verified') then
        select coalesce(sum(amount), 0) into v_dep from ledger where user_id = r.user_id and type = 'deposit' and created_at >= r.registered_at and created_at < r.registered_at + make_interval(days => v_win);
        select exists (select 1 from ledger where user_id = r.user_id and type = 'chargeback') into v_cb;
        select coalesce(sum(stake), 0) into v_stk from bets where user_id = r.user_id and status in ('won','lost','cashed_out') and settled_at >= r.registered_at and settled_at < r.registered_at + make_interval(days => v_win);
        v_ok := not v_cb and v_dep > 0 and v_dep >= coalesce((q -> 'min_deposit' ->> r.currency)::numeric, 0) and v_stk >= coalesce((q -> 'min_settled_stake' ->> r.currency)::numeric, 0);
      end if;
      if v_ok then
        v_new := v_new || r.user_id;
        v_cpa := coalesce((a.cpa_amount ->> r.currency)::numeric, 0);
        if a.model in ('cpa','hybrid') and v_cpa > 0 then
          act := 'preview';
          if p_commit then
            insert into commissions (agent_id, kind, user_id, currency, period_start, period_end, base_amount, amount, details)
            values (a.id, 'cpa', r.user_id, r.currency, p_from, p_to, 0, v_cpa, jsonb_build_object('deposit', v_dep, 'settled_stake', v_stk, 'window_days', v_win)) on conflict do nothing;
            act := 'created';
          end if;
          out := out || jsonb_build_object('agent_id', a.id, 'agent', a.username, 'kind', 'cpa', 'currency', r.currency, 'user_id', r.user_id, 'amount', v_cpa, 'deposit', v_dep, 'settled_stake', v_stk, 'action', act);
        end if;
        if p_commit then update referrals set status = 'qualified', qualified_at = now() where user_id = r.user_id and status = 'registered'; end if;
      end if;
    end loop;

    -- B) revenue share on eligible net gaming revenue of qualified customers
    if a.model in ('revshare','hybrid') and a.rev_share_pct > 0 then
      foreach cur in array array['GHS','NGN'] loop
        select coalesce(array_agg(rf.user_id), '{}') into v_ids from referrals rf join profiles p on p.id = rf.user_id
          where rf.agent_id = a.id and p.currency = cur and p.status <> 'suspended' and not p.risk_flag and (rf.status = 'qualified' or rf.user_id = any (v_new))
            and not exists (select 1 from ledger l where l.user_id = rf.user_id and l.type = 'chargeback');
        v_cnt := coalesce(cardinality(v_ids), 0);
        select coalesce(sum(stake - coalesce(payout, 0)), 0) into v_ngr from bets where user_id = any (v_ids) and status in ('won','lost','cashed_out') and settled_at >= p_from and settled_at < p_to;
        v_ngr := v_ngr - coalesce((select sum(amount) from ledger where user_id = any (v_ids) and type in ('casino_stake','casino_win') and created_at >= p_from and created_at < p_to), 0)
                       - coalesce((select sum(amount) from ledger where user_id = any (v_ids) and type = 'bonus' and created_at >= p_from and created_at < p_to), 0);
        select (details ->> 'carry_out')::numeric into v_carry from commissions where agent_id = a.id and kind = 'revshare' and currency = cur and period_end <= p_from order by period_end desc limit 1;
        v_carry := coalesce(v_carry, 0);
        if v_cnt = 0 and v_ngr = 0 and v_carry = 0 then continue; end if;
        v_base := greatest(0, v_ngr + v_carry);
        v_amt := round(v_base * a.rev_share_pct / 100, 2);
        act := 'preview';
        if p_commit then
          if exists (select 1 from commissions where agent_id = a.id and kind = 'revshare' and currency = cur and status <> 'rejected'
                     and tstzrange(period_start, period_end) && tstzrange(p_from, p_to) and not (period_start = p_from and period_end = p_to)) then
            act := 'skipped_overlap';
          else
            select * into v_exist from commissions where agent_id = a.id and kind = 'revshare' and currency = cur and period_start = p_from and period_end = p_to;
            el := jsonb_build_object('ngr', v_ngr, 'carry_in', v_carry, 'carry_out', least(0, v_ngr + v_carry), 'customers', v_cnt);
            if found then
              if v_exist.status = 'pending' then update commissions set base_amount = v_base, rate = a.rev_share_pct, amount = v_amt, details = el where id = v_exist.id; act := 'updated';
              else act := 'skipped'; end if;
            else
              insert into commissions (agent_id, kind, currency, period_start, period_end, base_amount, rate, amount, status, details, note)
              values (a.id, 'revshare', cur, p_from, p_to, v_base, a.rev_share_pct, v_amt, case when v_amt > 0 then 'pending' else 'void' end, el,
                      case when v_amt > 0 then null else 'No commission this period (zero or negative NGR)' end);
              act := 'created';
            end if;
          end if;
        end if;
        out := out || jsonb_build_object('agent_id', a.id, 'agent', a.username, 'kind', 'revshare', 'currency', cur, 'customers', v_cnt, 'ngr', v_ngr, 'carry_in', v_carry,
                                         'carry_out', least(0, v_ngr + v_carry), 'base', v_base, 'rate', a.rev_share_pct, 'amount', v_amt, 'action', act);
      end loop;
    end if;
  end loop;
  if p_commit then perform log_admin('commissions.calculate', 'commissions', coalesce(p_agent::text, 'all'), jsonb_build_object('from', p_from, 'to', p_to, 'rows', jsonb_array_length(out))); end if;
  return jsonb_build_object('committed', p_commit, 'rows', out);
end $$;

create or replace function public.admin_list_commissions(p_status text default null, p_agent uuid default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform require_perm('commissions.view');
  return jsonb_build_object(
    'total', (select count(*) from commissions c where (coalesce(p_status, '') = '' or c.status = p_status) and (p_agent is null or c.agent_id = p_agent)),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select c.id, c.created_at, c.kind, c.currency, c.period_start, c.period_end, c.base_amount, c.rate, c.amount, c.status, c.note, c.details, g.username as agent, g.referral_code,
             coalesce(p.email, au.email) as customer
      from commissions c join agents g on g.id = c.agent_id left join profiles p on p.id = c.user_id left join auth.users au on au.id = c.user_id
      where (coalesce(p_status, '') = '' or c.status = p_status) and (p_agent is null or c.agent_id = p_agent)
      order by c.created_at desc limit least(coalesce(p_limit, 50), 500) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_review_commission(p_id uuid, p_action text, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare c public.commissions%rowtype;
begin
  perform require_perm('commissions.approve');
  select * into c from commissions where id = p_id for update;
  if not found then raise exception 'commission_not_found'; end if;
  if c.status <> 'pending' then raise exception 'not_pending'; end if;
  if p_action = 'approve' then update commissions set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), note = p_note where id = p_id;
  elsif p_action = 'reject' then
    if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'reason_required'; end if;
    update commissions set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), note = trim(p_note) where id = p_id;
  else raise exception 'bad_action'; end if;
  perform log_admin('commission.' || p_action, 'commission', p_id::text, jsonb_build_object('amount', c.amount, 'currency', c.currency, 'agent', c.agent_id, 'note', p_note));
end $$;

create or replace function public.admin_list_agent_withdrawals(p_status text default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('commissions.view');
  return coalesce((select jsonb_agg(to_jsonb(t)) from (
    select w.id, w.requested_at, w.currency, w.amount, w.method, w.account, w.account_name, w.status, w.reject_reason, w.payout_ref, g.username as agent, g.full_name, g.payout_status
    from agent_withdrawals w join agents g on g.id = w.agent_id where coalesce(p_status, '') = '' or w.status = p_status
    order by case when w.status in ('pending','approved') then 0 else 1 end, w.requested_at desc limit 200) t), '[]'::jsonb);
end $$;

create or replace function public.admin_process_agent_withdrawal(p_id uuid, p_action text, p_note text default null, p_ref text default null) returns void language plpgsql security definer set search_path = public as $$
declare w public.agent_withdrawals%rowtype;
begin
  perform require_perm('agent_payouts.process');
  select * into w from agent_withdrawals where id = p_id for update;
  if not found then raise exception 'withdrawal_not_found'; end if;
  if p_action = 'approve' then
    if w.status <> 'pending' then raise exception 'not_actionable'; end if;
    update agent_withdrawals set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  elsif p_action = 'pay' then
    if w.status <> 'approved' then raise exception 'must_be_approved_first'; end if;
    if length(trim(coalesce(p_ref, ''))) < 3 then raise exception 'payout_reference_required'; end if;
    update agent_withdrawals set status = 'paid', payout_ref = trim(p_ref), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  elsif p_action = 'reject' then
    if w.status not in ('pending','approved') then raise exception 'not_actionable'; end if;
    if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'reason_required'; end if;
    update agent_withdrawals set status = 'rejected', reject_reason = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  else raise exception 'bad_action'; end if;
  perform log_admin('agent_withdrawal.' || p_action, 'agent_withdrawal', p_id::text, jsonb_build_object('amount', w.amount, 'currency', w.currency, 'agent', w.agent_id, 'note', p_note, 'ref', p_ref));
end $$;

create or replace function public.admin_set_agent_payout_status(p_id uuid, p_status text, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('agent_payouts.process');
  if p_status not in ('approved','rejected') then raise exception 'bad_status'; end if;
  update agents set payout_status = p_status where id = p_id and payout_method is not null;
  if not found then raise exception 'no_payout_details'; end if;
  perform log_admin('agent.payout_details.' || p_status, 'agent', p_id::text, jsonb_build_object('note', p_note));
end $$;

-- ---------------------------------------------------------------------
-- 16. Agent portal (every function is scoped to the calling agent only)
-- ---------------------------------------------------------------------
create or replace function public._me_agent() returns public.agents language plpgsql stable security definer set search_path = public as $$
declare g public.agents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into g from agents where user_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  return g;
end $$;

create or replace function public.agent_dashboard() returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.agents%rowtype; v_elig jsonb := '{}'::jsonb; cur text; v_ids uuid[]; v_ngr numeric; v_com jsonb := '{}'::jsonb;
begin
  g := public._me_agent();
  foreach cur in array array['GHS','NGN'] loop
    select coalesce(array_agg(rf.user_id), '{}') into v_ids from referrals rf join profiles p on p.id = rf.user_id where rf.agent_id = g.id and rf.status = 'qualified' and p.currency = cur;
    select coalesce(sum(stake - coalesce(payout, 0)), 0) into v_ngr from bets where user_id = any (v_ids) and status in ('won','lost','cashed_out');
    v_ngr := v_ngr - coalesce((select sum(amount) from ledger where user_id = any (v_ids) and type in ('casino_stake','casino_win')), 0) - coalesce((select sum(amount) from ledger where user_id = any (v_ids) and type = 'bonus'), 0);
    v_elig := v_elig || jsonb_build_object(cur, v_ngr);
    v_com := v_com || jsonb_build_object(cur, jsonb_build_object(
      'pending', (select coalesce(sum(amount), 0) from commissions where agent_id = g.id and currency = cur and status = 'pending'),
      'approved', (select coalesce(sum(amount), 0) from commissions where agent_id = g.id and currency = cur and status = 'approved'),
      'withdrawn', (select coalesce(sum(amount), 0) from agent_withdrawals where agent_id = g.id and currency = cur and status in ('approved','paid')),
      'requested', (select coalesce(sum(amount), 0) from agent_withdrawals where agent_id = g.id and currency = cur and status = 'pending'),
      'available', public._agent_balance(g.id, cur)));
  end loop;
  return jsonb_build_object(
    'agent', jsonb_build_object('username', g.username, 'full_name', g.full_name, 'email', g.email, 'referral_code', g.referral_code, 'status', g.status, 'model', g.model,
       'period', g.period, 'rev_share_pct', g.rev_share_pct, 'cpa_amount', g.cpa_amount, 'payout_method', g.payout_method, 'payout_account', g.payout_account,
       'payout_name', g.payout_name, 'payout_status', g.payout_status, 'must_change_password', g.must_change_password, 'created_at', g.created_at),
    'counts', jsonb_build_object(
       'referrals', (select count(*) from referrals where agent_id = g.id),
       'qualified', (select count(*) from referrals where agent_id = g.id and status = 'qualified'),
       'disqualified', (select count(*) from referrals where agent_id = g.id and status = 'disqualified'),
       'active', (select count(distinct b.user_id) from bets b join referrals r on r.user_id = b.user_id where r.agent_id = g.id and b.placed_at >= now() - interval '30 days')),
    'eligible_revenue', v_elig, 'commissions', v_com,
    'registrations', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day) from (
        select date_trunc('day', registered_at)::date as day, count(*) n from referrals where agent_id = g.id and registered_at >= now() - interval '30 days' group by 1) d), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) order by w.requested_at desc) from (select id, requested_at, currency, amount, status, payout_ref, reject_reason, method from agent_withdrawals where agent_id = g.id order by requested_at desc limit 50) w), '[]'::jsonb),
    'recent_commissions', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select id, created_at, kind, currency, amount, status, period_start, period_end, rate, base_amount from commissions where agent_id = g.id order by created_at desc limit 50) c), '[]'::jsonb));
end $$;

create or replace function public.agent_referrals(p_limit int default 25, p_offset int default 0) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare g public.agents%rowtype;
begin
  g := public._me_agent();
  return jsonb_build_object('total', (select count(*) from referrals where agent_id = g.id),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select '#' || upper(substr(r.user_id::text, 1, 8)) as customer,
             left(coalesce(p.email, au.email, ''), 1) || '***@' || split_part(coalesce(p.email, au.email, ''), '@', 2) as email,
             r.registered_at, r.status, r.qualified_at, r.disqualified_reason, p.currency,
             (select coalesce(sum(amount), 0) from ledger l where l.user_id = r.user_id and l.type = 'deposit') as deposits,
             (select coalesce(sum(stake - coalesce(payout, 0)), 0) from bets b where b.user_id = r.user_id and b.status in ('won','lost','cashed_out')) as ngr
      from referrals r join profiles p on p.id = r.user_id left join auth.users au on au.id = r.user_id where r.agent_id = g.id
      order by r.registered_at desc limit least(coalesce(p_limit, 25), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.agent_update_payout(p_method text, p_account text, p_name text) returns void language plpgsql security definer set search_path = public as $$
declare g public.agents%rowtype;
begin
  g := public._me_agent();
  if length(trim(coalesce(p_method, ''))) < 2 or length(trim(coalesce(p_account, ''))) < 5 or length(trim(coalesce(p_name, ''))) < 2 then raise exception 'missing_fields'; end if;
  update agents set payout_method = trim(p_method), payout_account = trim(p_account), payout_name = trim(p_name), payout_status = 'pending' where id = g.id;
  perform log_admin('agent.payout_details.submit', 'agent', g.id::text, jsonb_build_object('method', p_method));
end $$;

create or replace function public.agent_clear_must_change() returns void language plpgsql security definer set search_path = public as $$
declare g public.agents%rowtype;
begin
  g := public._me_agent();
  update agents set must_change_password = false where id = g.id;
  perform log_admin('agent.password_changed', 'agent', g.id::text, '{}');
end $$;

create or replace function public.agent_request_withdrawal(p_amount numeric, p_currency text) returns uuid language plpgsql security definer set search_path = public as $$
declare g public.agents%rowtype; v_id uuid := gen_random_uuid(); v_min numeric; v_amt numeric(14,2) := round(coalesce(p_amount, 0), 2);
begin
  g := public._me_agent();
  perform 1 from agents where id = g.id for update;     -- serialise concurrent requests
  if p_currency not in ('GHS','NGN') then raise exception 'bad_currency'; end if;
  if g.status <> 'active' then raise exception 'agent_not_active'; end if;
  if g.payout_status <> 'approved' then raise exception 'payout_details_not_approved'; end if;
  select coalesce((value ->> p_currency)::numeric, 0) into v_min from settings where key = 'agent_min_withdrawal';
  if v_amt <= 0 or v_amt < v_min then raise exception 'below_minimum_withdrawal'; end if;
  if v_amt > public._agent_balance(g.id, p_currency) then raise exception 'insufficient_commission_balance'; end if;
  insert into agent_withdrawals (id, agent_id, currency, amount, method, account, account_name) values (v_id, g.id, p_currency, v_amt, g.payout_method, g.payout_account, g.payout_name);
  perform log_admin('agent_withdrawal.request', 'agent_withdrawal', v_id::text, jsonb_build_object('amount', v_amt, 'currency', p_currency));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 17. Administrators (Super Admin only)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_admins() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_super();
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from (select user_id, email, full_name, role, permissions, status, created_at, last_login_at from admin_users) t), '[]'::jsonb);
end $$;

create or replace function public.admin_create_admin(p_user_id uuid, p_email text, p_full_name text, p_role text, p_permissions text[]) returns void language plpgsql security definer set search_path = public, auth as $$
declare v_au auth.users%rowtype; v_perms text[];
begin
  perform require_super();
  if p_role not in ('finance','support','risk','trader','affiliate_manager','marketing') then raise exception 'bad_role'; end if;
  v_perms := coalesce(p_permissions, public.role_permissions(p_role));
  if exists (select 1 from unnest(v_perms) x where x <> all (public.all_permissions()) or x = 'admins.manage') then raise exception 'bad_permission'; end if;
  select * into v_au from auth.users where id = p_user_id;
  if not found then raise exception 'auth_user_not_found'; end if;
  if lower(coalesce(v_au.email, '')) <> lower(trim(p_email)) then raise exception 'email_mismatch'; end if;
  if v_au.created_at < now() - interval '60 minutes' then raise exception 'auth_user_not_new'; end if;
  if exists (select 1 from agents where user_id = p_user_id) or exists (select 1 from admin_users where user_id = p_user_id) then raise exception 'already_staff'; end if;
  if exists (select 1 from ledger where user_id = p_user_id) or exists (select 1 from bets where user_id = p_user_id) then raise exception 'account_has_activity'; end if;
  insert into admin_users (user_id, email, full_name, role, permissions, created_by) values (p_user_id, lower(trim(p_email)), trim(coalesce(p_full_name, '')), p_role, v_perms, auth.uid());
  perform log_admin('admin.create', 'admin_user', p_user_id::text, jsonb_build_object('email', p_email, 'role', p_role, 'permissions', v_perms));
end $$;

create or replace function public.admin_update_admin(p_user_id uuid, p_role text, p_permissions text[], p_status text) returns void language plpgsql security definer set search_path = public as $$
declare a public.admin_users%rowtype;
begin
  perform require_super();
  select * into a from admin_users where user_id = p_user_id for update;
  if not found then raise exception 'admin_not_found'; end if;
  if a.role = 'super_admin' or p_user_id = auth.uid() then raise exception 'cannot_modify_super_admin'; end if;
  if p_role not in ('finance','support','risk','trader','affiliate_manager','marketing') then raise exception 'bad_role'; end if;
  if p_status not in ('active','suspended') then raise exception 'bad_status'; end if;
  if exists (select 1 from unnest(coalesce(p_permissions, '{}')) x where x <> all (public.all_permissions()) or x = 'admins.manage') then raise exception 'bad_permission'; end if;
  update admin_users set role = p_role, permissions = coalesce(p_permissions, '{}'), status = p_status where user_id = p_user_id;
  perform log_admin('admin.update', 'admin_user', p_user_id::text, jsonb_build_object('from', jsonb_build_object('role', a.role, 'permissions', a.permissions, 'status', a.status),
                    'to', jsonb_build_object('role', p_role, 'permissions', p_permissions, 'status', p_status)));
end $$;

-- ---------------------------------------------------------------------
-- 18. Security & audit views, bonuses, abuse detection
-- ---------------------------------------------------------------------
create or replace function public.admin_list_audit(p_actor text default null, p_action text default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('audit.view');
  return jsonb_build_object(
    'total', (select count(*) from audit_log a where (coalesce(p_actor, '') = '' or a.actor_email ilike '%' || p_actor || '%') and (coalesce(p_action, '') = '' or a.action ilike p_action || '%')),
    'rows', coalesce((select jsonb_agg(to_jsonb(t)) from (select at, actor_email, actor_type, action, entity_type, entity_id, details, ip from audit_log a
      where (coalesce(p_actor, '') = '' or a.actor_email ilike '%' || p_actor || '%') and (coalesce(p_action, '') = '' or a.action ilike p_action || '%')
      order by id desc limit least(coalesce(p_limit, 50), 200) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.admin_list_logins(p_limit int default 100) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('audit.view');
  return coalesce((select jsonb_agg(to_jsonb(t)) from (select at, email, portal, kind, success, ip, user_agent from staff_login_events where kind <> 'lookup' order by id desc limit least(coalesce(p_limit, 100), 500)) t), '[]'::jsonb);
end $$;

create or replace function public.admin_abuse_signals() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('audit.view');
  return jsonb_build_object(
    'referral_bursts', coalesce((select jsonb_agg(to_jsonb(t)) from (select g.username, g.referral_code, date_trunc('hour', r.registered_at) as hour, count(*) as registrations
        from referrals r join agents g on g.id = r.agent_id group by g.username, g.referral_code, date_trunc('hour', r.registered_at) having count(*) >= 10 order by 3 desc limit 50) t), '[]'::jsonb),
    'self_referrals', coalesce((select jsonb_agg(to_jsonb(t)) from (select g.username, r.user_id, r.registered_at from referrals r join agents g on g.id = r.agent_id where 'self_referral' = any (r.flags) order by r.registered_at desc limit 50) t), '[]'::jsonb),
    'bonus_then_withdraw', coalesce((select jsonb_agg(to_jsonb(t)) from (select bg.user_id, bg.amount as bonus, bg.currency, w.amount as withdrawn, w.created_at
        from bonus_grants bg join withdrawals w on w.user_id = bg.user_id and w.created_at between bg.granted_at and bg.granted_at + interval '7 days'
        where (select coalesce(sum(stake), 0) from bets where user_id = bg.user_id and status in ('won','lost','cashed_out')) < bg.amount * 3 order by w.created_at desc limit 50) t), '[]'::jsonb));
end $$;

create or replace function public.admin_list_promotions() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('promotions.manage');
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
    select p.*, (select count(*) from bonus_grants g where g.promotion_id = p.id) as grants,
           (select coalesce(jsonb_object_agg(c.currency, c.s), '{}'::jsonb) from (select currency, sum(amount) s from bonus_grants g where g.promotion_id = p.id and g.status <> 'revoked' group by currency) c) as granted_total
    from promotions p) t), '[]'::jsonb);
end $$;

create or replace function public.admin_upsert_promotion(p_id uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  perform require_perm('promotions.manage');
  if length(trim(coalesce(p ->> 'name', ''))) < 3 then raise exception 'name_required'; end if;
  if (p ->> 'kind') not in ('welcome','campaign','free_bet','referral') then raise exception 'bad_kind'; end if;
  insert into promotions (id, name, kind, description, amount, percent, max_amount, min_deposit, wagering_multiple, eligibility, starts_at, ends_at, budget, active, created_by)
  values (v_id, trim(p ->> 'name'), p ->> 'kind', p ->> 'description', coalesce(p -> 'amount', '{"GHS":0,"NGN":0}'), coalesce((p ->> 'percent')::numeric, 0),
          coalesce(p -> 'max_amount', '{"GHS":0,"NGN":0}'), coalesce(p -> 'min_deposit', '{"GHS":0,"NGN":0}'), coalesce((p ->> 'wagering_multiple')::numeric, 1), coalesce(p -> 'eligibility', '{}'),
          nullif(p ->> 'starts_at', '')::timestamptz, nullif(p ->> 'ends_at', '')::timestamptz, coalesce(p -> 'budget', '{"GHS":0,"NGN":0}'), coalesce((p ->> 'active')::boolean, true), auth.uid())
  on conflict (id) do update set name = excluded.name, kind = excluded.kind, description = excluded.description, amount = excluded.amount, percent = excluded.percent, max_amount = excluded.max_amount,
    min_deposit = excluded.min_deposit, wagering_multiple = excluded.wagering_multiple, eligibility = excluded.eligibility, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    budget = excluded.budget, active = excluded.active;
  perform log_admin('promotion.save', 'promotion', v_id::text, p);
  return v_id;
end $$;

create or replace function public.admin_grant_bonus(p_user uuid, p_promotion uuid, p_amount numeric, p_note text default null) returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.promotions%rowtype; v_cur text; v_id uuid := gen_random_uuid(); v_amt numeric(14,2) := round(coalesce(p_amount, 0), 2); v_max numeric; v_budget numeric; v_used numeric;
begin
  perform require_perm('promotions.manage');
  select * into pr from promotions where id = p_promotion;
  if not found or not pr.active then raise exception 'promotion_not_active'; end if;
  if (pr.starts_at is not null and pr.starts_at > now()) or (pr.ends_at is not null and pr.ends_at < now()) then raise exception 'promotion_outside_dates'; end if;
  select currency into v_cur from customer_profiles where id = p_user;
  if v_cur is null then raise exception 'user_not_found'; end if;
  if v_amt <= 0 then raise exception 'bad_amount'; end if;
  v_max := coalesce((pr.max_amount ->> v_cur)::numeric, 0);
  if v_max > 0 and v_amt > v_max then raise exception 'above_promotion_max'; end if;
  v_budget := coalesce((pr.budget ->> v_cur)::numeric, 0);
  select coalesce(sum(amount), 0) into v_used from bonus_grants where promotion_id = p_promotion and currency = v_cur and status <> 'revoked';
  if v_budget > 0 and v_used + v_amt > v_budget then raise exception 'promotion_budget_exhausted'; end if;
  if exists (select 1 from bonus_grants where user_id = p_user and promotion_id = p_promotion) then raise exception 'already_granted'; end if;
  insert into bonus_grants (id, user_id, promotion_id, kind, amount, currency, granted_by, note) values (v_id, p_user, p_promotion, pr.kind, v_amt, v_cur, auth.uid(), p_note);
  perform public.credit_wallet(p_user, v_amt, 'bonus', 'bonus:' || v_id::text, pr.name);
  perform log_admin('bonus.grant', 'user', p_user::text, jsonb_build_object('promotion', pr.name, 'amount', v_amt, 'currency', v_cur, 'note', p_note));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 19. place_bet: now honours the admin-controlled limits & snapshots the market line
--     (stake limits, payout cap and account status are enforced by triggers above)
-- ---------------------------------------------------------------------
create or replace function public.place_bet(p_picks jsonb, p_stake numeric, p_mode text, p_idem text default null, p_accept_odds boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_excl timestamptz; v_n int; v_i int; v_pick jsonb; v_ev public.events%rowtype; v_odd public.odds%rowtype;
  v_total_odds numeric := 1; v_boost numeric := 0; v_stake numeric(14,2) := round(coalesce(p_stake, 0), 2); v_win numeric(14,2); v_bet uuid; v_ids uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select self_excluded_until into v_excl from public.profiles where id = v_uid;
  if v_excl is not null and v_excl > now() then raise exception 'self_excluded'; end if;
  if p_idem is not null then
    select array_agg(id) into v_ids from public.bets where user_id = v_uid and starts_with(idempotency_key, p_idem || ':');
    if v_ids is not null then return jsonb_build_object('ok', true, 'duplicate', true, 'bet_ids', to_jsonb(v_ids)); end if;
  end if;
  if p_mode not in ('single','multiple') then raise exception 'bad_mode'; end if;
  v_n := coalesce(jsonb_array_length(p_picks), 0);
  if v_n < 1 or v_n > 30 then raise exception 'bad_selection_count'; end if;
  if p_mode = 'multiple' and v_n < 2 then raise exception 'multiple_needs_two'; end if;
  if v_stake <= 0 then raise exception 'bad_stake'; end if;
  if (select count(distinct e ->> 'event_id') from jsonb_array_elements(p_picks) e) <> v_n then raise exception 'one_pick_per_match'; end if;
  for v_i in 0 .. v_n - 1 loop
    v_pick := p_picks -> v_i;
    select * into v_ev from public.events where id = v_pick ->> 'event_id';
    if not found then raise exception 'event_not_found'; end if;
    if not (v_ev.status = 'live' or (v_ev.status = 'scheduled' and v_ev.kickoff > now())) then raise exception 'event_closed'; end if;
    select * into v_odd from public.odds where event_id = v_ev.id and market = v_pick ->> 'market' and selection = v_pick ->> 'selection';
    if not found then raise exception 'market_not_found'; end if;
    if v_odd.suspended then raise exception 'market_suspended'; end if;
    if not p_accept_odds and v_pick ? 'odds' and abs((v_pick ->> 'odds')::numeric - v_odd.price) > 0.001 then raise exception 'odds_changed'; end if;
    v_total_odds := v_total_odds * v_odd.price;
  end loop;
  if p_mode = 'multiple' then
    v_boost := public.boost_for(v_n);
    v_win := round(v_stake * round(v_total_odds, 2) * (1 + v_boost / 100), 2);
    insert into public.bets (user_id, kind, stake, total_odds, boost_pct, potential_win, idempotency_key)
    values (v_uid, 'multiple', v_stake, round(v_total_odds, 2), v_boost, v_win, case when p_idem is null then null else p_idem || ':0' end) returning id into v_bet;
    insert into public.bet_legs (bet_id, event_id, market, selection, odds, line)
    select v_bet, p ->> 'event_id', p ->> 'market', p ->> 'selection', o.price, o.line from jsonb_array_elements(p_picks) p
    join public.odds o on o.event_id = p ->> 'event_id' and o.market = p ->> 'market' and o.selection = p ->> 'selection';
    perform public.credit_wallet(v_uid, -v_stake, 'bet_stake', v_bet::text, 'Multiple bet');
    v_ids := array[v_bet];
  else
    v_ids := '{}';
    for v_i in 0 .. v_n - 1 loop
      v_pick := p_picks -> v_i;
      select * into v_odd from public.odds where event_id = v_pick ->> 'event_id' and market = v_pick ->> 'market' and selection = v_pick ->> 'selection';
      v_win := round(v_stake * v_odd.price, 2);
      insert into public.bets (user_id, kind, stake, total_odds, potential_win, idempotency_key)
      values (v_uid, 'single', v_stake, v_odd.price, v_win, case when p_idem is null then null else p_idem || ':' || v_i end) returning id into v_bet;
      insert into public.bet_legs (bet_id, event_id, market, selection, odds, line) values (v_bet, v_pick ->> 'event_id', v_pick ->> 'market', v_pick ->> 'selection', v_odd.price, v_odd.line);
      perform public.credit_wallet(v_uid, -v_stake, 'bet_stake', v_bet::text, 'Single bet');
      v_ids := v_ids || v_bet;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'bet_ids', to_jsonb(v_ids), 'booking_code', public.create_booking_code(p_picks));
end $$;

-- ---------------------------------------------------------------------
-- 20. FINAL PERMISSIONS – deterministic, deny by default
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'admin\_%' or p.proname like 'agent\_%' or p.proname in ('staff_login_ok'))
             and p.proname not in ('agent_login_email','admin_calculate_commissions_internal') loop
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
  grant execute on function public.staff_login_locked(text), public.staff_login_failed(text, text), public.agent_login_email(text) to anon, authenticated;
  grant execute on function public.place_bet(jsonb, numeric, text, text, boolean) to authenticated;
  grant execute on function public.create_booking_code(jsonb) to authenticated;
  grant execute on function public.load_booking_code(text) to anon, authenticated;
  grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;
  if to_regprocedure('public.phone_available(text)') is not null then
    grant execute on function public.phone_available(text) to anon, authenticated;
  end if;
  grant execute on function public.credit_wallet(uuid, numeric, text, text, text) to service_role;
  grant execute on function public.settle_bet_final(uuid, text, numeric) to service_role;
end $$;
-- the helper that only agents' own RPCs use must not be callable directly
revoke execute on function public._me_agent() from authenticated;

-- ===================================================================
-- STEP 2 OF SETUP (run ONCE, after you create your login in
-- Supabase → Authentication → Users → Add user, "Auto Confirm User" ticked):
--
--     select public.bootstrap_super_admin('you@example.com');
--
-- That is the ONLY way a Super Admin is created. There is no public sign-up for admins.
-- ===================================================================
