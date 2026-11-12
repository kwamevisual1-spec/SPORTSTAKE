import { cn } from "../utils/cn";
import type { Game } from "../games/catalog";
import { Poster } from "../games/poster";
import { STUDIO } from "../games/catalog";

export function GameArt({ game, className = "" }: { game: Game; className?: string }) {
  if (game.art) return <img src={game.art} alt={game.name} loading="lazy" className={cn("object-cover", className)} />;
  if (game.poster) return <Poster theme={game.poster} className={className} />;
  return <Poster theme="rocket" className={className} />;
}

const TAG_STYLE: Record<NonNullable<Game["tag"]>, string> = {
  HOT: "bg-gradient-to-r from-[#ff3d3d] to-[#ff8a00]",
  NEW: "bg-gradient-to-r from-[#2563eb] to-[#06b6d4]",
  JACKPOT: "bg-gradient-to-r from-[#d97706] to-[#facc15] text-[#3b1d00]",
  TOP: "bg-gradient-to-r from-[#e50539] to-[#ff4d79]",
};

export function GameTile({ game, onOpen, size = "md", showProvider = true }: { game: Game; onOpen: () => void; size?: "sm" | "md" | "lg"; showProvider?: boolean }) {
  return (
    <button onClick={onOpen} aria-label={`Play ${game.name}`} className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-[#111] text-left shadow-[0_10px_20px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.97]">
      <GameArt game={game} className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      {game.tag ? <span className={cn("absolute left-1.5 top-1.5 rounded-md px-1.5 py-[2px] text-[8.5px] font-black text-white shadow", TAG_STYLE[game.tag])}>{game.tag}</span> : null}
      <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-[2px] text-[8.5px] font-bold text-white backdrop-blur-sm">
        <span className="h-1.5 w-1.5 animate-live rounded-full bg-emerald-400" />
        {game.players.toLocaleString()}
      </span>
      <span className="absolute inset-x-2 bottom-2 block text-center">
        <span className={cn("block font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]", size === "lg" ? "text-[19px]" : game.tileTitle.length > 11 ? "text-[11px]" : "text-[14px]")}>
          {game.tileTitle}
        </span>
        {showProvider ? <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.18em] text-white/55">{STUDIO}</span> : null}
      </span>
    </button>
  );
}
