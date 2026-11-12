import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CRASH_IDS,
  FESTIVAL_IDS,
  FEATURED_IDS,
  GAMES,
  INSTANT_IDS,
  NUMBER_CARD_IDS,
  SLOT_IDS,
  STUDIO,
  gamesByIds,
  type Game,
} from "../games/catalog";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { GameArt, GameTile } from "./GameTile";
import { BigWinsTicker } from "./BigWinsTicker";
import { BoltIcon, ChevronRight, FlameIcon, GridIcon, LockIcon, PlaneIcon, SearchIcon, StarIcon, TicketIcon } from "./Icons";

const CATEGORIES = [
  { id: "all", label: "All games", Icon: GridIcon },
  { id: "popular", label: "Popular now", Icon: FlameIcon },
  { id: "Crash", label: "Crash & flight", Icon: PlaneIcon },
  { id: "Slots", label: "Slots & jackpots", Icon: StarIcon },
  { id: "Instant", label: "Instant & arcade", Icon: BoltIcon },
  { id: "Numbers", label: "Numbers", Icon: GridIcon },
  { id: "Cards", label: "Cards & tables", Icon: TicketIcon },
] as const;
type CategoryId = (typeof CATEGORIES)[number]["id"];

const HERO = [
  { id: "chicken-road", eyebrow: "NEW GAME COLLECTION", title: "Chicken Road Festival", text: "Four roads. One brave chicken. Cross lane by lane and cash out before the traffic.", theme: "chicken" as const },
  { id: "aviator", eyebrow: "CRASH LEGENDS", title: "Aviator", text: "Watch the multiplier climb and cash out before the plane flies away.", theme: "rocket" as const },
  { id: "golden-kente", eyebrow: "MEGA JACKPOT", title: "Golden Kente", text: "Royal kente riches across five reels and five paylines, with cascading wins.", theme: "cascade" as const },
];

function HeroCarousel({ onPlay }: { onPlay: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % HERO.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
      setActive(next);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]">
      <div ref={ref} onScroll={() => { const el = ref.current; if (el) setActive(Math.round(el.scrollLeft / el.clientWidth)); }} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {HERO.map((h) => (
          <article key={h.id} className="relative h-[190px] w-full shrink-0 snap-start overflow-hidden sm:h-[220px]">
            <GameArt game={{ ...({} as Game), poster: h.theme, art: "", id: h.id, name: h.title, tileTitle: h.title, engine: "crash", category: "Crash", accent: "#000", rtp: 96, players: 0, blurb: "" }} className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#071a12]/95 via-[#071a12]/75 to-transparent" />
            <div className="relative flex h-full max-w-[78%] flex-col justify-center gap-2 px-5 text-white sm:max-w-[62%] sm:px-7">
              <span className="w-fit rounded-full bg-brand-yellow px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-brand-ink">{h.eyebrow}</span>
              <h2 className="text-[27px] font-black leading-none tracking-tight sm:text-[34px]">{h.title}</h2>
              <p className="max-w-[420px] text-[12px] font-semibold leading-relaxed text-white/75 sm:text-[13px]">{h.text}</p>
              <button onClick={() => onPlay(h.id)} className="mt-1 w-fit rounded-full bg-brand-yellow px-4 py-2 text-[12px] font-black text-brand-ink shadow-lg transition active:scale-95">Play now →</button>
            </div>
          </article>
        ))}
      </div>
      <div className="absolute bottom-3 left-5 flex gap-1.5 sm:left-7">
        {HERO.map((h, i) => <button key={h.id} aria-label={`Slide ${i + 1}`} onClick={() => { ref.current?.scrollTo({ left: i * (ref.current?.clientWidth ?? 0), behavior: "smooth" }); }} className={cn("h-1.5 rounded-full transition-all", i === active ? "w-5 bg-white" : "w-1.5 bg-white/50")} />)}
      </div>
    </div>
  );
}

function Collection({ title, subtitle, games, onPlay, action }: { title: string; subtitle?: string; games: Game[]; onPlay: (id: string) => void; action?: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-black tracking-tight text-brand-ink">{title}</h3>
          {subtitle ? <p className="text-[11px] font-semibold text-brand-ink/45">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {games.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-[12.5px] font-semibold text-brand-ink/45 shadow-sm ring-1 ring-black/[0.05]">No games match this search. Try another name or category.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 2xl:grid-cols-5">
          {games.map((g) => <GameTile key={g.id} game={g} onOpen={() => onPlay(g.id)} />)}
        </div>
      )}
    </section>
  );
}

