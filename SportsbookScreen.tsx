import { useState } from "react";
import { ALL_MATCHES, SPORTS, SPORT_LABEL, inWindow, isNext6h, phaseOf, type Match, type SportKey } from "../data";
import { chipsFor, primaryMarket, priceOf, type MarketKey } from "../lib/markets";
import { useClock } from "../lib/clock";
import { useStore, type BookScreen, type BookTab } from "../store";
import { cn } from "../utils/cn";
import { MatchRow } from "./MatchRow";
import { BasketIcon, ChevronDown, FootballIcon, GridIcon, SortIcon, VirtualIcon } from "./Icons";
import { Chip, EmptyState, ScreenHeader } from "./ui";

const TAB_LABEL: Record<BookTab, string> = {
  live: "Live",
  next6h: "Upcoming (Next 6H)",
  today: "Today",
  upcoming: "Upcoming",
};

const EURO = ["All", "England", "Spain", "Italy", "Germany", "France"];

export function sportIcon(sport: SportKey, className = "h-5 w-5") {
  if (sport === "football") return <FootballIcon className={className} strokeWidth={2} />;
  if (sport === "v-football") return <VirtualIcon className={className} strokeWidth={2} />;
  if (sport === "basketball") return <BasketIcon className={className} strokeWidth={2} />;
  return (
    <span className="relative">
      <BasketIcon className={className} strokeWidth={2} />
      <span className="absolute -bottom-1 -right-1.5 text-[8px] font-black">V</span>
    </span>
  );
}

export function inTab(m: Match, tab: BookTab, now: number) {
  const ph = phaseOf(m, now);
  if (ph === "ft") return false;
  if (tab === "live") return ph === "live";
  if (tab === "next6h") return isNext6h(m, now);
  if (!inWindow(m, now) && ph !== "live") return false;
  if (tab === "today") return ph === "live" || ph === "today";
  return ph === "upcoming";
}

