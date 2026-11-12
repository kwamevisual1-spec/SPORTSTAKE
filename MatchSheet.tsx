import { useMemo, useState } from "react";
import { MATCH_BY_ID, isFootballLike, teamName } from "../data";
import {
  marketsFor,
  marketGroups,
  priceOf,
  type Market,
  type MarketGroup,
  type Outcome,
} from "../lib/markets";
import { hash01, liveState, matchStats } from "../lib/sim";
import { kickoffLabel } from "../lib/format";
import { useClock } from "../lib/clock";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { Crest } from "./Crest";
import { ChevronDown, ChevronLeft, HomeIcon, InfoIcon, StarIcon } from "./Icons";

const FAV_KEY = "ss-market-favs";
const loadFavs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
};
const saveFavs = (v: string[]) => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------ */
/* one odds button                                                     */
/* ------------------------------------------------------------------ */
const htName = (code: string) => (code === "1" ? "Home" : code === "X" ? "Draw" : "Away");

const rowLabel = (o: Outcome) => {
  const s = o.short?.trim();
  return s && s.length <= 6 ? s : o.label;
};

function Odd({ outcome, style }: { outcome: Outcome; style: "row" | "cell" }) {
  const { slip, toggle, notify } = useStore();
  const now = useClock();
  const { odds, locked, settled } = priceOf(outcome, now);
  const active = slip.includes(outcome.key);

  if (settled) {
    return (
      <div className={cn("flex items-center justify-between rounded-xl px-2 opacity-55", style === "row" ? "h-[50px] px-3" : "h-[54px]")} title={settled === "won" ? "Won" : "Lost"}>
        <span className="truncate text-[11.5px] font-bold text-brand-ink/45">{style === "row" ? rowLabel(outcome) : outcome.label}</span>
        <span className={cn("shrink-0 pl-2 text-[13px] font-black", settled === "won" ? "text-brand-green-deep" : "text-brand-red")}>{settled === "won" ? "✓" : "✗"}</span>
      </div>
    );
  }

  if (locked) {
    return (
      <div className={cn("grid place-items-center rounded-xl bg-[#eceef2] text-brand-ink/30", style === "row" ? "h-[50px]" : "h-[54px]")} title="Market suspended">
        🔒
      </div>
    );
  }
  return (
    <button
      onClick={() => {
        toggle(outcome.key);
        if (!slip.includes(outcome.key)) notify("Added to betslip");
      }}
      aria-pressed={active}
      className={cn(
        "flex items-center rounded-lg transition active:scale-[0.97]",
        style === "row" ? "h-[50px] justify-between px-3" : "h-[54px] justify-between px-2.5",
        active ? "bg-brand-green text-white shadow-[0_6px_14px_-8px_rgba(23,163,74,0.9)]" : "bg-[#e9f6ee] text-brand-green-deep hover:bg-[#dcf2e4]",
      )}
    >
      <span className={cn("truncate font-bold", style === "row" ? "text-[11.5px]" : "text-[11px]", active ? "text-white/85" : "text-brand-green-deep/75")}>{style === "row" ? rowLabel(outcome) : outcome.label}</span>
      <span className={cn("shrink-0 pl-2 font-black tabular-nums tracking-tight", style === "row" ? "text-[16px]" : "text-[15px]")}>{(odds || 0).toFixed(2)}</span>
    </button>
  );
}

