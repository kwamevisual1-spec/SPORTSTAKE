import { useMemo } from "react";
import { FEATURED_IDS, gamesByIds } from "../games/catalog";
import { cur, scale } from "../lib/currency";
import { money } from "../lib/format";
import { useStore } from "../store";
import { GameArt } from "./GameTile";
import { WonLogo } from "./WonLogo";

const NAMES = ["Michael", "Bernard", "Richmond", "Isaac", "Francis", "Fiifi", "Akua", "Chinedu", "Emeka", "Chukwuemeka", "Obinna", "Eric", "Prince", "Bright", "Damilola", "Olamide", "Boluwatife", "Ayodele", "Seyi", "Kelechi", "Uche", "Nnamdi", "Somto", "Tobenna", "Ikenna", "Ogechi", "Nkiru", "Onyekachi", "Tolulope", "Emmanuel", "Patrick", "Ebenezer", "Godfred", "Samuel", "Daniel", "Maxwell", "Stephen", "Nicholas", "Derrick", "Collins", "Desmond", "Gideon", "Evans", "Ernest", "Frederick", "Lawrence", "Benjamin", "Harrison", "George", "Augustine", "Seth", "Abdulai", "Mustapha", "Rashid", "Mohammed", "Nana Yaw", "Kofi", "Kwesi"];
const WHEN = ["just now", "just now", "1m ago", "2m ago", "3m ago", "4m ago", "6m ago", "8m ago", "11m ago", "14m ago", "17m ago", "21m ago"];

/** Auto-scrolling, clickable demo recent-win activity for the casino-first home page. */
export function BigWinsTicker({ className = "" }: { className?: string }) {
  const { open } = useStore();
  const wins = useMemo(() => {
    const games = gamesByIds(FEATURED_IDS);
    // One win per supplied name, then repeat for a seamless loop.
    return NAMES.map((user, i) => ({
      game: games[i % games.length],
      user,
      amount: Math.round((480 + ((i * 1739) % 9200) * 1.35) * scale()),
      multiplier: (2.4 + ((i * 37) % 160) / 10).toFixed(2),
      when: WHEN[i % WHEN.length],
    }));
  }, []);
  const items = [...wins, ...wins];

  return (
    <div className={`rounded-2xl bg-brand-ink ${className}`}>
      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-live rounded-full bg-emerald-400" />
          Recent big wins
        </span>
        <WonLogo />
      </div>
      <div className="ticker-hover relative overflow-hidden pb-2.5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-brand-ink to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-brand-ink to-transparent" />
        <div className="animate-ticker flex w-max gap-2.5 px-3" aria-label="Recent big wins" style={{ animationDuration: `${Math.max(30, items.length * 0.55)}s` }}>
          {items.map((w, i) => (
            <button
              key={`${w.game.id}-${i}`}
              onClick={() => open({ type: "game", gameId: w.game.id })}
              className="group flex w-[232px] shrink-0 items-center gap-2.5 rounded-xl bg-white/[0.07] p-2 text-left ring-1 ring-white/[0.06] transition hover:bg-white/[0.12] active:scale-[0.98]"
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
                <GameArt game={w.game} className="absolute inset-0 h-full w-full object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold text-white/55">{w.user} <span className="text-white/35">· {w.when}</span></span>
                <span className="block truncate text-[12px] font-black text-emerald-300">{cur()} {money(w.amount)}</span>
                <span className="block truncate text-[10px] font-semibold text-white/55">{w.game.name} <span className="text-amber-300">×{w.multiplier}</span></span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
