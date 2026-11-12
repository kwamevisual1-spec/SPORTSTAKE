import { useState } from "react";
import { FEATURED_IDS, gamesByIds } from "../games/catalog";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { GameArt, GameTile } from "./GameTile";
import { BigWinsTicker } from "./BigWinsTicker";
import { ChevronRight, FlameIcon } from "./Icons";

const SPOTLIGHT_IDS = [
  "chicken-road",
  "aviator",
  "plinko-storm",
  "golden-kente",
  "blackjack-classic",
  "rocket-rush",
  "mines",
  "keno-royal",
  "kente-cascades",
  "tower-rush",
  "limbo",
  "mini-roulette",
];

/** Casino-first home section: a large playable showcase, not a promotional strip. */
export function CasinoSpotlight() {
  const { open, go } = useStore();
  const [collection, setCollection] = useState<"featured" | "instant">("featured");
  const games = gamesByIds(SPOTLIGHT_IDS);
  const instant = gamesByIds(FEATURED_IDS.filter((id) => !SPOTLIGHT_IDS.slice(0, 6).includes(id)));
  const shown = collection === "featured" ? games : instant;
  const hero = gamesByIds(["aviator"])[0];

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-3xl bg-white p-3 shadow-[0_10px_30px_-20px_rgba(16,19,26,0.6)] ring-1 ring-black/[0.05] md:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <FlameIcon className="h-4 w-4 text-[#ff6a00]" strokeWidth={2.2} />
            <h2 className="text-[18px] font-black tracking-tight text-brand-ink">Casino spotlight</h2>
            <span className="rounded-full bg-brand-green-soft px-2 py-0.5 text-[9px] font-black uppercase text-brand-green-deep">28 games</span>
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-brand-ink/45">Crash, slots, instant games, numbers and cards – all playable now</p>
        </div>
        <button onClick={() => go({ name: "casino" })} className="flex shrink-0 items-center gap-0.5 rounded-full bg-brand-green-soft px-3 py-1.5 text-[11px] font-black text-brand-green-deep active:scale-95">
          All games <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
      </div>

      {/* Featured game hero */}
      <button onClick={() => open({ type: "game", gameId: hero.id })} className="group relative mb-3 block h-[150px] w-full overflow-hidden rounded-2xl text-left shadow-[0_14px_28px_-16px_rgba(0,0,0,0.65)] md:h-[178px]">
        <GameArt game={hero} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071a12]/95 via-[#071a12]/65 to-transparent" />
        <div className="relative flex h-full max-w-[76%] flex-col justify-center gap-1.5 px-4 text-white md:px-6">
          <span className="w-fit rounded-full bg-brand-yellow px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-brand-ink">Crash legends</span>
          <span className="text-[25px] font-black leading-none tracking-tight md:text-[30px]">Aviator</span>
          <span className="max-w-[420px] text-[11px] font-semibold leading-relaxed text-white/75 md:text-[12.5px]">Watch the multiplier climb and cash out before the plane flies away. Every second counts.</span>
          <span className="mt-1 w-fit rounded-full bg-brand-yellow px-3.5 py-1.5 text-[11px] font-black text-brand-ink shadow-lg">Play now →</span>
        </div>
      </button>

      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-black/[0.05] p-1">
          {(["featured", "instant"] as const).map((key) => (
            <button key={key} onClick={() => setCollection(key)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-black capitalize", collection === key ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink/50")}>
              {key === "featured" ? "Trending now" : "More favourites"}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-bold text-brand-ink/40">{shown.length} games</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
        {shown.map((g) => <GameTile key={g.id} game={g} onOpen={() => open({ type: "game", gameId: g.id })} />)}
      </div>

      <BigWinsTicker className="mt-3" />
    </section>
  );
}
