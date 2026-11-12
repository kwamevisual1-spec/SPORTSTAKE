import { useState } from "react";
import { ALL_MATCHES, SPORTS, SPORT_LABEL, phaseOf, teamName, todaysFootball, type Match, type SportKey } from "../data";
import { predictionFor, primaryMarket } from "../lib/markets";
import { liveState } from "../lib/sim";
import { kickoffLabel } from "../lib/format";
import { useClock } from "../lib/clock";
import { SCREENS, useStore } from "../store";
import { cn } from "../utils/cn";
import { Crest } from "./Crest";
import { LiveBadge, MatchRow, OutcomeButton } from "./MatchRow";
import { inTab, sportIcon } from "./SportsbookScreen";
import { ChartIcon, ChevronRight, FlameIcon, RobotIcon, StarIcon } from "./Icons";

type Panel = "top" | "games" | "predictions";

function topFor(sport: SportKey, now: number): Match[] {
  return ALL_MATCHES.filter((m) => m.sport === sport && inTab(m, "today", now))
    .sort((a, b) => Number(Boolean(b.hot)) - Number(Boolean(a.hot)) || Number(phaseOf(b, now) === "live") - Number(phaseOf(a, now) === "live") || a.kickoff - b.kickoff)
    .slice(0, 8);
}

