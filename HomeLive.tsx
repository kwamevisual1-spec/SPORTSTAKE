import { useState } from "react";
import { ALL_MATCHES, SPORTS, SPORT_LABEL, phaseOf, todaysFootball, type SportKey } from "../data";
import { chipsFor } from "../lib/markets";
import { useClock } from "../lib/clock";
import { SCREENS, useStore } from "../store";
import { cn } from "../utils/cn";
import { inTab } from "./SportsbookScreen";
import { MatchRow } from "./MatchRow";
import { ChevronDown, ChevronRight } from "./Icons";

/** Compact live preview on the casino-first home page. Full sportsbook stays one tap away. */
export function HomeLive() {
  const { push } = useStore();
  const now = useClock();
  const [sport, setSport] = useState<SportKey>("football");
  const [expanded, setExpanded] = useState(false);

  const live = ALL_MATCHES.filter((m) => m.sport === sport && phaseOf(m, now) === "live");
  const later = ALL_MATCHES.filter((m) => m.sport === sport && inTab(m, "today", now) && phaseOf(m, now) === "today").sort((a, b) => a.kickoff - b.kickoff);
  const market = chipsFor(sport)[0].key;
  const today = todaysFootball(now).length;
  const visibleLive = expanded ? live : live.slice(0, 2);
  const visibleLater = expanded ? later.slice(0, 6) : later.slice(0, 2);
  const more = live.length > 2 || later.length > 2;

  return (
    <section className="mt-3 overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_30px_-24px_rgba(16,19,26,0.6)] md:mx-3 md:rounded-3xl">
      <div className="flex items-stretch border-b border-black/[0.06]">
        <div className="flex items-center border-r border-black/[0.08] px-3">
          <span className="flex items-center gap-1.5 text-[21px] font-black tracking-tight text-brand-ink">
            Live
            <span className="h-2 w-2 animate-live rounded-full bg-brand-red" />
          </span>
        </div>
        <div className="no-scrollbar flex flex-1 gap-4 overflow-x-auto px-3 pt-2.5">
          {SPORTS.map((s) => {
            const active = s === sport;
            const count = ALL_MATCHES.filter((m) => m.sport === s && phaseOf(m, now) === "live").length;
            return (
              <button key={s} onClick={() => setSport(s)} className={cn("relative shrink-0 pb-2 text-[13px] tracking-tight", active ? "font-black text-brand-green-deep" : "font-bold text-brand-ink/50")}>
                {SPORT_LABEL[s]} <span className="text-[10px] opacity-70">{count}</span>
                {active ? <span className="absolute bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-brand-green" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#f6f7f9] px-3 py-1.5">
        <p className="text-[11px] font-black tracking-tight text-brand-ink">{sport === "football" ? "Today's live football" : `Live ${SPORT_LABEL[sport]}`}</p>
        <span className="text-[10px] font-bold text-brand-ink/45">
          {live.length} live{sport === "football" ? ` · ${today - live.length} still to kick off` : ""}
        </span>
      </div>

      {visibleLive.length ? visibleLive.map((m) => <MatchRow key={m.id} match={m} market={market} />) : <p className="px-3 py-4 text-center text-[11.5px] font-semibold text-brand-ink/45">No live {SPORT_LABEL[sport]} right now.</p>}

      <button onClick={() => push(SCREENS.live(sport))} className="flex w-full items-center justify-center gap-1 border-y border-black/[0.06] py-2 text-[11.5px] font-black text-brand-green-deep active:bg-brand-green-soft">
        All live {SPORT_LABEL[sport]} ({live.length})
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
      </button>

      {later.length ? (
        <>
          <div className="flex items-center justify-between bg-[#f6f7f9] px-3 py-1.5">
            <p className="text-[11px] font-black tracking-tight text-brand-ink">{sport.startsWith("v-") ? "Next rounds" : "Kicking off later today"}</p>
            <span className="text-[10px] font-bold text-brand-ink/45">{later.length} matches</span>
          </div>
          {visibleLater.map((m) => (
            <MatchRow key={m.id} match={m} market={market} />
          ))}
          <button onClick={() => push(sport === "football" ? SCREENS.today() : SCREENS.sport(sport))} className="flex w-full items-center justify-center gap-1 py-2 text-[11.5px] font-black text-brand-green-deep active:bg-brand-green-soft">
            {sport === "football" ? `View all today's football (${today})` : `View all ${SPORT_LABEL[sport]}`}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
        </>
      ) : null}

      {more ? (
        <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 border-t border-black/[0.06] py-2 text-[11px] font-bold text-brand-ink/50 active:bg-black/[0.03]">
          {expanded ? "Show less" : "Show more live & upcoming"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")} strokeWidth={2.4} />
        </button>
      ) : null}
    </section>
  );
}
