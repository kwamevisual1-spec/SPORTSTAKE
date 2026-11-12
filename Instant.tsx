import { useEffect, useRef, useState } from "react";
import { money, round2 } from "../lib/format";
import { cur, sc } from "../lib/currency";
import { cn } from "../utils/cn";
import { ActionButton, StakeInput, placeStake, type EngineProps } from "./common";

/* ================================================================== */
/* DICE                                                                */
/* ================================================================== */

export function Dice({ wallet }: EngineProps) {
  const [stake, setStake] = useState(String(sc(5)));
  const [target, setTarget] = useState(50);
  const [roll, setRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ v: number; win: boolean }[]>([]);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const multiplier = Math.floor((97 / target) * 100) / 100;

  const go = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setRolling(true);
    timer.current = window.setTimeout(() => {
      const v = Math.floor(Math.random() * 10000) / 100;
      const win = v < target;
      if (win) wallet.credit(round2(amount * multiplier));
      setRoll(v);
      setHistory((h) => [{ v, win }, ...h].slice(0, 10));
      setRolling(false);
    }, 650);
  };

  const won = roll !== null && roll < target;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[radial-gradient(circle_at_top,#14532d,#052e16)] p-5 text-center ring-1 ring-white/10">
        <p className={cn("text-[54px] font-black tabular-nums leading-none", rolling ? "animate-pulse text-white/50" : roll === null ? "text-white/70" : won ? "text-emerald-300" : "text-red-400")}>
          {rolling ? "…" : roll === null ? "🎲" : roll.toFixed(2)}
        </p>
        <p className="mt-2 text-[12px] font-bold text-white/60">
          {roll === null || rolling ? `Roll under ${target} to win` : won ? `Win! ${cur()} ${money((parseFloat(stake) || 0) * multiplier)}` : "No luck this time"}
        </p>
        <div className="relative mt-4 h-3 rounded-full bg-gradient-to-r from-emerald-500 from-[var(--t)] to-red-500 to-[var(--t)]" style={{ ["--t" as string]: `${target}%` }}>
          {roll !== null && !rolling ? <span className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded bg-white shadow" style={{ left: `${roll}%` }} /> : null}
        </div>
        <input
          type="range"
          min={2}
          max={95}
          value={target}
          disabled={rolling}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="mt-3 w-full accent-emerald-400"
        />
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold text-white/60">
          <span>
            Target <b className="block text-[15px] text-white">{target}</b>
          </span>
          <span>
            Win chance <b className="block text-[15px] text-white">{target}%</b>
          </span>
          <span>
            Multiplier <b className="block text-[15px] text-white">{multiplier.toFixed(2)}x</b>
          </span>
        </div>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {history.map((h, i) => (
          <span key={i} className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-black", h.win ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300")}>
            {h.v.toFixed(2)}
          </span>
        ))}
      </div>
      <StakeInput value={stake} onChange={setStake} disabled={rolling} />
      <ActionButton onClick={go} disabled={rolling}>
        {rolling ? "Rolling…" : `Roll · ${cur()} ${money(parseFloat(stake) || 0)}`}
      </ActionButton>
    </div>
  );
}

/* ================================================================== */
/* WHEEL                                                               */
/* ================================================================== */

const SEGMENTS = [0, 1.5, 0, 2, 0, 1.2, 0, 3, 0, 1.5, 0, 1.2, 0, 4, 0, 1.5, 0, 1.2, 0, 2];
const SEG_COLOR: Record<string, string> = { "0": "#334155", "1.2": "#0ea5e9", "1.5": "#22c55e", "2": "#f59e0b", "3": "#ef4444", "4": "#a855f7" };

function arc(i: number) {
  const a0 = ((i * 18 - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * 18 - 90) * Math.PI) / 180;
  const r = 48;
  return `M50,50 L${50 + r * Math.cos(a0)},${50 + r * Math.sin(a0)} A${r},${r} 0 0 1 ${50 + r * Math.cos(a1)},${50 + r * Math.sin(a1)} Z`;
}

export function Wheel({ wallet }: EngineProps) {
  const [stake, setStake] = useState(String(sc(5)));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spin = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    const center = idx * 18 + 9;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (((360 - center - current) % 360) + 360) % 360;
    setRotation(rotation + 360 * 5 + delta);
    setSpinning(true);
    setResult(null);
    timer.current = window.setTimeout(() => {
      const m = SEGMENTS[idx];
      if (m > 0) wallet.credit(round2(amount * m));
      setResult(m);
      setSpinning(false);
    }, 4100);
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-[290px]">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 border-x-[11px] border-t-[20px] border-x-transparent border-t-white drop-shadow" />
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(0.12, 0.8, 0.18, 1)" : "none" }}
        >
          <circle cx="50" cy="50" r="49.5" fill="#0f172a" />
          {SEGMENTS.map((m, i) => (
            <g key={i}>
              <path d={arc(i)} fill={SEG_COLOR[String(m)]} stroke="#0f172a" strokeWidth="0.6" />
              <text
                x="50"
                y="11"
                textAnchor="middle"
                fontSize="4.2"
                fontWeight="900"
                fill="#fff"
                transform={`rotate(${i * 18 + 9} 50 50)`}
                fontFamily="Inter, sans-serif"
              >
                {m === 0 ? "0" : `${m}x`}
              </text>
            </g>
          ))}
          <circle cx="50" cy="50" r="9" fill="#0f172a" stroke="#fde047" strokeWidth="1.2" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-[13px] font-black text-amber-300">{result === null ? "SPIN" : `${result}x`}</span>
        </div>
      </div>
      <p className={cn("text-center text-[13px] font-black", result === null ? "text-white/50" : result > 0 ? "text-emerald-300" : "text-red-400")}>
        {spinning ? "Spinning…" : result === null ? "Land on a multiplier to win" : result > 0 ? `You won ${cur()} ${money((parseFloat(stake) || 0) * result)}` : "No win – spin again"}
      </p>
      <StakeInput value={stake} onChange={setStake} disabled={spinning} />
      <ActionButton onClick={spin} disabled={spinning}>
        {spinning ? "Spinning…" : `Spin · ${cur()} ${money(parseFloat(stake) || 0)}`}
      </ActionButton>
    </div>
  );
}