export function SportsbookScreen({ screen }: { screen: BookScreen }) {
  const { back, canBack, open } = useStore();
  const now = useClock();
  const [sport, setSport] = useState<SportKey>(screen.sport);
  const [tab, setTab] = useState<BookTab>(screen.tab);
  const [market, setMarket] = useState<MarketKey>(chipsFor(screen.sport)[0].key);
  const [sort, setSort] = useState<"time" | "league">("time");
  const [country, setCountry] = useState("All");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const presetOk = (m: Match) => {
    if (screen.preset === "euro") return EURO.includes(m.country) && (country === "All" || m.country === country);
    if (screen.preset === "sure") return phaseOf(m, now) !== "live" && Math.min(...primaryMarket(m).outcomes.map((o) => priceOf(o, m.kickoff - 60_000).odds)) <= 1.6;
    return true;
  };

  const base = ALL_MATCHES.filter(presetOk);
  const countFor = (s: SportKey, t: BookTab) => base.filter((m) => m.sport === s && inTab(m, t, now)).length;

  const list = base
    .filter((m) => m.sport === sport && inTab(m, tab, now))
    .sort((a, b) => {
      const la = phaseOf(a, now) === "live";
      const lb = phaseOf(b, now) === "live";
      return la !== lb ? (la ? -1 : 1) : a.kickoff - b.kickoff;
    });
  const map = new Map<string, Match[]>();
  for (const m of list) map.set(m.league, [...(map.get(m.league) ?? []), m]);
  const groups = [...map.entries()];
  if (sort === "league") groups.sort((a, b) => a[0].localeCompare(b[0]));

  const total = list.length;
  const alternative = screen.tabs.find((t) => t !== tab && countFor(sport, t) > 0);
  const chips = chipsFor(sport);
  const cols = chips.find((c) => c.key === market) ? market : chips[0].key;
  const labels = primaryLabels(sport, cols);

  return (
    <div className="min-h-full bg-[#f3f4f6] pb-28 lg:pb-8">
      <ScreenHeader
        title={screen.title}
        onBack={canBack ? back : undefined}
        right={
          <button onClick={() => setSort((s) => (s === "time" ? "league" : "time"))} className="flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-brand-ink/70">
            <SortIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
            {sort === "time" ? "By time" : "By league"}
          </button>
        }
      />

      {screen.showSports ? (
        <div className="no-scrollbar flex gap-3 overflow-x-auto border-b border-black/[0.06] bg-white px-3 py-3">
          {SPORTS.map((s) => {
            const active = s === sport;
            return (
              <button
                key={s}
                onClick={() => {
                  setSport(s);
                  setMarket(chipsFor(s)[0].key);
                }}
                className="flex w-[66px] shrink-0 flex-col items-center gap-1"
              >
                <span className={cn("relative grid h-12 w-12 place-items-center rounded-full transition", active ? "bg-brand-green text-white shadow-[0_8px_16px_-8px_rgba(23,163,74,0.9)]" : "bg-black/[0.05] text-brand-ink/75")}>
                  {sportIcon(s)}
                  <span className="absolute -right-2 -top-1 min-w-[22px] rounded-full bg-[#ff6b6b] px-1.5 py-[1px] text-center text-[9.5px] font-black text-white">{countFor(s, tab)}</span>
                </span>
                <span className={cn("text-center text-[11px] font-bold leading-tight", active ? "text-brand-green-deep" : "text-brand-ink/65")}>{SPORT_LABEL[s]}</span>
              </button>
            );
          })}
          <button onClick={() => open({ type: "allSports" })} className="flex w-[60px] shrink-0 flex-col items-center gap-1">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-black/[0.05] text-brand-ink/75">
              <GridIcon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11px] font-bold leading-tight text-brand-ink/65">All Sports</span>
          </button>
        </div>
      ) : null}

      <div className="bg-white">
        <div className="no-scrollbar flex items-center gap-5 overflow-x-auto px-3 pt-3">
          {screen.tabs.map((t) => {
            const active = t === tab;
            return (
              <button key={t} onClick={() => setTab(t)} className={cn("relative shrink-0 pb-2 text-[15px] tracking-tight", active ? "font-black text-brand-green-deep" : "font-bold text-brand-ink/45")}>
                {TAB_LABEL[t]} <span className="text-[11px] font-bold opacity-70">({countFor(sport, t)})</span>
                {active ? <span className="absolute bottom-0 left-0 h-[3px] w-8 rounded-full bg-brand-green" /> : null}
              </button>
            );
          })}
        </div>

        {screen.preset === "euro" ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-2">
            {EURO.map((c) => (
              <button key={c} onClick={() => setCountry(c)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold", country === c ? "border-brand-green bg-brand-green-soft text-brand-green-deep" : "border-black/10 text-brand-ink/55")}>
                {c}
              </button>
            ))}
          </div>
        ) : null}
        {screen.preset === "sure" ? <p className="px-3 pt-2 text-[11px] font-semibold text-brand-ink/45">Strong favourites priced at 1.60 or lower – ideal for accumulators.</p> : null}

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
          {chips.map((c) => (
            <Chip key={c.key} active={cols === c.key} onClick={() => setMarket(c.key)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="m-3 rounded-2xl bg-white">
          <EmptyState
            icon={sportIcon(sport, "h-7 w-7")}
            title={`No ${TAB_LABEL[tab].toLowerCase()} ${SPORT_LABEL[sport]} events`}
            text="Events for this filter will appear here as soon as they are available."
            action={
              alternative ? (
                <button onClick={() => setTab(alternative)} className="rounded-full bg-brand-green px-4 py-2 text-[12px] font-black text-white">
                  View {TAB_LABEL[alternative]} ({countFor(sport, alternative)})
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        groups.map(([league, items]) => {
          const isCollapsed = collapsed[league];
          return (
            <section key={league} className="mt-2">
              <button onClick={() => setCollapsed((c) => ({ ...c, [league]: !c[league] }))} className="flex w-full items-center justify-between bg-[#e9ebef] px-3 py-2.5 text-left md:px-4">
                <span className="min-w-0 truncate text-[13px] font-black tracking-tight text-brand-ink">
                  {league} <span className="font-bold text-brand-ink/45">({items.length})</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-brand-ink/50 transition", isCollapsed ? "" : "rotate-180")} strokeWidth={2.4} />
              </button>
              {!isCollapsed ? (
                <>
                  <div className="flex justify-end bg-white px-3 pt-1.5 md:px-4">
                    <div className={cn("grid gap-1.5 text-center text-[11px] font-bold text-brand-ink/40", labels.length === 3 ? "w-[176px] grid-cols-3 md:w-[228px]" : "w-[124px] grid-cols-2 md:w-[160px]")}>
                      {labels.map((l) => (
                        <span key={l}>{l}</span>
                      ))}
                    </div>
                  </div>
                  {items.map((m) => (
                    <MatchRow key={m.id} match={m} market={cols} hideLeague />
                  ))}
                </>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

function primaryLabels(sport: SportKey, market: MarketKey) {
  if (market === "1x2" || market === "ml") return sport === "football" || sport === "v-football" ? ["1", "X", "2"] : ["1", "2"];
  if (market === "dc") return ["1X", "12", "X2"];
  if (market === "btts") return ["GG", "NG"];
  if (market === "hcp") return ["Home", "Away"];
  return ["Over", "Under"];
}
