import { useEffect, useRef, useState } from "react";
import { money, parseAmount, round2 } from "../lib/format";
import { cn } from "../utils/cn";
import { ActionButton, StakeInput, placeStake, type EngineProps } from "./common";
import { Poster } from "./poster";

function ChickenToken({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <ellipse cx="22" cy="30" rx="13" ry="12" fill="#fff" />
      <circle cx="26" cy="18" r="10" fill="#fff" />
      <path d="M34 17l8 3-8 4z" fill="#f59e0b" />
      <path d="M22 9c1-4 5-4 6 0 3-3 6-1 4 3" fill="#ef4444" />
      <circle cx="28" cy="16" r="1.8" fill="#111827" />
      <path d="M11 28c-5 0-7 5-4 7 3 3 8 1 9-2" fill="#e5e7eb" />
      <path d="M18 40v5M27 40v5" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CarToken({ className = "", color = "#ef4444" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 60 32" className={className}>
      <rect x="4" y="10" width="52" height="14" rx="5" fill={color} />
      <path d="M14 10l7-8h18l7 8z" fill={color} opacity=".8" />
      <rect x="22" y="4" width="13" height="7" rx="2" fill="#bfdbfe" opacity=".85" />
      <circle cx="16" cy="25" r="5" fill="#111827" /><circle cx="44" cy="25" r="5" fill="#111827" />
      <path d="M4 16H0" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const CHICKEN_CONFIG: Record<string, { lanes: number; risk: number; step: number }> = {
  classic: { lanes: 8, risk: 0.12, step: 1.22 },
  ice: { lanes: 9, risk: 0.16, step: 1.26 },
  gold: { lanes: 10, risk: 0.18, step: 1.32 },
  vegas: { lanes: 7, risk: 0.22, step: 1.4 },
};

export function ChickenRoad({ game, wallet }: EngineProps) {
  const cfg = CHICKEN_CONFIG[game.variant ?? "classic"] ?? CHICKEN_CONFIG.classic;
  const [stake, setStake] = useState("2");
  const [phase, setPhase] = useState<"idle" | "playing" | "busted" | "cashed">("idle");
  const [row, setRow] = useState(0);
  const [carLane, setCarLane] = useState(1);
  const [bet, setBet] = useState(0);
  const [message, setMessage] = useState("Choose a lane to move the chicken forward");
  const mult = Math.round(Math.pow(cfg.step, row) * 100) / 100;

  const start = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setBet(amount);
    setRow(0);
    setCarLane(Math.floor(Math.random() * 3));
    setPhase("playing");
    setMessage("Pick a safe lane for the next crossing");
  };

  const move = (lane: number) => {
    if (phase !== "playing") return;
    if (lane === carLane) {
      setPhase("busted");
      setMessage("A car hit the chicken. You lost this round.");
      return;
    }
    const next = row + 1;
    setRow(next);
    if (next >= cfg.lanes) {
      const win = round2(bet * Math.pow(cfg.step, next));
      wallet.credit(win, `${game.name} full crossing`);
      setPhase("cashed");
      setMessage(`Full crossing! You won ${money(win)}`);
      return;
    }
    setCarLane(Math.floor(Math.random() * 3));
    setMessage(`Safe! ×${Math.pow(cfg.step, next).toFixed(2)} – cross again or cash out`);
  };

  const cash = () => {
    if (row === 0) return wallet.fail("Cross at least one lane before cashing out");
    const win = round2(bet * mult);
    wallet.credit(win, `${game.name} cash out`);
    setPhase("cashed");
    setMessage(`Cashed out at ×${mult.toFixed(2)} · ${money(win)}`);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
        <Poster theme={(game.poster ?? "chicken") as never} className="h-[250px] w-full" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-xl bg-black/45 px-3 py-2 text-[12px] font-bold text-white">
          <span>Lane {row}/{cfg.lanes}</span>
          <span className="text-amber-300">×{mult.toFixed(2)}</span>
          <span>Win {money(bet * mult)}</span>
        </div>
        <div className="absolute inset-x-0 bottom-4 flex items-end justify-around px-4">
          {[0, 1, 2].map((lane) => (
            <div key={lane} className="flex w-1/3 flex-col items-center">
              <CarToken className={cn("h-8 w-14 transition", phase === "playing" && lane === carLane ? "opacity-100" : "opacity-0")} color={lane === 1 ? "#ef4444" : "#3b82f6"} />
              <div className={cn("mt-1 h-12 w-1 rounded-full", phase === "playing" && row > 0 ? "bg-white/40" : "bg-transparent")} />
              {row === 0 || phase !== "playing" ? <ChickenToken className="h-12 w-12" /> : null}
            </div>
          ))}
        </div>
        {phase === "playing" && row > 0 ? <ChickenToken className="absolute bottom-20 left-1/2 h-12 w-12 -translate-x-1/2" /> : null}
      </div>
      <p className="text-center text-[12.5px] font-bold text-white/65">{message}</p>
      {phase === "playing" ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((lane) => <button key={lane} onClick={() => move(lane)} className="rounded-xl bg-white/10 py-3 text-[13px] font-black text-white hover:bg-white/20">{["Left", "Middle", "Right"][lane]}</button>)}
          </div>
          <ActionButton tone="orange" onClick={cash} disabled={row === 0}>{row === 0 ? "Cross one lane first" : `Cash out ${money(bet * mult)}`}</ActionButton>
        </>
      ) : (
        <>
          <StakeInput value={stake} onChange={setStake} />
          <ActionButton onClick={start}>{phase === "busted" ? "Try again" : "Start crossing"} · {money(parseAmount(stake))}</ActionButton>
        </>
      )}
    </div>
  );
}

export function TowerRush({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [phase, setPhase] = useState<"idle" | "playing" | "busted" | "cashed">("idle");
  const [level, setLevel] = useState(0);
  const [bombs, setBombs] = useState<number[]>([]);
  const [bet, setBet] = useState(0);
  const mult = Math.round(Math.pow(1.45, level) * 100) / 100;

  const start = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setBet(amount);
    setBombs(Array.from({ length: 6 }, () => Math.floor(Math.random() * 3)));
    setLevel(0);
    setPhase("playing");
  };

  const choose = (door: number) => {
    if (phase !== "playing") return;
    if (bombs[level] === door) return setPhase("busted");
    const next = level + 1;
    setLevel(next);
    if (next >= 6) {
      wallet.credit(round2(bet * Math.pow(1.45, next)), "Tower Rush top floor");
      setPhase("cashed");
    }
  };

  const cash = () => {
    if (level === 0) return;
    wallet.credit(round2(bet * mult), "Tower Rush cash out");
    setPhase("cashed");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-b from-[#1e1b4b] to-[#0b1020] p-3 ring-1 ring-white/10">
        <div className="mb-2 flex justify-between text-[12px] font-bold text-white/65"><span>Floor {level}/6</span><span className="text-amber-300">×{mult.toFixed(2)}</span><span>{money(bet * mult)}</span></div>
        <div className="space-y-1.5">
          {Array.from({ length: 6 }, (_, i) => 5 - i).map((floor) => (
            <div key={floor} className={cn("grid grid-cols-3 gap-1.5 rounded-lg p-1", floor === level && phase === "playing" ? "bg-white/10 ring-1 ring-amber-300/50" : "opacity-60")}>
              {[0, 1, 2].map((door) => {
                const revealed = floor < level || phase === "busted" || phase === "cashed";
                const isBomb = bombs[floor] === door;
                return (
                  <button key={door} disabled={phase !== "playing" || floor !== level} onClick={() => choose(door)} className={cn("grid h-10 place-items-center rounded-lg text-[13px] font-black transition", revealed ? (isBomb ? "bg-red-500/70 text-white" : "bg-emerald-500/25 text-emerald-200") : floor === level && phase === "playing" ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/[0.06] text-white/30")}>
                    {revealed ? (isBomb ? "✕" : "✓") : floor + 1}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {phase === "busted" ? <p className="mt-2 text-center text-[14px] font-black text-red-300">A bomb ended the climb.</p> : null}
        {phase === "cashed" ? <p className="mt-2 text-center text-[14px] font-black text-emerald-300">Cashed out {money(bet * mult)}</p> : null}
      </div>
      {phase === "playing" ? <ActionButton tone="orange" onClick={cash} disabled={level === 0}>{level === 0 ? "Pick a door on floor 1" : `Cash out ${money(bet * mult)}`}</ActionButton> : null}
      {phase !== "playing" ? <><StakeInput value={stake} onChange={setStake} /><ActionButton onClick={start}>Climb the tower · {money(parseAmount(stake))}</ActionButton></> : null}
    </div>
  );
}

const PLINKO_TABLES: Record<string, number[]> = {
  low: [0.5, 1.1, 1.5, 2.2, 4, 2.2, 1.5, 1.1, 0.5],
  medium: [0.3, 0.8, 1.5, 3, 7, 3, 1.5, 0.8, 0.3],
  high: [0.1, 0.5, 1.5, 5, 12, 5, 1.5, 0.5, 0.1],
};

export function PlinkoStorm({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [dropping, setDropping] = useState(false);
  const [pos, setPos] = useState({ row: -1, x: 4 });
  const [result, setResult] = useState<{ bucket: number; win: number } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const table = PLINKO_TABLES[risk];

  const drop = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setDropping(true);
    setResult(null);
    let x = 4;
    const path: number[] = [];
    for (let r = 0; r < 8; r++) {
      x = Math.max(0, Math.min(8, x + (Math.random() < 0.5 ? -1 : 1)));
      path.push(x);
    }
    const bucket = path[path.length - 1];
    path.forEach((px, i) => {
      const id = window.setTimeout(() => setPos({ row: i, x: px }), 180 * (i + 1));
      timers.current.push(id);
    });
    timers.current.push(window.setTimeout(() => {
      const win = round2(amount * table[bucket]);
      if (win > 0) wallet.credit(win, "Plinko bucket win");
      setResult({ bucket, win });
      setHistory((h) => [table[bucket], ...h].slice(0, 8));
      setDropping(false);
    }, 180 * 9));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["low", "medium", "high"] as const).map((r) => <button key={r} onClick={() => setRisk(r)} disabled={dropping} className={cn("flex-1 rounded-xl py-2 text-[12px] font-black capitalize", risk === r ? "bg-cyan-400 text-[#082f49]" : "bg-white/10 text-white")}>{r} risk</button>)}
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#082f49] to-[#020617] p-3 ring-1 ring-white/10">
        <div className="relative mx-auto h-[250px] max-w-[320px]">
          <svg viewBox="0 0 320 250" className="absolute inset-0 h-full w-full">
            {Array.from({ length: 8 }, (_, r) => Array.from({ length: r + 3 }, (_, c) => <circle key={`${r}-${c}`} cx={160 + (c - (r + 2) / 2) * 32} cy={30 + r * 24} r="4" fill="#cbd5e1" opacity=".85" />))}
            {pos.row >= 0 ? <circle cx={160 + (pos.x - 4) * 32} cy={30 + pos.row * 24} r="8" fill="#fbbf24" /> : null}
            {table.map((m, i) => <g key={i}><rect x={16 + i * 32} y="222" width="28" height="22" rx="4" fill={i === result?.bucket ? "#fbbf24" : "#1e293b"} /><text x={30 + i * 32} y="237" textAnchor="middle" fontSize="10" fontWeight="900" fill={i === result?.bucket ? "#082f49" : "#fff"}>×{m}</text></g>)}
          </svg>
        </div>
      </div>
      {result ? <p className={cn("text-center text-[16px] font-black", result.win > 0 ? "text-emerald-300" : "text-red-300")}>Bucket ×{table[result.bucket]} · {result.win > 0 ? `You won ${money(result.win)}` : "No win"}</p> : null}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{history.map((m, i) => <span key={i} className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-black text-cyan-300">×{m}</span>)}</div>
      <StakeInput value={stake} onChange={setStake} disabled={dropping} />
      <ActionButton onClick={drop} disabled={dropping}>{dropping ? "Dropping…" : `Drop ball · ${money(parseAmount(stake))}`}</ActionButton>
    </div>
  );
}

type ScratchSymbol = { key: string; label: string; mult: number; color: string };
const SCRATCH_SYMBOLS: ScratchSymbol[] = [
  { key: "◆", label: "Diamond", mult: 50, color: "#22d3ee" },
  { key: "♛", label: "Crown", mult: 20, color: "#fbbf24" },
  { key: "★", label: "Star", mult: 10, color: "#a855f7" },
  { key: "♦", label: "Ruby", mult: 5, color: "#f43f5e" },
  { key: "●", label: "Coin", mult: 3, color: "#f59e0b" },
  { key: "7", label: "Seven", mult: 2, color: "#34d399" },
];

function scratchGrid(): number[] {
  const grid = Array.from({ length: 9 }, () => Math.floor(Math.random() * SCRATCH_SYMBOLS.length));
  if (Math.random() < 0.45) {
    const symbol = Math.floor(Math.random() * SCRATCH_SYMBOLS.length);
    const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 3);
    positions.forEach((p) => (grid[p] = symbol));
  }
  return grid;
}

export function ScratchGold({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [grid, setGrid] = useState<number[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ symbol: ScratchSymbol; win: number } | null>(null);
  const [bet, setBet] = useState(0);

  const start = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setBet(amount);
    setGrid(scratchGrid());
    setOpen(new Set());
    setResult(null);
  };

  const reveal = (i: number) => {
    if (!grid.length || result) return;
    const next = new Set(open).add(i);
    setOpen(next);
    if (next.size === 9) finish(next);
  };

  const finish = (opened: Set<number>) => {
    void opened;
    const counts = new Map<number, number>();
    grid.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
    const winner = [...counts.entries()].find(([, count]) => count >= 3)?.[0];
    if (winner !== undefined) {
      const symbol = SCRATCH_SYMBOLS[winner];
      const win = round2(bet * symbol.mult);
      wallet.credit(win, `Scratch ${symbol.label} ×${symbol.mult}`);
      setResult({ symbol, win });
    } else setResult({ symbol: SCRATCH_SYMBOLS[0], win: 0 });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-b from-[#064e3b] to-[#022c22] p-3 ring-1 ring-amber-400/25">
        <div className="grid grid-cols-3 gap-2">
          {(grid.length ? grid : Array.from({ length: 9 }, () => -1)).map((s, i) => {
            const shown = open.has(i);
            const sym = s >= 0 ? SCRATCH_SYMBOLS[s] : null;
            return (
              <button key={i} onClick={() => reveal(i)} disabled={!grid.length || shown || Boolean(result)} className={cn("grid aspect-square place-items-center rounded-xl text-[34px] font-black transition active:scale-95", shown ? "bg-white" : "bg-[repeating-linear-gradient(45deg,#94a3b8_0_6px,#64748b_6px_12px)] text-white/60")}>
                {shown && sym ? <span style={{ color: sym.color }}>{sym.key}</span> : shown ? "" : "?"}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[12px] font-bold text-white/60">{grid.length ? "Tap tiles to reveal them. Three of a kind wins." : "Buy a card to start scratching."}</p>
      </div>
      {result ? <p className={cn("text-center text-[16px] font-black", result.win > 0 ? "text-amber-300" : "text-red-300")}>{result.win > 0 ? `${result.symbol.label} ×${result.symbol.mult} – you won ${money(result.win)}` : "No three matching symbols – no win"}</p> : null}
      {grid.length && !result ? <ActionButton tone="gray" onClick={() => { setOpen(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8])); finish(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8])); }}>Reveal all</ActionButton> : null}
      {!grid.length || result ? <><StakeInput value={stake} onChange={setStake} /><ActionButton onClick={start}>{result ? "New card" : "Buy scratch card"} · {money(parseAmount(stake))}</ActionButton></> : null}
      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold text-white/50">
        {SCRATCH_SYMBOLS.map((s) => <span key={s.label}><b style={{ color: s.color }}>{s.key}</b> ×{s.mult}</span>)}
      </div>
    </div>
  );
}