/** Big correct-score card: the score on top, the price underneath, like the reference bookmaker. */
function ScoreCard({ outcome }: { outcome: Outcome }) {
  const { slip, toggle } = useStore();
  const now = useClock();
  const { odds, locked, settled } = priceOf(outcome, now);
  const active = slip.includes(outcome.key);
  if (settled || locked) {
    return (
      <div className="flex h-[54px] items-center justify-center gap-2 rounded-xl bg-[#f3f4f6] text-brand-ink/35">
        <span className="text-[12px] font-bold tabular-nums">{outcome.label}</span>
        <span className="text-[11.5px] font-bold">{settled === "won" ? "Won ✓" : settled === "lost" ? "Lost" : "—"}</span>
      </div>
    );
  }
  return (
    <button
      onClick={() => toggle(outcome.key)}
      aria-pressed={active}
      className={cn(
        "flex h-[54px] items-center justify-center gap-2.5 rounded-xl px-2 transition active:scale-[0.97]",
        active ? "bg-brand-green text-white shadow-[0_6px_14px_-6px_rgba(23,163,74,0.9)]" : "bg-[#e9f6ee] text-brand-green-deep hover:bg-[#dcf2e4]",
      )}
    >
      <span className={cn("text-[13px] font-bold tabular-nums", active ? "text-white/90" : "text-brand-green-deep/85")}>{outcome.label}</span>
      <span className={cn("text-[16px] font-black tabular-nums tracking-tight", active ? "text-white" : "text-brand-green-deep")}>{(odds || 0).toFixed(2)}</span>
    </button>
  );
}