export function CasinoLobby() {
  const { open } = useStore();
  const [category, setCategory] = useState<CategoryId>("all");
  const [query, setQuery] = useState("");
  const play = (id: string) => open({ type: "game", gameId: id });
  const search = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!search) return [];
    return GAMES.filter((g) => `${g.name} ${g.tileTitle} ${g.category} ${g.blurb}`.toLowerCase().includes(search));
  }, [search]);
  const totalPlayers = GAMES.reduce((a, g) => a + g.players, 0);
  const categoryCount = (id: CategoryId) => id === "all" ? GAMES.length : id === "popular" ? FEATURED_IDS.length : GAMES.filter((g) => g.category === id).length;

  const sideNav = (
    <nav className="space-y-1" aria-label="Casino categories">
      {CATEGORIES.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => setCategory(id)} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold transition", category === id ? "bg-brand-green-soft text-brand-green-deep ring-1 ring-brand-green/25" : "text-brand-ink/60 hover:bg-black/[0.04]")}>
          <Icon className="h-4 w-4 shrink-0" strokeWidth={2.1} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-black", category === id ? "bg-brand-green text-white" : "bg-black/[0.06] text-brand-ink/45")}>{categoryCount(id)}</span>
        </button>
      ))}
      <div className="mt-4 rounded-2xl bg-brand-ink p-3 text-white">
        <p className="text-[11px] font-black">Instant play</p>
        <p className="mt-1 text-[10px] font-semibold leading-relaxed text-white/55">Every game opens in your browser. Try demo mode before you stake.</p>
      </div>
    </nav>
  );

  const content = search ? (
    <Collection title={`Results for “${query.trim()}”`} subtitle={`${filtered.length} game${filtered.length === 1 ? "" : "s"} found`} games={filtered} onPlay={play} />
  ) : category === "popular" ? (
    <Collection title="Popular now" subtitle="The games players are opening most" games={gamesByIds(FEATURED_IDS)} onPlay={play} />
  ) : category === "all" ? (
    <div className="space-y-7">
      <Collection title="Popular now" subtitle="Crowd favourites across every category" games={gamesByIds(FEATURED_IDS)} onPlay={play} />
      <Collection title="Chicken Road Festival" subtitle="Classic, Ice, Gold and Vegas – four different risk profiles" games={gamesByIds(FESTIVAL_IDS)} onPlay={play} action={<button onClick={() => setCategory("Crash")} className="flex items-center text-[11px] font-black text-brand-green-deep">All crash <ChevronRight className="h-3.5 w-3.5" /></button>} />
      <Collection title="Crash legends" subtitle="Rockets, balloons, jets and the original plane" games={gamesByIds(CRASH_IDS)} onPlay={play} />
      <Collection title="Slots & jackpots" subtitle="Classic paylines and new cascading reels" games={gamesByIds(SLOT_IDS)} onPlay={play} action={<button onClick={() => setCategory("Slots")} className="flex items-center text-[11px] font-black text-brand-green-deep">All slots <ChevronRight className="h-3.5 w-3.5" /></button>} />
      <Collection title="Instant & arcade" subtitle="Mines, towers, Plinko, scratch, Limbo and more" games={gamesByIds(INSTANT_IDS)} onPlay={play} action={<button onClick={() => setCategory("Instant")} className="flex items-center text-[11px] font-black text-brand-green-deep">All instant <ChevronRight className="h-3.5 w-3.5" /></button>} />
      <Collection title="Numbers & cards" subtitle="Keno, Hi-Lo, Coin Flip, Blackjack and Mini Roulette" games={gamesByIds(NUMBER_CARD_IDS)} onPlay={play} action={<button onClick={() => setCategory("Cards")} className="flex items-center text-[11px] font-black text-brand-green-deep">All cards <ChevronRight className="h-3.5 w-3.5" /></button>} />
    </div>
  ) : (
    <Collection title={CATEGORIES.find((c) => c.id === category)?.label ?? "Games"} subtitle={`${categoryCount(category)} games`} games={GAMES.filter((g) => g.category === category)} onPlay={play} />
  );

  return (
    <div className="space-y-5 pb-28 lg:pb-8">
      <HeroCarousel onPlay={play} />

      <div className="grid grid-cols-3 gap-2.5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.05]">
        <div className="text-center"><p className="text-[20px] font-black text-brand-ink">{GAMES.length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/45">Playable games</p></div>
        <div className="border-x border-black/[0.06] text-center"><p className="text-[20px] font-black text-brand-ink">{totalPlayers.toLocaleString()}</p><p className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/45">Players in lobby (demo)</p></div>
        <div className="text-center"><p className="text-[20px] font-black text-brand-green-deep">Demo</p><p className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/45">Try before staking</p></div>
      </div>

      <BigWinsTicker />

      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.06]">
        <SearchIcon className="h-4 w-4 shrink-0 text-brand-ink/40" strokeWidth={2.2} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games, categories…" className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-brand-ink outline-none placeholder:text-brand-ink/35" />
        {query ? <button onClick={() => setQuery("")} className="text-[11px] font-black text-brand-green-deep">Clear</button> : <span className="rounded-lg bg-brand-ink px-3 py-1.5 text-[11px] font-black text-white">Search</span>}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto lg:hidden">
        {CATEGORIES.map(({ id, label }) => <button key={id} onClick={() => setCategory(id)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black", category === id ? "bg-brand-ink text-white" : "bg-white text-brand-ink/55 ring-1 ring-black/10")}>{label}</button>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-[176px_minmax(0,1fr)] xl:grid-cols-[176px_minmax(0,1fr)_176px]">
        <aside className="hidden lg:block">{sideNav}</aside>
        <main className="min-w-0">{content}</main>
        <aside className="hidden xl:block">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.05]">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[12px] font-black text-brand-ink">Crowd favourites</h3>
              <FlameIcon className="h-4 w-4 text-[#ff6a00]" strokeWidth={2.2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {gamesByIds(FEATURED_IDS.slice(0, 6)).map((g) => <GameTile key={g.id} game={g} onOpen={() => play(g.id)} size="sm" showProvider={false} />)}
            </div>
          </div>
        </aside>
      </div>

      <p className="flex items-center justify-center gap-1.5 px-6 text-center text-[10px] font-bold text-brand-ink/40">
        <LockIcon className="h-3 w-3" strokeWidth={2.2} /> {STUDIO} · Demo mode available · Play responsibly · 18+
      </p>
    </div>
  );
}
