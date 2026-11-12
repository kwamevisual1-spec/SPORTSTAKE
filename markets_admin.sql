-- =====================================================================
-- SportStake – detailed football markets: admin control + settlement
-- Run AFTER schema.sql and admin_agents.sql. Safe to re-run. Changes no data.
-- =====================================================================

-- 1) Administrators may now create and price every market in the catalogue.
create or replace function public.admin_upsert_odds(
  p_event text, p_market text, p_selection text, p_label text, p_price numeric, p_line numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old numeric;
begin
  perform require_perm('betting.manage');
  if p_price is null or p_price < 1.01 or p_price > 1000 then raise exception 'bad_price'; end if;
  if p_market not in (
    -- match result
    '1x2','dc','dnb','mw','team_win','htft','ht','sh','ht_dc','sh_dc','oneup','twoup','neverdown',
    -- goals / both to score
    'ou','ou_lines','ttg','ou1h','ou2h','home_ou','away_ou','btts','btts1h','btts2h','home_score','away_score','oe','oe1h','home_oe','away_oe',
    -- scores
    'cs','cs1h','cs2h',
    -- team goals / handicaps
    'hcp','hcp_table','hcp1h','tot',
    -- corners / bookings
    'corners','corners_home','corners_away','corners1h','corners2h','bookings',
    -- specials
    'first_goal','last_goal','win_nil','clean_sheet','highest_half','win_margin','goals_range','score_both_halves',
    -- basketball
    'ml'
  ) then raise exception 'bad_market'; end if;
  if not exists (select 1 from events where id = p_event and status in ('scheduled','live')) then raise exception 'event_not_editable'; end if;
  select price into v_old from odds where event_id = p_event and market = p_market and selection = p_selection;
  insert into odds (event_id, market, selection, label, price, line)
  values (p_event, p_market, p_selection, coalesce(nullif(trim(p_label), ''), p_selection), round(p_price, 2), p_line)
  on conflict (event_id, market, selection) do update set label = excluded.label, price = excluded.price, line = excluded.line, updated_at = now();
  perform log_admin('odds.set', 'event', p_event, jsonb_build_object('market', p_market, 'selection', p_selection, 'from', v_old, 'to', p_price, 'line', p_line));
end $$;

-- 2) Suspend or re-open ONE selection (all markets, including correct score).
create or replace function public.admin_set_selection_suspended(p_event text, p_market text, p_selection text, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_perm('betting.manage');
  update odds set suspended = p_suspended, updated_at = now() where event_id = p_event and market = p_market and selection = p_selection;
  if not found then raise exception 'selection_not_found'; end if;
  perform log_admin(case when p_suspended then 'selection.suspend' else 'selection.resume' end, 'event', p_event,
                    jsonb_build_object('market', p_market, 'selection', p_selection));
end $$;

-- 3) Correct score and line grids in one call, e.g. for all 0:0..5:5 scores.
create or replace function public.admin_bulk_set_odds(p_event text, p_market text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  perform require_perm('betting.manage');
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows_must_be_array'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    perform admin_upsert_odds(p_event, p_market, r ->> 'selection', r ->> 'label', (r ->> 'price')::numeric, nullif(r ->> 'line', '')::numeric);
    n := n + 1;
  end loop;
  perform log_admin('odds.bulk_set', 'event', p_event, jsonb_build_object('market', p_market, 'rows', n));
  return n;
end $$;

-- 4) Settlement for the detailed markets. Unknown markets are VOIDED (never guessed),
--    and the caller can supply the match statistics needed by corners/first goal.
create or replace function public.leg_result_full(
  p_market text, p_sel text, p_line numeric, h int, a int,
  p_ht_h int default null, p_ht_a int default null,
  p_corners_h int default null, p_corners_a int default null,
  p_first_goal text default null, p_last_goal text default null
) returns text language plpgsql immutable as $$
declare o text; tot int := h + a; diff numeric; fh int := coalesce(p_ht_h, 0); fa int := coalesce(p_ht_a, 0); ch int; ca int;
begin
  o := case when h > a then '1' when h = a then 'X' else '2' end;
  if p_market = '1x2' or p_market = 'mw' then return case when p_sel = o then 'won' else 'lost' end; end if;
  if p_market = 'team_win' then return case when (p_sel = '1' and h > a) or (p_sel = '2' and a > h) then 'won' else 'lost' end; end if;
  if p_market = 'dc' then return case when (p_sel = '1X' and o in ('1','X')) or (p_sel = '12' and o in ('1','2')) or (p_sel = 'X2' and o in ('X','2')) then 'won' else 'lost' end; end if;
  if p_market = 'dnb' then if h = a then return 'void'; end if; return case when (p_sel = '1' and h > a) or (p_sel = '2' and a > h) then 'won' else 'lost' end; end if;
  if p_market in ('ou','ou_lines','ttg') then
    if p_line is null then if p_market = 'ttg' then p_line := 2.5; else raise exception 'missing_line'; end if; end if;
    if tot = p_line then return 'void'; end if;
    return case when (p_sel like 'O%' and tot > p_line) or (p_sel like 'U%' and tot < p_line) then 'won' else 'lost' end;
  end if;
  if p_market = 'btts' then return case when (p_sel = 'GG' and h > 0 and a > 0) or (p_sel = 'NG' and not (h > 0 and a > 0)) then 'won' else 'lost' end; end if;
  if p_market in ('home_ou','away_ou') then
    if p_market = 'home_ou' then return case when (p_sel like 'O%' and h > p_line) or (p_sel like 'U%' and h < p_line) then 'won' else 'lost' end; end if;
    return case when (p_sel like 'O%' and a > p_line) or (p_sel like 'U%' and a < p_line) then 'won' else 'lost' end;
  end if;
  if p_market = 'oe' then return case when (p_sel = 'ODD' and tot % 2 = 1) or (p_sel = 'EVEN' and tot % 2 = 0) then 'won' else 'lost' end; end if;
  if p_market = 'home_oe' then return case when (p_sel = 'ODD' and h % 2 = 1) or (p_sel = 'EVEN' and h % 2 = 0) then 'won' else 'lost' end; end if;
  if p_market = 'away_oe' then return case when (p_sel = 'ODD' and a % 2 = 1) or (p_sel = 'EVEN' and a % 2 = 0) then 'won' else 'lost' end; end if;
  if p_market = 'cs' then
    if p_sel = 'OTHER-H' then return case when h > a then 'won' else 'lost' end; end if;
    if p_sel = 'OTHER-A' then return case when a > h then 'won' else 'lost' end; end if;
    if p_sel = 'OTHER-D' then return case when h = a then 'won' else 'lost' end; end if;
    return case when p_sel = h || ':' || a then 'won' else 'lost' end;
  end if;
  if p_market in ('ht','ht_dc') then
    if p_ht_h is null then return 'void'; end if;
    return case
      when p_market = 'ht' and ((p_sel = '1' and fh > fa) or (p_sel = 'X' and fh = fa) or (p_sel = '2' and fa > fh)) then 'won'
      when p_market = 'ht_dc' and ((p_sel = '1X' and fh >= fa) or (p_sel = 'X2' and fa >= fh) or (p_sel = '12' and fh <> fa)) then 'won'
      else 'lost' end;
  end if;
  if p_market = 'cs1h' then
    if p_ht_h is null then return 'void'; end if;
    return case when p_sel = fh || ':' || fa then 'won' else 'lost' end;
  end if;
  if p_market = 'htft' then
    if p_ht_h is null then return 'void'; end if;
    return case when p_sel = (case when fh > fa then '1' when fh = fa then 'X' else '2' end) || '/' || o then 'won' else 'lost' end;
  end if;
  if p_market in ('corners','corners_home','corners_away','corners1h','corners2h') then
    -- without corner statistics the market is voided (stake returned), never guessed
    if p_corners_h is null or p_corners_a is null then return 'void'; end if;
    ch := p_corners_h; ca := p_corners_a;
    if p_market = 'corners' then return case when (p_sel like 'O%' and ch + ca > p_line) or (p_sel like 'U%' and ch + ca < p_line) then 'won' else 'lost' end; end if;
    if p_market in ('corners1h','corners2h') then return 'void'; end if;
    if p_market = 'corners_home' then return case when (p_sel like 'O%' and ch > p_line) or (p_sel like 'U%' and ch < p_line) then 'won' else 'lost' end; end if;
    return case when (p_sel like 'O%' and ca > p_line) or (p_sel like 'U%' and ca < p_line) then 'won' else 'lost' end;
  end if;
  if p_market in ('hcp','hcp_table') then
    if p_line is null then raise exception 'missing_line'; end if;
    diff := h + p_line - a;
    if p_market = 'hcp' then if diff = 0 then return 'void'; end if; return case when (p_sel = 'H1' and diff > 0) or (p_sel = 'H2' and diff < 0) then 'won' else 'lost' end; end if;
    if diff = 0 and p_sel like 'D%' then return 'won'; end if;
    return case when (p_sel like 'H%' and diff > 0) or (p_sel like 'A%' and diff < 0) then 'won' else 'lost' end;
  end if;
  if p_market = 'first_goal' then
    return case when p_first_goal is null then 'void' when p_first_goal = p_sel then 'won' else 'lost' end;
  end if;
  if p_market = 'last_goal' then
    return case when p_last_goal is null then 'void' when p_last_goal = p_sel then 'won' else 'lost' end;
  end if;
  if p_market = 'win_nil' then return case when (p_sel = '1' and a = 0 and h > a) or (p_sel = '2' and h = 0 and a > h) then 'won' else 'lost' end; end if;
  if p_market = 'clean_sheet' then return case when (p_sel = '1' and a = 0) or (p_sel = '2' and h = 0) then 'won' else 'lost' end; end if;
  -- anything we cannot settle from the data we hold is voided, never guessed
  return 'void';