/* ================================================================== */
/* PENALTY                                                             */
/* ================================================================== */

const PER_GOAL = 1.45;
const ZONES = ["Top left", "Top centre", "Top right", "Bottom left", "Bottom centre", "Bottom right"];

export function Penalty({ wallet }: EngineProps) {
  const [stake, setStake] = useState(String(sc(5)));
  const [phase, setPhase] = useState<"idle" | "playing" | "saved" | "cashed">("idle");
  const [streak, setStreak] = useState(0);
  const [shot, setShot] = useState<{ zone: number; keeper: number; goal: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const bet = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const mult = Math.round(Math.pow(PER_GOAL, streak) * 100) / 100;

  const start = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    bet.current = amount;
    setStreak(0);
    setShot(null);
    setPhase("playing");
  };

  const cashOut = (s = streak) => {
    if (s === 0) return;
    wallet.credit(round2(bet.current * Math.pow(PER_GOAL, s)));
    setPhase("cashed");
  };

  const shoot = (zone: number) => {
    if (phase !== "playing" || busy) return;
    const keeperCol = Math.floor(Math.random() * 3);
    const goal = zone % 3 !== keeperCol;
    setBusy(true);
    setShot({ zone, keeper: keeperCol, goal });
    timer.current = window.setTimeout(() => {
      setBusy(false);
      if (!goal) {
        setPhase("saved");
        return;
      }
      const s = streak + 1;
      setStreak(s);
      if (s >= 5) cashOut(s);
    }, 700);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2 text-[12px] font-bold text-white/70">
        <span>
          Goals <b className="text-white">{streak}/5</b>
        </span>
        <span>
          Multiplier <b className="text-emerald-300">{mult.toFixed(2)}x</b>
        </span>
        <span>
          Next <b className="text-white">{(mult * PER_GOAL).toFixed(2)}x</b>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#14532d] to-[#166534] p-4 ring-1 ring-white/10">
        <div className="relative mx-auto rounded-t-lg border-x-[5px] border-t-[5px] border-white bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_6px,transparent_6px_12px)]">
          <div className="grid grid-cols-3 grid-rows-2">
            {ZONES.map((z, i) => {
              const isShot = shot?.zone === i;
              return (
                <button
                  key={z}
                  aria-label={z}
                  onClick={() => shoot(i)}
                  disabled={phase !== "playing" || busy}
                  className={cn("grid h-16 place-items-center border border-white/10 text-[26px] transition", phase === "playing" && !busy && "hover:bg-white/15 active:bg-white/25")}
                >
                  {isShot ? (shot.goal ? "⚽" : "🚫") : ""}
                </button>
              );
            })}
          </div>
          <span
            className="pointer-events-none absolute bottom-1 text-[40px] transition-all duration-500"
            style={{ left: `${(shot ? shot.keeper : 1) * 33.3 + 16.6}%`, transform: "translateX(-50%)" }}
          >
            🧤
          </span>
        </div>
        <p className="mt-3 text-center text-[13px] font-black text-white">
          {phase === "idle"
            ? "Place your stake, then pick a corner"
            : phase === "playing"
              ? shot
                ? shot.goal
                  ? "GOAL! Shoot again or cash out"
                  : "…"
                : "Choose where to shoot"
              : phase === "saved"
                ? "Saved! The keeper guessed right."
                : `Cashed out ${cur()} ${money(bet.current * mult)}`}
        </p>
      </div>

      {phase === "playing" ? (
        <ActionButton tone="orange" onClick={() => cashOut()} disabled={streak === 0 || busy}>
          {streak === 0 ? "Take your first shot" : `Cash Out ${cur()} ${money(bet.current * mult)}`}
        </ActionButton>
      ) : (
        <>
          <StakeInput value={stake} onChange={setStake} />
          <ActionButton onClick={start}>Start · {cur()} {money(parseFloat(stake) || 0)}</ActionButton>
        </>
      )}
      <p className="text-center text-[10.5px] font-semibold text-white/40">Keeper covers one of three columns · each goal pays ×{PER_GOAL}</p>
    </div>
  );
}