function TableCell({ outcome }: { outcome: Outcome }) {
  const { slip, toggle } = useStore();
  const now = useClock();
  const { odds, locked, settled } = priceOf(outcome, now);
  const active = slip.includes(outcome.key);
  if (settled) return <div className={cn("grid h-[44px] w-full place-items-center rounded-xl bg-black/[0.035] text-[14px] font-black", settled === "won" ? "text-brand-green-deep" : "text-brand-red/60")} title={settled}>{settled === "won" ? "✓" : "✗"}</div>;
  return (
    <button
      onClick={() => toggle(outcome.key)}
      disabled={locked}
      aria-pressed={active}
      className={cn(
        "h-[44px] w-full rounded-xl text-[15.5px] font-black tabular-nums transition active:scale-[0.97]",
        locked ? "bg-[#f0f1f3] text-brand-ink/25" : active ? "bg-brand-green text-white" : "bg-[#e9f6ee] text-brand-green-deep hover:bg-[#dcf2e4]",
      )}
    >
      {locked ? "🔒" : odds.toFixed(2)}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* market section                                                      */
/* ------------------------------------------------------------------ */
function MarketBlock({ market, matchId, fav, onFav }: { market: Market; matchId: string; fav: boolean; onFav: () => void }) {
  const { slip, toggle } = useStore();
  const [open, setOpen] = useState(true);
  const [hint, setHint] = useState(false);
  const now = useClock();
  const allSettled = market.outcomes.every((o) => priceOf(o, now).settled);

  const rows = useMemo(() => {
    if (market.layout !== "table") return [];
    const map = new Map<string | number, Outcome[]>();
    for (const o of market.outcomes) {
      const line = market.key === "htft" ? o.code.split("/")[0] : (o.line ?? 0);
      map.set(line, [...(map.get(line) ?? []), o]);
    }
    return [...map.entries()]
      .filter(([, outs]) => !outs.every((o) => priceOf(o, now).settled))
      .sort((a, b) => (typeof a[0] === "number" && typeof b[0] === "number" ? a[0] - b[0] : String(a[0]).localeCompare(String(b[0]))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, now]);

  return (
    <section className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-[0_2px_8px_-6px_rgba(16,19,26,0.25)]">
      <header className="flex items-center gap-2 bg-[#f7f8f9] px-3 py-2.5">
        <button onClick={onFav} aria-label={fav ? "Remove market from favourites" : "Add market to favourites"} className="shrink-0">
          <StarIcon className={cn("h-[17px] w-[17px]", fav ? "fill-[#f5b301] text-[#f5b301]" : "text-brand-ink/30")} strokeWidth={2} />
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="truncate text-[13.5px] font-black tracking-tight text-brand-ink">{market.title}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHint((h) => !h);
            }}
            aria-label="About this market"
            className="shrink-0 text-brand-ink/30"
          >
            <InfoIcon className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse" : "Expand"} className="shrink-0">
          <ChevronDown className={cn("h-4 w-4 text-brand-ink/50 transition", !open && "-rotate-90")} strokeWidth={2.6} />
        </button>
      </header>

      {open ? (
        <div className="px-3 pb-3 pt-2.5">
          {allSettled ? <p className="py-1 text-[11.5px] font-bold text-brand-ink/40">Market settled – no longer open for betting.</p> : null}
          {hint && market.hint ? <p className="mb-2 rounded-lg bg-brand-green-soft px-2.5 py-1.5 text-[11px] font-semibold text-brand-green-deep">{market.hint}</p> : null}

          {market.layout === "row" ? (
            <div className={cn("grid gap-1.5", market.outcomes.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {market.outcomes.map((o) => (
                <Odd key={o.code} outcome={o} style="row" />
              ))}
            </div>
          ) : null}

          {market.layout === "table" ? (
            <div>
              <div className="mb-1 grid text-center text-[11.5px] font-bold text-brand-ink/45" style={{ gridTemplateColumns: `58px repeat(${market.columns?.length ?? 2}, minmax(0,1fr))` }}>
                <span />
                {(market.columns ?? []).map((c) => (
                  <span key={c} className="capitalize">{c}</span>
                ))}
              </div>
              <div className="space-y-1">
                {rows.map(([line, outs]) => {
                  const isHandicap = market.key === "hcp_table" || market.key === "hcp1h";
                  const isHalfResult = market.key === "htft";
                  const label = isHandicap ? (Number(line) < 0 ? `0:${-Number(line)}` : `${line}:0`) : isHalfResult ? htName(String(line)) : line;
                  return (
                    <div key={String(line)} className="grid items-center gap-1.5" style={{ gridTemplateColumns: `58px repeat(${market.columns?.length ?? 2}, minmax(0,1fr))` }}>
                      <span className="grid h-[44px] place-items-center rounded-xl bg-[#f4f5f6] text-center text-[12px] font-bold tabular-nums leading-tight text-brand-ink/55">{label}</span>
                      {(market.columns ?? []).map((_, i) => (outs[i] ? <TableCell key={outs[i].code} outcome={outs[i]} /> : <span key={i} />))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {market.layout === "score" ? (
            <div>
              <div className="grid grid-cols-2 gap-2.5">
                {market.outcomes
                  .filter((o) => !o.code.startsWith("OTHER"))
                  .map((o) => (
                    <ScoreCard key={o.code} outcome={o} />
                  ))}
              </div>
              <div className="mt-2.5 space-y-2">
                {market.outcomes.filter((o) => o.code === "OTHER" || o.code.startsWith("OTHER")).map((o) => {
                  const pr = priceOf(o, now);
                  const on = slip.includes(o.key);
                  return (
                    <button
                      key={o.code}
                      onClick={() => toggle(o.key)}
                      aria-pressed={on}
                      disabled={pr.locked}
                      className={cn(
                        "flex w-full items-center justify-center gap-3 rounded-xl px-3.5 py-3 text-center transition active:scale-[0.98] disabled:opacity-60",
                        on ? "bg-brand-green text-white" : "bg-[#e9f6ee] text-brand-green-deep hover:bg-[#dcf2e4]",
                      )}
                    >
                      <span className="text-[15px] font-black">{o.label}</span>
                      <span className="text-[17px] font-black tabular-nums">{pr.locked ? "—" : pr.odds.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <p className="mt-2 text-[9.5px] font-semibold text-brand-ink/30">
            {matchId} · odds update live
          </p>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stats tab                                                           */
/* ------------------------------------------------------------------ */
function StatBar({ label, home, away, suffix = "", max }: { label: string; home: number; away: number; suffix?: string; max?: number }) {
  const hi = Math.max(home, away, 1);
  const scaleMax = max ?? hi;
  const hp = Math.round((home / scaleMax) * 100);
  const ap = Math.round((away / scaleMax) * 100);
  const homeLeads = home > away;
  const awayLeads = away > home;
  return (
    <div className="py-2">
      <div className="mb-1 flex items-center justify-between text-[12.5px] font-black tabular-nums">
        <span className={cn(homeLeads ? "text-brand-green-deep" : "text-brand-ink/70")}>{home}{suffix}</span>
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink/45">{label}</span>
        <span className={cn(awayLeads ? "text-brand-green-deep" : "text-brand-ink/70")}>{away}{suffix}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex h-[6px] flex-1 justify-end overflow-hidden rounded-full bg-black/[0.06]">
          <span className={cn("h-full rounded-full", homeLeads ? "bg-brand-green" : "bg-brand-ink/25")} style={{ width: `${hp}%` }} />
        </div>
        <div className="flex h-[6px] flex-1 overflow-hidden rounded-full bg-black/[0.06]">
          <span className={cn("h-full rounded-full", awayLeads ? "bg-brand-green" : "bg-brand-ink/25")} style={{ width: `${ap}%` }} />
        </div>
      </div>
    </div>
  );
}

function StatsPanel({ matchId }: { matchId: string }) {
  const now = useClock();
  const m = MATCH_BY_ID.get(matchId);
  if (!m) return null;
  const st = liveState(m, now);
  const stats = matchStats(m, now);
  const home = teamName(m.home);
  const away = teamName(m.away);
  const hHash = (m.id + ":h2h").length;
  const form = (side: "h" | "a") => Array.from({ length: 5 }, (_, i) => { const v = hash01(`${m.seed}:${side}:form:${i}`); return v < 0.45 ? "W" : v < 0.7 ? "D" : "L"; });
  const h2h = Array.from({ length: 5 }, (_, i) => ({ date: new Date(now - (i + 1) * 90 * 86_400_000), a: Math.floor(hash01(`${m.id}:h2h:${i}:a`) * 4), b: Math.floor(hash01(`${m.id}:h2h:${i}:b`) * 3) }));
  const homeWins = h2h.filter((g) => g.a > g.b).length;
  const draws = h2h.filter((g) => g.a === g.b).length;
  const rank = (seed: string) => 1 + Math.floor(hash01(seed + ":rank") * 18) + hHash * 0;

  if (!stats) {
    return <div className="p-3"><div className="rounded-xl bg-white p-6 text-center text-[12.5px] font-semibold text-brand-ink/45">Detailed statistics are available for football matches.</div></div>;
  }


  return (
    <div className="space-y-2.5 p-2.5">
      {/* team header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
        <div className="flex flex-col items-center gap-1"><Crest team={m.home} className="w-8" /><span className="line-clamp-2 text-center text-[11.5px] font-black leading-tight text-brand-ink">{home}</span><span className="text-[10px] font-bold text-brand-ink/40">#{rank(m.home)} in table</span></div>
        <div className="flex flex-col items-center">
          <span className="rounded-md bg-black/[0.05] px-2 py-0.5 text-[10px] font-black uppercase text-brand-ink/50">{st.phase === "pre" ? "Kick-off" : st.phase === "ft" ? "Full time" : st.label}</span>
          <span className="mt-1 text-[20px] font-black tabular-nums text-brand-ink">{st.phase === "pre" ? "vs" : `${st.score[0]} - ${st.score[1]}`}</span>
        </div>
        <div className="flex flex-col items-center gap-1"><Crest team={m.away} className="w-8" /><span className="line-clamp-2 text-center text-[11.5px] font-black leading-tight text-brand-ink">{away}</span><span className="text-[10px] font-bold text-brand-ink/40">#{rank(m.away)} in table</span></div>
      </div>

      {/* match stats */}
      <section className="rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13px] font-black tracking-tight text-brand-ink">Match statistics</h3>
          {st.phase === "pre" ? <span className="rounded-full bg-brand-green-soft px-2 py-0.5 text-[10px] font-black text-brand-green-deep">Pre-match averages</span> : <span className="flex items-center gap-1 text-[10.5px] font-bold text-brand-red"><span className="h-1.5 w-1.5 animate-live rounded-full bg-brand-red" />Live</span>}
        </div>
        <StatBar label="Possession" home={stats.possession[0]} away={stats.possession[1]} suffix="%" max={100} />
        <StatBar label="Expected goals (xG)" home={stats.xg[0]} away={stats.xg[1]} />
        <StatBar label="Shots" home={stats.shots[0]} away={stats.shots[1]} />
        <StatBar label="Shots on target" home={stats.shotsOnTarget[0]} away={stats.shotsOnTarget[1]} />
        <StatBar label="Big chances" home={stats.bigChances[0]} away={stats.bigChances[1]} />
        <StatBar label="Corners" home={stats.corners[0]} away={stats.corners[1]} />
        <StatBar label="Dangerous attacks" home={stats.dangerous[0]} away={stats.dangerous[1]} />
        <StatBar label="Fouls" home={stats.fouls[0]} away={stats.fouls[1]} />
        <StatBar label="Yellow cards" home={stats.yellow[0]} away={stats.yellow[1]} />
        <StatBar label="Red cards" home={stats.red[0]} away={stats.red[1]} />
        <StatBar label="Offsides" home={stats.offsides[0]} away={stats.offsides[1]} />
        <StatBar label="Saves" home={stats.saves[0]} away={stats.saves[1]} />
        <StatBar label="Passes" home={stats.passes[0]} away={stats.passes[1]} />
        <StatBar label="Pass accuracy" home={stats.passAccuracy[0]} away={stats.passAccuracy[1]} suffix="%" max={100} />
      </section>

      {/* momentum */}
      <section className="rounded-xl bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-[13px] font-black tracking-tight text-brand-ink">Momentum (attacks per 15 minutes)</h3>
        <div className="flex items-end gap-2">
          {stats.momentum.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-[70px] w-full items-end justify-center gap-1">
                <span className="w-1/3 rounded-t bg-brand-green" style={{ height: `${Math.max(3, (b.home / 100) * 70)}px` }} title={`${home}: ${b.home}`} />
                <span className="w-1/3 rounded-t bg-brand-yellow-deep" style={{ height: `${Math.max(3, (b.away / 100) * 70)}px` }} title={`${away}: ${b.away}`} />
              </div>
              <span className="text-[8.5px] font-bold text-brand-ink/40">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-4 text-[10.5px] font-bold text-brand-ink/55">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-green" />{home}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-yellow-deep" />{away}</span>
        </div>
      </section>

      {/* form & h2h */}
      <section className="rounded-xl bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-[13px] font-black tracking-tight text-brand-ink">Recent form (last 5)</h3>
        {[m.home, m.away].map((t, i) => (
          <div key={t} className="flex items-center gap-2 py-1">
            <Crest team={t} className="w-5" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-brand-ink">{teamName(t)}</span>
            <span className="flex gap-1">{form(i === 0 ? "h" : "a").map((r, k) => <span key={k} className={cn("grid h-5 w-5 place-items-center rounded text-[10px] font-black text-white", r === "W" ? "bg-brand-green" : r === "D" ? "bg-[#9ca3af]" : "bg-brand-red")}>{r}</span>)}</span>
          </div>
        ))}
        <div className="mt-2 flex overflow-hidden rounded-lg text-center text-[11px] font-bold">
          <div className="flex-1 bg-brand-green-soft py-2 text-brand-green-deep">{homeWins} wins</div>
          <div className="flex-1 bg-black/[0.05] py-2 text-brand-ink/60">{draws} draws</div>
          <div className="flex-1 bg-[#fde8e7] py-2 text-brand-red">{5 - homeWins - draws} wins</div>
        </div>
        <div className="mt-2 space-y-1">
          {h2h.map((g, i) => (
            <div key={i} className="flex items-center justify-between border-t border-black/[0.05] py-1.5 text-[11.5px] font-semibold text-brand-ink/65">
              <span className="w-14 text-[10px] font-bold text-brand-ink/35">{g.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
              <span className="min-w-0 flex-1 truncate">{home}</span>
              <span className="px-2 font-black text-brand-ink">{g.a} - {g.b}</span>
              <span className="min-w-0 flex-1 truncate text-right">{away}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-3 shadow-sm">
        <h3 className="mb-1 text-[13px] font-black tracking-tight text-brand-ink">Match information</h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
          {(([["Competition", m.league], ["Sport", isFootballLike(m) ? "Football" : "Basketball"], ["Match ID", m.id], ["Kick-off", kickoffLabel(m.kickoff, now)], ["Status", st.phase === "pre" ? "Not started" : st.phase === "ft" ? "Finished" : "In play"], ["Live markets", isFootballLike(m) ? "Yes" : "—"]] as [string, string][])).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-black/[0.05] py-1"><dt className="text-brand-ink/45">{k}</dt><dd className="truncate text-right font-bold text-brand-ink">{v}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the screen                                                          */
/* ------------------------------------------------------------------ */
export function MatchSheet({ matchId }: { matchId: string }) {
  const { close, go, favourites, toggleFav, slip, setSlipOpen } = useStore();
  const now = useClock();
  const m = MATCH_BY_ID.get(matchId);
  const [group, setGroup] = useState<MarketGroup | "all" | "fav">("all");
  const [tab, setTab] = useState<"markets" | "stats">("markets");
  const [favs, setFavs] = useState<string[]>(loadFavs);
  if (!m) return null;

  const st = liveState(m, now);
  const markets = marketsFor(m.id);
  const fav = favourites.includes(m.id);
  const isFavMarket = (k: string) => favs.includes(`${m.id}|${k}`);
  const toggleFavMarket = (key: string) => {
    const id = `${m.id}|${key}`;
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next);
    saveFavs(next);
  };

  const shown = markets.filter((mk) => {
    if (group === "all") return true;
    if (group === "fav") return isFavMarket(mk.key);
    return mk.group === group;
  });

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-[#f1f3f5]">
      {/* top bar */}
      <div className="shrink-0 bg-brand-yellow">
        <div className="flex h-12 items-center gap-2 px-2">
          <button onClick={close} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-brand-ink active:bg-black/10">
            <ChevronLeft className="h-6 w-6" strokeWidth={2.6} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-black tracking-tight text-brand-ink">Details</h1>
          <button onClick={() => go({ name: "home" })} aria-label="Home" className="grid h-9 w-9 place-items-center rounded-full text-brand-ink active:bg-black/10">
            <HomeIcon className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-24">
        {/* scoreboard */}
        <div className="border-b border-black/[0.06] bg-white px-4 pb-3 pt-3">
          <p className="text-center text-[11.5px] font-semibold text-brand-green-deep underline decoration-brand-green/40 underline-offset-2">{m.league}</p>
          <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-brand-ink/35">
            {isFootballLike(m) ? "Football" : "Basketball"} · ID {m.id}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <Crest team={m.home} className="w-11" />
              <span className="line-clamp-2 max-w-full px-0.5 text-center text-[12.5px] font-black leading-[1.2] tracking-tight text-brand-ink [overflow-wrap:anywhere]">{teamName(m.home)}</span>
            </div>
            <div className="flex w-[104px] shrink-0 flex-col items-center">
              {st.phase === "live" ? (
                <>
                  <p className="text-[26px] font-black leading-none tabular-nums text-brand-red">{st.score[0]} - {st.score[1]}</p>
                  <span className="mt-1 flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-black uppercase text-brand-red">
                    <span className="h-1.5 w-1.5 animate-live rounded-full bg-brand-red" /> {st.label}
                  </span>
                </>
              ) : (
                <>
                  <span className="rounded-md bg-black/[0.05] px-2 py-1 text-[11px] font-black text-brand-ink/60">VS</span>
                  <span className="mt-1 text-center text-[10.5px] font-bold text-brand-ink/50">{kickoffLabel(m.kickoff, now)}</span>
                </>
              )}
              <button onClick={() => toggleFav(m.id)} aria-label="Favourite match" className="mt-1.5">
                <StarIcon className={cn("h-[18px] w-[18px]", fav ? "fill-brand-yellow-deep text-brand-yellow-deep" : "text-brand-ink/25")} strokeWidth={2} />
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <Crest team={m.away} className="w-11" />
              <span className="line-clamp-2 max-w-full px-0.5 text-center text-[12.5px] font-black leading-[1.2] tracking-tight text-brand-ink [overflow-wrap:anywhere]">{teamName(m.away)}</span>
            </div>
          </div>
          {st.suspended ? <p className="mt-2 rounded-lg bg-[#fff4c2] py-1 text-center text-[10.5px] font-bold text-[#8a6100]">Markets temporarily suspended</p> : null}
        </div>

        {/* Markets / Stats */}
        <div className="grid grid-cols-2 bg-white">
          {(["markets", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("relative py-2.5 text-[15px] capitalize tracking-tight", tab === t ? "font-black text-brand-ink" : "font-semibold text-brand-ink/45")}
            >
              {t === "markets" ? "Markets" : "Stats"}
              {t === "stats" ? <span className="ml-1 rounded bg-brand-green px-1.5 py-0.5 align-middle text-[9px] font-black uppercase text-white">New</span> : null}
              {tab === t ? <span className="absolute inset-x-[28%] bottom-0 h-[3px] rounded-full bg-brand-green" /> : null}
            </button>
          ))}
        </div>

        {tab === "stats" ? (
          <StatsPanel matchId={m.id} />
        ) : (
          <>
        {/* filters */}
        <div className="no-scrollbar flex gap-4 overflow-x-auto border-b border-black/[0.06] bg-white px-4">
          {marketGroups.map((g) => (
            <button key={g.key} onClick={() => setGroup(g.key)} className={cn("relative shrink-0 whitespace-nowrap py-2.5 text-[12.5px]", group === g.key ? "font-black text-brand-ink" : "font-semibold text-brand-ink/45")}>
              {g.label}
              {group === g.key ? <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-brand-green" /> : null}
            </button>
          ))}
        </div>

        {/* markets */}
        <div className="space-y-2.5 p-2.5">
          {shown.length ? (
            shown.map((mk) => <MarketBlock key={mk.key} market={mk} matchId={m.id} fav={isFavMarket(mk.key)} onFav={() => toggleFavMarket(mk.key)} />)
          ) : (
            <div className="rounded-xl bg-white p-6 text-center text-[12.5px] font-semibold text-brand-ink/45">
              {group === "fav" ? "You have not starred any markets for this match yet. Tap the star next to a market to add it here." : "No markets in this group."}
            </div>
          )}
          {!isFootballLike(m) ? <p className="pb-2 text-center text-[10.5px] font-semibold text-brand-ink/35">Football markets (correct score, half-time, handicaps) appear on football matches.</p> : null}
        </div>
          </>
        )}
      </div>

      {/* floating betslip */}
      <button onClick={() => setSlipOpen(true)} aria-label={`Open betslip (${slip.length})`} className="absolute bottom-4 right-3 z-10 flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-brand-yellow text-brand-ink shadow-[0_12px_24px_-8px_rgba(16,19,26,0.6)] ring-2 ring-white active:scale-95">
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand-ink px-1 text-[13px] font-black text-white">{slip.length}</span>
        <span className="text-[8.5px] font-black uppercase tracking-tight">Betslip</span>
      </button>

    </div>
  );
}