end $$;

revoke all on function public.leg_result_full(text,text,numeric,int,int,int,int,int,int,text,text) from public, anon, authenticated;
grant execute on function public.leg_result_full(text,text,numeric,int,int,int,int,int,int,text,text) to service_role;

-- 5) Settlement job now supports half-time score and match statistics.
create or replace function public._settle_event_full(
  p_event text, p_h int, p_a int, p_ht_h int default null, p_ht_a int default null,
  p_corners_h int default null, p_corners_a int default null, p_first_goal text default null, p_last_goal text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare lg record; b record; v_res text; v_won int := 0; v_lost int := 0; v_void int := 0; v_open int := 0;
        v_n int; v_prod numeric; v_pay numeric; v_cap numeric; v_cur text;
begin
  for lg in select l.id, l.market, l.selection, coalesce(l.line, o.line) as line from bet_legs l
            left join odds o on o.event_id = l.event_id and o.market = l.market and o.selection = l.selection
            where l.event_id = p_event and l.result is null loop
    v_res := public.leg_result_full(lg.market, lg.selection, lg.line, p_h, p_a, p_ht_h, p_ht_a, p_corners_h, p_corners_a, p_first_goal, p_last_goal);
    update bet_legs set result = v_res where id = lg.id;
  end loop;
  for b in select * from bets where status = 'open' and id in (select bet_id from bet_legs where event_id = p_event) for update loop
    if exists (select 1 from bet_legs where bet_id = b.id and result = 'lost') then perform public.settle_bet_final(b.id, 'lost', 0); v_lost := v_lost + 1;
    elsif exists (select 1 from bet_legs where bet_id = b.id and result is null) then v_open := v_open + 1;
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
  insert into settlements (event_id, by_user, home_score, away_score, bets_won, bets_lost, bets_void, bets_open)
  values (p_event, auth.uid(), p_h, p_a, v_won, v_lost, v_void, v_open);
  return jsonb_build_object('won', v_won, 'lost', v_lost, 'void', v_void, 'still_open', v_open);
end $$;
revoke all on function public._settle_event_full(text,int,int,int,int,int,int,text,text) from public, anon, authenticated;

-- 6) Admin entry point with the extra statistics.
create or replace function public.admin_settle_event_full(
  p_event text, p_home int, p_away int, p_ht_home int default null, p_ht_away int default null,
  p_corners_home int default null, p_corners_away int default null, p_first_goal text default null, p_last_goal text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare ev events%rowtype; r jsonb;
begin
  perform require_perm('betting.settle');
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 then raise exception 'bad_score'; end if;
  select * into ev from events where id = p_event for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status in ('finished','cancelled') then raise exception 'event_already_settled'; end if;
  update events set status = 'finished', home_score = p_home, away_score = p_away, updated_at = now() where id = p_event;
  r := public._settle_event_full(p_event, p_home, p_away, p_ht_home, p_ht_away, p_corners_home, p_corners_away, p_first_goal, p_last_goal);
  perform log_admin('event.settle', 'event', p_event, jsonb_build_object('home', p_home, 'away', p_away, 'ht_home', p_ht_home, 'ht_away', p_ht_away,
                    'corners_home', p_corners_home, 'corners_away', p_corners_away, 'first_goal', p_first_goal, 'last_goal', p_last_goal) || r);
  return r;
end $$;

grant execute on function public.admin_settle_event_full(text,int,int,int,int,int,int,text,text) to authenticated;
grant execute on function public.admin_set_selection_suspended(text,text,text,boolean) to authenticated;
grant execute on function public.admin_bulk_set_odds(text,text,jsonb) to authenticated;

-- 7) Make sure the older simple settlement still works for simple markets.
--    (leg_result is kept for backwards compatibility; anything unknown is voided.)
create or replace function public.admin_settle_event(p_event text, p_home int, p_away int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return public.admin_settle_event_full(p_event, p_home, p_away, null, null, null, null, null, null);
end $$;
grant execute on function public.admin_settle_event(text,int,int) to authenticated;
