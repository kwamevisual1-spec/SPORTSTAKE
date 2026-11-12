import { useEffect, useRef, useState } from "react";
import { money, parseAmount, round2 } from "../lib/format";
import { cn } from "../utils/cn";
import { ActionButton, StakeInput, placeStake, type EngineProps } from "./common";

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const KENO_PAY: number[][] = [
  [0, 3],
  [0, 1, 9],
  [0, 1, 2, 20],
  [0, 0.5, 2, 6, 50],
  [0, 0.5, 1, 4, 15, 150],
  [0, 0.5, 1, 3, 8, 40, 500],
  [0, 0.5, 1, 2, 5, 20, 150, 1000],
  [0, 0.5, 1, 2, 5, 15, 60, 300, 2000],
];

export function KenoRoyal({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [result, setResult] = useState<{ matches: number; win: number } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const drawing = drawn.length > 0 && revealed < 10;

  const toggle = (n: number) => {
    if (drawing) return;
    setResult(null);
    setDrawn([]);
    setRevealed(0);
    setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 8 ? (wallet.fail("You can pick up to 8 numbers"), p) : [...p, n]));
  };

  const quick = () => {
    setResult(null);
    setDrawn([]);
    setRevealed(0);
    setPicks(shuffle(Array.from({ length: 40 }, (_, i) => i + 1)).slice(0, 5));
  };

  const play = () => {
    if (!picks.length) return wallet.fail("Pick at least one number");
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    const draw = shuffle(Array.from({ length: 40 }, (_, i) => i + 1)).slice(0, 10);
    setDrawn(draw);
    setRevealed(0);
    setResult(null);
    draw.forEach((_, i) => {
      const id = window.setTimeout(() => setRevealed(i + 1), 450 * (i + 1));
      timers.current.push(id);
    });
    timers.current.push(window.setTimeout(() => {
      const matches = picks.filter((n) => draw.includes(n)).length;
      const win = round2(amount * (KENO_PAY[picks.length - 1][matches] ?? 0));
      if (win > 0) wallet.credit(win, "Keno Royal win");
      setResult({ matches, win });
    }, 450 * 10 + 350));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-b from-[#2a1554] to-[#150b30] p-3 ring-1 ring-white/10">
        <div className="mb-2 flex items-center justify-between text-[11.5px] font-bold text-white/60">
          <span>Pick 1–8 numbers</span>
          <span className="text-amber-300">{picks.length}/8 selected</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
            const picked = picks.includes(n);
            const hit = drawn.slice(0, revealed).includes(n);
            return (
              <button key={n} onClick={() => toggle(n)} className={cn("grid aspect-square place-items-center rounded-lg text-[12px] font-black transition active:scale-95", picked && hit ? "bg-amber-400 text-[#2a1554] ring-2 ring-white" : picked ? "bg-amber-400/90 text-[#2a1554]" : hit ? "bg-fuchsia-500/30 text-fuchsia-100 ring-1 ring-fuchsia-300/50" : "bg-white/[0.08] text-white/75 hover:bg-white/15")}>
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={quick} className="flex-1 rounded-xl bg-white/10 py-2 text-[12px] font-black text-white">Quick pick 5</button>
          <button onClick={() => { setPicks([]); setDrawn([]); setRevealed(0); setResult(null); }} className="flex-1 rounded-xl bg-white/10 py-2 text-[12px] font-black text-white">Clear</button>
        </div>
      </div>

      <div className="rounded-2xl bg-black/30 p-3">
        <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/45">Drawn balls</p>
        <div className="flex min-h-10 flex-wrap items-center justify-center gap-1.5">
          {drawn.length === 0 ? <span className="text-[12px] font-semibold text-white/40">Ten balls are drawn each round</span> : drawn.map((n, i) => (
            <span key={n} className={cn("grid h-8 w-8 place-items-center rounded-full text-[12px] font-black transition-all", i < revealed ? "animate-pop bg-gradient-to-b from-amber-300 to-amber-600 text-[#2a1554]" : "bg-white/10 text-transparent")}>{n}</span>
          ))}
        </div>
        {result ? <p className={cn("mt-2 text-center text-[15px] font-black", result.win > 0 ? "text-emerald-300" : "text-red-300")}>{result.matches} match{result.matches === 1 ? "" : "es"} · {result.win > 0 ? `You won ${money(result.win)}` : "No win this round"}</p> : null}
      </div>

      <StakeInput value={stake} onChange={setStake} disabled={drawing} />
      <ActionButton onClick={play} disabled={drawing || picks.length === 0}>{drawing ? "Drawing…" : `Play ${money(parseAmount(stake))}`}</ActionButton>
    </div>
  );
}

export function Limbo({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [target, setTarget] = useState("2.00");
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const t = Math.max(1.01, parseAmount(target) || 1.01);
  const chance = 97 / t;

  const play = () => {
    if (t < 1.01 || t > 1000) return wallet.fail("Target must be between 1.01× and 1000×");
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setRolling(true);
    setResult(null);
    timer.current = window.setTimeout(() => {
      const r = Math.random();
      const value = r < 0.03 ? 1 : Math.min(1000, Math.max(1, Math.floor((0.97 / (1 - r)) * 100) / 100));
      if (value >= t) wallet.credit(round2(amount * t), "Limbo win");
      setResult(value);
      setRolling(false);
    }, 800);
  };

  const won = result !== null && result >= t;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[radial-gradient(circle_at_top,#064e3b,#022c22)] p-5 text-center ring-1 ring-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Target multiplier</p>
        <div className="mx-auto mt-1 flex w-40 items-center justify-center rounded-xl bg-black/30 px-3 py-2">
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full bg-transparent text-center text-[30px] font-black text-amber-300 outline-none" />
          <span className="text-[20px] font-black text-amber-300">×</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] font-bold text-white/65">
          <span>Win chance <b className="block text-[18px] text-white">{chance.toFixed(2)}%</b></span>
          <span>Payout <b className="block text-[18px] text-white">{money(parseAmount(stake) * t)}</b></span>
        </div>
        <div className="mt-5 rounded-2xl bg-black/35 py-4">
          <p className={cn("text-[52px] font-black leading-none tabular-nums", rolling ? "animate-pulse text-white/40" : result === null ? "text-white/60" : won ? "text-emerald-300" : "text-red-400")}>
            {rolling ? "…" : result === null ? "—" : `${result.toFixed(2)}×`}
          </p>
          <p className="mt-1 text-[12px] font-bold text-white/60">{result === null ? "Set your target and play" : won ? "Target beaten – you win" : "Below target – you lose"}</p>
        </div>
      </div>
      <div className="flex gap-1.5">{[1.5, 2, 3, 5, 10].map((v) => <button key={v} onClick={() => setTarget(v.toFixed(2))} className="flex-1 rounded-xl bg-white/10 py-2 text-[12px] font-black text-white">×{v}</button>)}</div>
      <StakeInput value={stake} onChange={setStake} disabled={rolling} />
      <ActionButton onClick={play} disabled={rolling}>{rolling ? "Rolling…" : `Play ${money(parseAmount(stake))}`}</ActionButton>
    </div>
  );
}

const cardName = (n: number) => (n === 14 ? "A" : n === 13 ? "K" : n === 12 ? "Q" : n === 11 ? "J" : String(n));

export function HiLoRoyale({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "lost" | "cashed">("idle");
  const [bet, setBet] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const mult = Math.round(Math.pow(1.25, streak) * 100) / 100;

  const start = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setBet(amount);
    setCurrent(2 + Math.floor(Math.random() * 13));
    setNext(null);
    setStreak(0);
    setPhase("playing");
  };

  const guess = (higher: boolean) => {
    if (phase !== "playing" || busy) return;
    setBusy(true);
    const n = 2 + Math.floor(Math.random() * 13);
    setNext(n);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      const correct = higher ? n > current : n < current;
      if (!correct) {
        setPhase("lost");
        return;
      }
      setCurrent(n);
      setNext(null);
      setStreak((s) => s + 1);
    }, 450);
  };

  const cash = () => {
    if (streak === 0) return;
    wallet.credit(round2(bet * mult), "Hi-Lo cash out");
    setPhase("cashed");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gradient-to-b from-[#3f1010] to-[#1a0707] p-4 text-center ring-1 ring-white/10">
        <div>
          <p className="text-[10px] font-bold uppercase text-white/45">Current card</p>
          <div className="mx-auto mt-2 grid h-28 w-20 place-items-center rounded-xl bg-white text-[42px] font-black text-[#7f1d1d] shadow-xl">{current ? cardName(current) : "?"}</div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-white/45">Next card</p>
          <div className={cn("mx-auto mt-2 grid h-28 w-20 place-items-center rounded-xl text-[42px] font-black shadow-xl", next ? "animate-pop bg-white text-[#7f1d1d]" : "bg-[#7f1d1d] text-white/40 ring-2 ring-white/20")}>{next ? cardName(next) : "?"}</div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase text-white/45">Streak</p>
          <p className="text-[28px] font-black text-amber-300">{streak}</p>
          <p className="text-[11px] font-bold text-white/60">×{mult.toFixed(2)}</p>
        </div>
      </div>
      {phase === "lost" ? <p className="text-center text-[15px] font-black text-red-300">Wrong call – streak lost</p> : phase === "cashed" ? <p className="text-center text-[15px] font-black text-emerald-300">Cashed out {money(bet * mult)}</p> : null}
      {phase === "playing" ? (
        <div className="grid grid-cols-2 gap-2">
          <ActionButton tone="gray" onClick={() => guess(false)} disabled={busy}>Lower</ActionButton>
          <ActionButton onClick={() => guess(true)} disabled={busy}>Higher</ActionButton>
        </div>
      ) : null}
      {phase === "playing" ? <ActionButton tone="orange" onClick={cash} disabled={streak === 0 || busy}>{streak === 0 ? "Make your first call" : `Cash out ${money(bet * mult)}`}</ActionButton> : null}
      {phase !== "playing" ? (
        <>
          <StakeInput value={stake} onChange={setStake} />
          <ActionButton onClick={start}>Start · {money(parseAmount(stake))}</ActionButton>
        </>
      ) : null}
      <p className="text-center text-[10.5px] font-semibold text-white/40">Ace is high. Equal cards lose. Each correct call adds ×1.25 to your streak.</p>
    </div>
  );
}

export function CoinFlip({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [phase, setPhase] = useState<"idle" | "flipping" | "done">("idle");
  const [result, setResult] = useState<"heads" | "tails" | null>(null);
  const [win, setWin] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setPhase("flipping");
    setResult(null);
    setWin(0);
    timer.current = window.setTimeout(() => {
      const r: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
      const won = r === side;
      const payout = won ? round2(amount * 1.96) : 0;
      if (won) wallet.credit(payout, "Coin flip win");
      setResult(r);
      setWin(payout);
      setPhase("done");
    }, 1000);
  };

  return (
    <div className="space-y-3">
      <div className="grid place-items-center rounded-2xl bg-[radial-gradient(circle_at_center,#3b2a06,#151004)] p-6 ring-1 ring-amber-400/25">
        <div className={cn("relative h-36 w-36 rounded-full bg-gradient-to-br from-amber-200 to-amber-600 shadow-[0_10px_40px_rgba(251,191,36,0.35)] ring-4 ring-amber-300/60", phase === "flipping" && "animate-spin-fast")} style={{ transformStyle: "preserve-3d" }}>
          <div className="absolute inset-0 grid place-items-center rounded-full border-[6px border-dashed border-amber-800/40">
            <span className="text-[42px] font-black text-amber-900">{result ? (result === "heads" ? "H" : "T") : side === "heads" ? "H" : "T"}</span>
          </div>
        </div>
        <p className={cn("mt-4 text-[16px] font-black", phase === "done" ? (win > 0 ? "text-emerald-300" : "text-red-300") : "text-white/60")}>
          {phase === "flipping" ? "Flipping…" : phase === "done" ? (win > 0 ? `${result === "heads" ? "Heads" : "Tails"} – you won ${money(win)}` : `${result === "heads" ? "Heads" : "Tails"} – you lose`) : "Choose your side"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["heads", "tails"] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)} disabled={phase === "flipping"} className={cn("rounded-2xl py-3 text-[15px] font-black capitalize transition", side === s ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white")}>{s}</button>
        ))}
      </div>
      <StakeInput value={stake} onChange={setStake} disabled={phase === "flipping"} />
      <ActionButton onClick={play} disabled={phase === "flipping"}>{phase === "flipping" ? "Flipping…" : `Flip for ${money(parseAmount(stake) * 1.96)}`}</ActionButton>
    </div>
  );
}