function MatchCard({ match }: { match: Match }) {
  const { open, favourites, toggleFav } = useStore();
  const now = useClock();
  const st = liveState(match, now);
  const fav = favourites.includes(match.id);
  const market = primaryMarket(match);

  return (
    <article onClick={() => open({ type: "match", matchId: match.id })} className="w-[278px] shrink-0 cursor-pointer snap-start rounded-2xl bg-white p-3 shadow-[0_10px_24px_-16px_rgba(16,19,26,0.55)] ring-1 ring-black/[0.04]">
      <header className="mb-2 flex items-center gap-1.5">
        {match.hot ? (
          <span className="flex items-center gap-0.5 rounded-md bg-gradient-to-r from-[#ff6a00] to-[#ee0979] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
            <FlameIcon className="h-2.5 w-2.5" strokeWidth={2.6} /> Hot
          </span>
        ) : (
          <span className="rounded-md bg-brand-green-soft px-1.5 py-0.5 text-[9px] font-black uppercase text-brand-green-deep">{match.country}</span>
        )}
        <p className="min-w-0 flex-1 truncate text-center text-[10.5px] font-bold text-brand-ink/55">{match.league}</p>
        <button aria-label="Favourite" onClick={(e) => (e.stopPropagation(), toggleFav(match.id))}>
          <StarIcon className={cn("h-3.5 w-3.5", fav ? "fill-brand-yellow-deep text-brand-yellow-deep" : "text-brand-ink/25")} strokeWidth={2} />
        </button>
        <button aria-label="Statistics" onClick={(e) => (e.stopPropagation(), open({ type: "match", matchId: match.id }))}>
          <ChartIcon className="h-3.5 w-3.5 text-brand-ink/35" strokeWidth={2} />
        </button>
      </header>

      <div className="flex items-center">
        <div className="flex flex-1 flex-col items-center gap-1">
          <Crest team={match.home} className="w-9" />
          <span className="line-clamp-2 max-w-[96px] text-center text-[12px] font-extrabold leading-tight tracking-tight text-brand-ink">{teamName(match.home)}</span>
        </div>
        <div className="flex w-[84px] flex-col items-center">
          {st.phase === "live" ? (
            <>
              <div className="text-[19px] font-black leading-none tabular-nums text-brand-red">
                {st.score[0]} : {st.score[1]}
              </div>
              <span className="mt-1">
                <LiveBadge st={st} compact />
              </span>
            </>
          ) : (
            <span className="text-center text-[11px] font-bold leading-tight text-brand-ink/65">{kickoffLabel(match.kickoff, now)}</span>
          )}
          <span className="mt-1 text-[10px] font-bold text-brand-ink/40">{market.title}</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <Crest team={match.away} className="w-9" />
          <span className="line-clamp-2 max-w-[96px] text-center text-[12px] font-extrabold leading-tight tracking-tight text-brand-ink">{teamName(match.away)}</span>
        </div>
      </div>

      <div className={cn("mt-2.5 grid gap-1.5", market.outcomes.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {market.outcomes.map((o) => (
          <OutcomeButton key={o.key} outcome={o} size="sm" />
        ))}
      </div>
      <p className="mt-1.5 text-center text-[9.5px] font-bold text-brand-ink/35">+{match.extraMarkets} more markets</p>
    </article>
  );
}

export function TopMatches() {
  const { push, slip, toggle } = useStore();
  const now = useClock();
  const [panel, setPanel] = useState<Panel>("top");
  const [sport, setSport] = useState<SportKey>("football");

  const cards = topFor(sport, now);
  const today = todaysFootball(now);
  const notStarted = today.filter((m) => phaseOf(m, now) === "today").sort((a, b) => a.kickoff - b.kickoff);
  const predictions = notStarted
    .map((m) => ({ m, p: predictionFor(m) }))
    .sort((a, b) => b.p.confidence - a.p.confidence)
    .slice(0, 6);

  const tabs: { key: Panel; label: string }[] = [
    { key: "top", label: "Top Matches" },
    { key: "games", label: "Football Games" },
    { key: "predictions", label: "Predictions" },
  ];

  return (
    <section className="mx-3 rounded-3xl bg-brand-green-soft p-3 md:p-4">
      <div className="no-scrollbar flex items-end gap-4 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setPanel(t.key)} className={cn("relative shrink-0 pb-1.5 tracking-tight transition-colors", panel === t.key ? "text-[18px] font-black text-brand-green-deep" : "text-[14px] font-bold text-brand-ink/55")}>
            {t.label}
            {panel === t.key ? <span className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-brand-green" /> : null}
          </button>
        ))}
      </div>

      {panel === "top" ? (
        <>
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold tracking-tight transition active:scale-95",
                  sport === s ? "border border-brand-green bg-white text-brand-green-deep shadow-sm" : "border border-transparent bg-white/60 text-brand-ink/55",
                )}
              >
                {sportIcon(s, "h-3.5 w-3.5")}
                {SPORT_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="no-scrollbar -mx-3 mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-1 md:-mx-4 md:px-4">
            {cards.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
            <button onClick={() => push(sport === "football" ? SCREENS.today() : SCREENS.sport(sport))} className="flex w-[110px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 text-brand-green-deep active:scale-95">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-green shadow-sm">
                <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
              </span>
              <span className="text-[11.5px] font-extrabold">View all</span>
            </button>
          </div>
        </>
      ) : null}

      {panel === "games" ? (
        <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.04]">
          {notStarted.slice(0, 5).map((m) => (
            <MatchRow key={m.id} match={m} market="1x2" />
          ))}
          <button onClick={() => push(SCREENS.today())} className="w-full py-3 text-[12px] font-black text-brand-green-deep active:bg-brand-green-soft">
            All of today's football ({today.length}) →
          </button>
        </div>
      ) : null}

      {panel === "predictions" ? (
        <div className="mt-3 space-y-2">
          {predictions.map(({ m, p }) => {
            const added = slip.includes(p.outcome.key);
            return (
              <div key={m.id} className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-black/[0.04]">
                <div className="flex shrink-0 items-center">
                  <Crest team={m.home} className="w-7" />
                  <Crest team={m.away} className="-ml-2 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold tracking-tight text-brand-ink">
                    {teamName(m.home)} vs {teamName(m.away)}
                  </p>
                  <p className="truncate text-[10.5px] font-semibold text-brand-ink/50">
                    <RobotIcon className="mr-1 inline h-3 w-3 text-[#2563eb]" strokeWidth={2.2} />
                    {p.outcome.marketTitle}: <b className="text-brand-ink/75">{p.outcome.label}</b> @ {p.odds.toFixed(2)} · {kickoffLabel(m.kickoff, now)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[12px] font-black text-brand-green-deep">{p.confidence}%</span>
                  <button onClick={() => toggle(p.outcome.key)} className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-black", added ? "bg-brand-green text-white" : "bg-brand-green-soft text-brand-green-deep")}>
                    {added ? "Added ✓" : "+ Add"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
