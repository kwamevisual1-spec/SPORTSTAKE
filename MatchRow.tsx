import { useEffect, useRef, useState } from "react";
import { isVirtual, teamName, type Match } from "../data";
import { marketFor, priceOf, type MarketKey, type Outcome } from "../lib/markets";
import { liveState, type LiveState } from "../lib/sim";
import { kickoffLabel } from "../lib/format";
import { useClock } from "../lib/clock";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { Crest } from "./Crest";
import { ChartIcon, LockIcon, StarIcon } from "./Icons";

export function OutcomeButton({ outcome, size = "md", showShort = true }: { outcome: Outcome; size?: "sm" | "md"; showShort?: boolean }) {
  const { slip, toggle } = useStore();
  const now = useClock();
  const price = priceOf(outcome, now);
  const active = slip.includes(outcome.key);
  const prev = useRef(price.odds);
  const [dir, setDir] = useState<0 | 1 | -1>(0);

  useEffect(() => {
    if (price.locked) return;
    if (price.odds !== prev.current) {
      setDir(price.odds > prev.current ? 1 : -1);
      prev.current = price.odds;
    }
  }, [price.odds, price.locked]);

  useEffect(() => {
    if (!dir) return;
    const t = window.setTimeout(() => setDir(0), 4000);
    return () => window.clearTimeout(t);
  }, [dir, price.odds]);

  // extremely long prices are effectively unavailable – show them as suspended in the list
  if (price.locked || price.odds >= 100) {
    return (
      <div
        title="Market suspended"
        className={cn("grid w-full place-items-center rounded-xl bg-[#eceef2] text-brand-ink/30", size === "sm" ? "h-10" : "h-[52px]", active && "ring-2 ring-brand-green/50")}
      >
        <LockIcon className="h-4 w-4" strokeWidth={2.2} />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle(outcome.key);
      }}
      aria-pressed={active}
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl transition-all duration-150 active:scale-95",
        size === "sm" ? "h-10" : "h-[52px]",
        active ? "bg-brand-green text-white shadow-[0_6px_14px_-6px_rgba(23,163,74,0.9)]" : "bg-brand-green-soft text-brand-green-deep hover:bg-[#d6f5e2]",
      )}
    >
      <span className={cn("font-black leading-none tracking-tight tabular-nums", size === "sm" ? "text-[13px]" : "text-[16px]")}>{price.odds.toFixed(2)}</span>
      {showShort ? (
        <span className={cn("mt-1 max-w-full truncate px-1 text-[9.5px] font-bold leading-none", active ? "text-white/80" : "text-brand-green/65")}>{outcome.short}</span>
      ) : null}
      {dir === 1 ? <span className="absolute right-1 top-1 h-0 w-0 border-x-[4px] border-b-[6px] border-x-transparent border-b-[#16a34a]" /> : null}
      {dir === -1 ? <span className="absolute bottom-1 right-1 h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-[#e8342e]" /> : null}
    </button>
  );
}

export function LiveBadge({ st, compact }: { st: LiveState; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-black tabular-nums text-brand-red", compact ? "text-[10.5px]" : "text-[11.5px]")}>
      <span className="h-1.5 w-1.5 animate-live rounded-full bg-brand-red" />
      {st.label}
    </span>
  );
}

export function MatchRow({ match, market, hideLeague }: { match: Match; market: MarketKey; hideLeague?: boolean }) {
  const { open, favourites, toggleFav } = useStore();
  const now = useClock();
  const st = liveState(match, now);
  const mk = marketFor(match.id, market);
  const fav = favourites.includes(match.id);
  const goalFlash = st.goalAt !== null && now - st.goalAt < (isVirtual(match) ? 6_000 : 60_000);

  if (st.phase === "ft") return null;

  return (
    <article
      onClick={() => open({ type: "match", matchId: match.id })}
      className="cursor-pointer border-b border-black/[0.06] bg-white px-3 py-3 transition last:border-0 hover:bg-[#fcfcfd] active:bg-black/[0.015] md:px-4"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        {isVirtual(match) ? <span className="rounded bg-[#1f9dff] px-1.5 py-0.5 text-[9px] font-black italic text-white">Virtual</span> : null}
        {st.phase === "live" ? <span className="rounded bg-brand-red px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Live</span> : null}
        {!hideLeague ? <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-brand-ink/45">{match.league}</span> : <span className="flex-1" />}
        <button
          aria-label={fav ? "Remove from favourites" : "Add to favourites"}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(match.id);
          }}
          className="grid h-6 w-6 place-items-center"
        >
          <StarIcon className={cn("h-3.5 w-3.5", fav ? "fill-brand-yellow-deep text-brand-yellow-deep" : "text-brand-ink/25")} strokeWidth={2} />
        </button>
        <button
          aria-label="Match statistics"
          onClick={(e) => {
            e.stopPropagation();
            open({ type: "match", matchId: match.id });
          }}
          className="grid h-6 w-6 place-items-center"
        >
          <ChartIcon className="h-3.5 w-3.5 text-brand-ink/35" strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {[match.home, match.away].map((club, i) => (
            <div key={club} className="flex items-center gap-2 py-[3px]">
              <Crest team={club} className="w-[18px]" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold tracking-tight text-brand-ink md:text-[13.5px]">{teamName(club)}</span>
              {goalFlash && st.goalSide === i ? <span className="animate-pop rounded bg-brand-red px-1 py-[1px] text-[8.5px] font-black text-white">GOAL</span> : null}
              {st.phase === "live" ? <span className="w-6 text-right text-[13.5px] font-black tabular-nums text-brand-red">{st.score[i]}</span> : null}
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2 text-[10.5px] font-bold">
            {st.phase === "live" ? <LiveBadge st={st} compact /> : <span className="text-brand-ink/45">{kickoffLabel(match.kickoff, now)}</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                open({ type: "match", matchId: match.id });
              }}
              className="text-brand-ink/45 underline-offset-2 hover:underline"
            >
              +{match.extraMarkets} Markets
            </button>
          </div>
        </div>

        <div className={cn("grid shrink-0 gap-1.5", mk.outcomes.length === 3 ? "w-[176px] grid-cols-3 md:w-[228px]" : "w-[124px] grid-cols-2 md:w-[160px]")}>
          {mk.outcomes.map((o) => (
            <OutcomeButton key={o.key} outcome={o} />
          ))}
        </div>
      </div>
    </article>
  );
}
