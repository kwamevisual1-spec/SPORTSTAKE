import { useEffect, useRef, useState } from "react";
import { money, round2 } from "../lib/format";
import { cur, sc } from "../lib/currency";
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
  [80, 320, 1200],
  [48, 160, 640],
  [32, 96, 320],
  [16, 48, 160],
  [12, 32, 96],
  [8, 24, 64],
];
const TOTAL_W = WEIGHTS.reduce((a, b) => a + b, 0);

function randSymbol() {
  let r = Math.random() * TOTAL_W;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r < 0) return i;
  }
  return WEIGHTS.length - 1;
}

const randGrid = () => Array.from({ length: 5 }, () => Array.from({ length: 3 }, randSymbol));

export function Slots({ game, wallet }: EngineProps) {
  const royals = game.royals ?? ["#facc15", "#60a5fa", "#f87171", "#4ade80", "#e5e7eb"];
  const symbol = (idx: number, size: "cell" | "pay" = "cell") =>
    idx === 0 ? (
      <img src={game.art} alt="Wild" className={cn("rounded-lg object-cover ring-2 ring-amber-300/80", size === "cell" ? "h-[86%] w-[86%]" : "h-8 w-8")} />
    ) : (
      <span
        className={cn("font-black italic leading-none", size === "cell" ? "text-[26px]" : "text-[20px]")}
        style={{
          backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${royals[idx - 1]} 55%, ${royals[idx - 1]}88 100%)`,
          WebkitBackgroundClip: "text",
          color: "transparent",
          WebkitTextStroke: "1px rgba(0,0,0,0.35)",
          filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.45))",
        }}
      >
        {["A", "K", "Q", "J", "10"][idx - 1]}
      </span>
    );
  const [stake, setStake] = useState(String(sc(2)));
  const [grid, setGrid] = useState<number[][]>(randGrid);
  const [spinning, setSpinning] = useState(false);
  const [stopped, setStopped] = useState(5);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [showPay, setShowPay] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const spin = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    const final = randGrid();
    setSpinning(true);
    setStopped(0);
    setLastWin(null);
    setWinCells(new Set());

    const stoppedRef = { current: 0 };
    const anim = window.setInterval(() => {
      setGrid((g) => g.map((col, i) => (i < stoppedRef.current ? col : Array.from({ length: 3 }, randSymbol))));
    }, 70);
    // clearTimeout also clears intervals (shared timer list) – cleaned up on unmount
    timers.current.push(anim);

    [500, 680, 860, 1040, 1220].forEach((ms, reel) => {
      timers.current.push(
        window.setTimeout(() => {
          stoppedRef.current = reel + 1;
          setStopped(reel + 1);
          setGrid((g) => g.map((col, i) => (i === reel ? final[i] : col)));
          if (reel === 4) {
            window.clearInterval(anim);
            const lineBet = amount / LINES.length;
            let win = 0;
            const cells = new Set<string>();
            LINES.forEach((line) => {
              const first = final[0][line[0]];
              let count = 1;
              while (count < 5 && final[count][line[count]] === first) count++;
              if (count >= 3) {
                win += lineBet * PAY[first][count - 3];
                for (let c = 0; c < count; c++) cells.add(`${c}-${line[c]}`);
              }
            });
            win = round2(win);
            if (win > 0) wallet.credit(win);
            setWinCells(cells);
            setLastWin(win);
            setGrid(final);
            setSpinning(false);
          }
        }, ms),
      );
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl p-2.5 shadow-inner ring-2 ring-amber-400/50">
        <img src={game.art} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-md" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative">
        <div className="grid grid-cols-5 gap-1.5">
          {grid.map((col, c) => (
            <div key={c} className="space-y-1.5">
              {col.map((s, r) => (
                <div
                  key={r}
                  className={cn(
                    "grid aspect-square place-items-center rounded-xl text-[30px] transition",
                    winCells.has(`${c}-${r}`) ? "bg-gradient-to-b from-amber-200/40 to-amber-500/30 shadow-[0_0_18px_rgba(252,211,77,0.8)] ring-2 ring-amber-300" : "bg-gradient-to-b from-[#2a1f45] to-[#151026] ring-1 ring-white/10",
                    spinning && c >= stopped && "blur-[1.5px]",
                  )}
                >
                  {symbol(s)}
                </div>
              ))}
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="flex h-10 items-center justify-center rounded-2xl bg-black/30 text-[14px] font-black">
        {spinning ? (
          <span className="text-white/60">Spinning…</span>
        ) : lastWin === null ? (
          <span className="text-white/60">5 paylines · 3+ matching symbols from the left</span>
        ) : lastWin > 0 ? (
          <span className="text-amber-300">WIN {cur()} {money(lastWin)}</span>
        ) : (
          <span className="text-white/50">No win – try again</span>
        )}
      </div>

      <StakeInput value={stake} onChange={setStake} disabled={spinning} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <ActionButton onClick={spin} disabled={spinning}>
          {spinning ? "Spinning…" : `Spin ${cur()} ${money(parseFloat(stake) || 0)}`}
        </ActionButton>
        <button onClick={() => setShowPay((v) => !v)} className="rounded-2xl bg-white/10 px-4 text-[12px] font-black text-white">
          Paytable
        </button>
      </div>

      {showPay ? (
        <div className="rounded-2xl bg-white/[0.07] p-3">
          <p className="mb-2 text-[11px] font-bold text-white/60">Pays × line bet (stake ÷ 5) for 3 / 4 / 5 in a row</p>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between border-t border-white/10 py-1.5 text-[12px] font-bold text-white">
              <span className="grid h-9 w-12 place-items-center">{symbol(i, "pay")}</span>
              <span className="tabular-nums text-white/80">
                ×{PAY[i][0]} · ×{PAY[i][1]} · ×{PAY[i][2]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
