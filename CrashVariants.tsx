import { useEffect, useRef, useState } from "react";
import { money, parseAmount } from "../lib/format";
import { cn } from "../utils/cn";
import { ActionButton, StakeInput, placeStake, type EngineProps } from "./common";
import { Poster } from "./poster";

const GROWTH = 0.000075;
const WAIT = 4200;
const CRASH_PAUSE = 2800;

function crashPoint() {
  const r = Math.random();
  if (r < 0.03) return 1;
  return Math.min(500, Math.max(1, Math.floor((0.97 / (1 - r)) * 100) / 100));
}

type Round = "waiting" | "flying" | "crashed";

export function CrashVariants({ game, wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [auto, setAuto] = useState("");
  const [round, setRound] = useState<Round>("waiting");
  const [mult, setMult] = useState(1);
  const [betAmount, setBetAmount] = useState(0);
  const [betStatus, setBetStatus] = useState<"idle" | "queued" | "active">("idle");
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>(() => Array.from({ length: 8 }, crashPoint));
  const [waitKey, setWaitKey] = useState(0);
  const phase = useRef<Round>("waiting");
  const crashAt = useRef(1);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  const betRef = useRef(0);
  const statusRef = useRef<"idle" | "queued" | "active">("idle");
  const cashed = useRef(false);
  const autoRef = useRef(0);
  const multRef = useRef(1);

  useEffect(() => {
    let alive = true;
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { if (alive) fn(); }, ms);
      timers.current.push(id);
    };

    const waiting = () => {
      phase.current = "waiting";
      setRound("waiting");
      setMult(1);
      multRef.current = 1;
      setCashedAt(null);
      if (statusRef.current === "active") {
        setBetAmount(0);
        betRef.current = 0;
        statusRef.current = "idle";
        setBetStatus("idle");
      }
      cashed.current = false;
      setWaitKey((k) => k + 1);
      schedule(fly, WAIT);
    };

    const fly = () => {
      phase.current = "flying";
      setRound("flying");
      crashAt.current = crashPoint();
      if (betRef.current > 0) {
        statusRef.current = "active";
        setBetStatus("active");
      }
      startedAt.current = performance.now();
      const tick = (t: number) => {
        if (!alive) return;
        const m = Math.max(1, Math.floor(Math.exp(GROWTH * (t - startedAt.current)) * 100) / 100);
        const cur = Math.min(m, crashAt.current);
        multRef.current = cur;
        if (autoRef.current && !cashed.current && cur >= autoRef.current && autoRef.current < crashAt.current) cashOut(autoRef.current);
        if (m >= crashAt.current) {
          doCrash();
          return;
        }
        setMult(cur);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    };

    const doCrash = () => {
      phase.current = "crashed";
      setRound("crashed");
      const point = crashAt.current;
      setMult(point);
      setHistory((h) => [point, ...h].slice(0, 10));
      if (statusRef.current === "active") {
        setBetAmount(0);
        betRef.current = 0;
        statusRef.current = "idle";
        setBetStatus("idle");
      }
      schedule(waiting, CRASH_PAUSE);
    };

    waiting();
    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
      timers.current.forEach((id) => window.clearTimeout(id));
      // a bet that never started is returned; an in-flight bet is already settled by the round
      if (statusRef.current === "queued" && betRef.current > 0) wallet.credit(betRef.current, `${game.name} bet cancelled`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cashOut = (at?: number) => {
    if (cashed.current || !betRef.current || phase.current !== "flying" || statusRef.current !== "active") return;
    const m = at ?? multRef.current;
    cashed.current = true;
    const win = Math.round(betRef.current * m * 100) / 100;
    wallet.credit(win, `${game.name} cash out ${m.toFixed(2)}x`);
    setCashedAt(m);
    setBetAmount(0);
    betRef.current = 0;
    statusRef.current = "idle";
    setBetStatus("idle");
  };

  const place = () => {
    if (betRef.current) return;
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    betRef.current = amount;
    setBetAmount(amount);
    statusRef.current = "queued";
    setBetStatus("queued");
    const target = parseAmount(auto);
    autoRef.current = target >= 1.01 ? target : 0;
  };

  const cancel = () => {
    if (!betRef.current || statusRef.current !== "queued") return;
    wallet.credit(betRef.current, `${game.name} bet cancelled`);
    betRef.current = 0;
    setBetAmount(0);
    statusRef.current = "idle";
    setBetStatus("idle");
  };

  const x = Math.min(90, 8 + Math.log(mult) * 19);
  const y = 88 - Math.min(62, Math.log(mult) * 17);
  const activeBet = betStatus === "active" && !cashedAt;

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {history.map((h, i) => (
          <span key={i} className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-black", h < 2 ? "bg-sky-500/20 text-sky-300" : h < 10 ? "bg-violet-500/25 text-violet-300" : "bg-pink-500/25 text-pink-300")}>
            {h.toFixed(2)}x
          </span>
        ))}
      </div>

      <div className="relative h-[245px] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <Poster theme={(game.poster ?? "rocket") as never} className="absolute inset-0 opacity-55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_70%,rgba(124,58,237,0.4),transparent_65%)]" />
        {round !== "waiting" ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("absolute inset-0 h-full w-full transition-opacity duration-300", round === "crashed" && "opacity-0")}>
            <path d={`M0,100 L0,94 Q${x * 0.62},94 ${x},${y + 5} L${x},100 Z`} fill="rgba(229,5,57,0.3)" />
            <path d={`M0,94 Q${x * 0.62},94 ${x},${y + 5}`} fill="none" stroke="#e50539" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          {round === "waiting" ? (
            <>
              <p className="text-[14px] font-bold uppercase tracking-widest text-white/85">Waiting for next round</p>
              <div className="mt-3 h-[6px] w-48 overflow-hidden rounded-full bg-white/15">
                <div key={waitKey} className="h-full rounded-full bg-[#e50539]" style={{ animation: `shrinkBar ${WAIT}ms linear forwards` }} />
              </div>
              {activeBet ? <p className="mt-3 rounded-full bg-emerald-500/20 px-3 py-1 text-[12px] font-bold text-emerald-300">Bet placed · {money(betAmount)}</p> : null}
            </>
          ) : (
            <>
              {round === "crashed" ? <p className="mb-1 text-[18px] font-black uppercase tracking-widest text-[#ff4d6a]">Flew away!</p> : null}
              <p className={cn("text-[58px] font-black leading-none tabular-nums drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]", round === "crashed" ? "text-[#e50539]" : "text-white")}>{mult.toFixed(2)}x</p>
              {cashedAt ? <p className="mt-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[12px] font-black text-emerald-300">Cashed out at {cashedAt.toFixed(2)}x</p> : null}
            </>
          )}
        </div>
      </div>

      <StakeInput value={stake} onChange={setStake} disabled={round === "flying" && activeBet} />
      <div className="flex items-center gap-2 rounded-2xl bg-white/[0.07] px-3 py-2">
        <span className="text-[11.5px] font-bold text-white/60">Auto cash out at</span>
        <input inputMode="decimal" value={auto} onChange={(e) => setAuto(e.target.value)} placeholder="off" className="w-20 rounded-lg bg-black/30 px-2 py-1.5 text-right text-[13px] font-black text-white outline-none placeholder:text-white/30" />
        <span className="text-[12px] font-black text-white/60">x</span>
      </div>

      {round === "flying" && activeBet ? (
        <ActionButton tone="orange" onClick={() => cashOut()}>Cash Out {money(betAmount * mult)}</ActionButton>
      ) : betStatus === "queued" ? (
        <ActionButton tone="gray" onClick={cancel}>Cancel next-round bet {money(betAmount)}</ActionButton>
      ) : (
        <ActionButton onClick={place} disabled={round === "crashed"}>Bet {money(parseAmount(stake))}</ActionButton>
      )}
    </div>
  );
}
