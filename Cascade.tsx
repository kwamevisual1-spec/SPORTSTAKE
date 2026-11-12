import { useEffect, useRef, useState } from "react";
import { money, parseAmount, round2 } from "../lib/format";
import { cn } from "../utils/cn";
import { ActionButton, StakeInput, placeStake, type EngineProps } from "./common";

const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
];
const WEIGHTS = [2, 3, 4, 5, 6, 7];
const PAY = [
  [40, 140, 500],
  [24, 70, 260],
  [16, 48, 160],
  [10, 30, 100],
  [7, 20, 64],
  [5, 14, 40],
];
const MULTIPLIERS = [1, 2, 3, 5, 8];
const TOTAL_W = WEIGHTS.reduce((a, b) => a + b, 0);
const randomSymbol = () => {
  let r = Math.random() * TOTAL_W;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r < 0) return i;
  }
  return WEIGHTS.length - 1;
};
const randomGrid = () => Array.from({ length: 5 }, () => Array.from({ length: 3 }, randomSymbol));

function wins(grid: number[][]) {
  const cells = new Set<string>();
  let total = 0;
  for (const line of LINES) {
    const first = grid[0][line[0]];
    let count = 1;
    while (count < 5 && grid[count][line[count]] === first) count++;
    if (count >= 3) {
      total += PAY[first][count - 3];
      for (let c = 0; c < count; c++) cells.add(`${c}-${line[c]}`);
    }
  }
  return { cells, total };
}

export function Cascade({ game, wallet }: EngineProps) {
  const royals = game.royals ?? ["#facc15", "#60a5fa", "#f87171", "#4ade80", "#e5e7eb"];
  const [stake, setStake] = useState("2");
  const [grid, setGrid] = useState(randomGrid);
  const [spinning, setSpinning] = useState(false);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [multiplier, setMultiplier] = useState(1);
  const [totalWin, setTotalWin] = useState(0);
  const [roundWin, setRoundWin] = useState(0);
  const [status, setStatus] = useState("5 lines · wins explode and cascade");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const symbol = (idx: number) =>
    idx === 0 ? (
      <img src={game.art} alt="wild" className="h-[86%] w-[86%] rounded-lg object-cover ring-2 ring-amber-300/80" />
    ) : (
      <span className="text-[26px] font-black italic leading-none" style={{ backgroundImage: `linear-gradient(180deg,#fff 0%,${royals[idx - 1]} 55%,${royals[idx - 1]}88 100%)`, WebkitBackgroundClip: "text", color: "transparent", WebkitTextStroke: "1px rgba(0,0,0,0.35)", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.45))" }}>
        {["A", "K", "Q", "J", "10"][idx - 1]}
      </span>
    );

  const spin = () => {
    if (spinning) return;
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setSpinning(true);
    setTotalWin(0);
    setRoundWin(0);
    setWinCells(new Set());
    setMultiplier(1);
    const lineBet = amount / LINES.length;
    let current = randomGrid();
    let cascade = 0;
    let accumulated = 0;
    setGrid(current);
    setStatus("Spinning…");

    const step = () => {
      const result = wins(current);
      if (result.cells.size === 0 || cascade >= 6) {
        wallet.credit(round2(accumulated), `${game.name} win`);
        setRoundWin(round2(accumulated));
        setStatus(accumulated > 0 ? `Paid ${money(accumulated)}` : "No win – try again");
        setSpinning(false);
        return;
      }
      const mult = MULTIPLIERS[Math.min(cascade, MULTIPLIERS.length - 1)];
      const win = result.total * lineBet * mult;
      accumulated += win;
      setTotalWin(round2(accumulated));
      setMultiplier(mult);
      setWinCells(result.cells);
      setStatus(`Cascade ${cascade + 1} · ${money(win)} at ×${mult}`);
      const id = window.setTimeout(() => {
        const next = current.map((col, c) => col.map((s, r) => (result.cells.has(`${c}-${r}`) ? randomSymbol() : s)));
        current = next;
        cascade++;
        setGrid(next);
        setWinCells(new Set());
        step();
      }, 650);
      timers.current.push(id);
    };
    const id = window.setTimeout(step, 500);
    timers.current.push(id);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl p-2.5 shadow-inner ring-2 ring-amber-400/50">
        <img src={game.art} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-md" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative grid grid-cols-5 gap-1.5">
          {grid.map((col, c) => (
            <div key={c} className="space-y-1.5">
              {col.map((s, r) => (
                <div key={r} className={cn("grid aspect-square place-items-center rounded-xl transition", winCells.has(`${c}-${r}`) ? "animate-tile bg-gradient-to-b from-amber-200/40 to-amber-500/30 ring-2 ring-amber-300" : "bg-gradient-to-b from-[#2a1f45] to-[#151026] ring-1 ring-white/10", spinning && "blur-[0.4px]")}>
                  {symbol(s)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-black/30 py-2"><p className="text-[10px] font-bold uppercase text-white/45">Multiplier</p><p className="text-[20px] font-black text-amber-300">×{multiplier}</p></div>
        <div className="rounded-2xl bg-black/30 py-2"><p className="text-[10px] font-bold uppercase text-white/45">Round win</p><p className="text-[20px] font-black text-emerald-300">{money(totalWin)}</p></div>
        <div className="rounded-2xl bg-black/30 py-2"><p className="text-[10px] font-bold uppercase text-white/45">Last payout</p><p className="text-[20px] font-black text-white">{money(roundWin)}</p></div>
      </div>
      <p className="text-center text-[12px] font-bold text-white/60">{status}</p>
      <StakeInput value={stake} onChange={setStake} disabled={spinning} />
      <ActionButton onClick={spin} disabled={spinning}>{spinning ? "Cascading…" : `Spin ${money(parseAmount(stake))}`}</ActionButton>
      <p className="text-center text-[10.5px] font-semibold text-white/40">Cascades pay ×1, ×2, ×3, ×5 and ×8. Every win is added to your balance at the end of the round.</p>
    </div>
  );
}
