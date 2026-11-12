import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { cleanAmount, money } from "../lib/format";
import { cur, sc, scale } from "../lib/currency";
import { cn } from "../utils/cn";
import { Plane } from "./art";
import { sfx, useSound } from "./sfx";
import type { FullGameProps } from "./common";

/* ------------------------------------------------------------------ */
/* engine constants                                                    */
/* ------------------------------------------------------------------ */

const K = 0.00008; // multiplier growth per ms (≈ 2.00x after 8.7s)
const WAIT_MS = 5500;
const CRASH_MS = 3200;
const MIN_BET = () => sc(0.1);
const MAX_BET = () => sc(1000);
const MAX_WIN = () => sc(10000);

type Phase = "waiting" | "flying" | "crashed";
type Status = "idle" | "queued" | "placed" | "active";
type Panel = { stake: string; tab: "bet" | "auto"; autoBet: boolean; autoCash: boolean; autoCashAt: string; status: Status; amount: number };
type Player = { id: string; name: string; av: number; bet: number; target: number | null; cashed: number | null; me?: boolean };
type MyBet = { id: string; at: number; stake: number; mult: number | null; win: number; crash?: number };

const newPanel = (): Panel => ({ stake: sc(1).toFixed(2), tab: "bet", autoBet: false, autoCash: false, autoCashAt: "2.00", status: "idle", amount: 0 });

function drawCrash() {
  const r = Math.random();
  if (r < 0.03) return 1;
  return Math.min(1000, Math.max(1, Math.floor((0.97 / (1 - r)) * 100) / 100));
}

const hex = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const multColor = (m: number) => (m < 2 ? "text-[#34b4ff]" : m < 10 ? "text-[#913ef8]" : "text-[#c017b4]");
const multBg = (m: number) => (m < 2 ? "bg-[#34b4ff]/15 text-[#34b4ff]" : m < 10 ? "bg-[#913ef8]/20 text-[#b57bff]" : "bg-[#c017b4]/20 text-[#e04fd6]");

const AV = [
  ["#f97316", "#facc15"],
  ["#22c55e", "#14532d"],
  ["#06b6d4", "#1e3a8a"],
  ["#a855f7", "#4c1d95"],
  ["#ef4444", "#7f1d1d"],
  ["#eab308", "#713f12"],
  ["#ec4899", "#831843"],
  ["#64748b", "#0f172a"],
];
const LETTERS = "abcdefghijkmnoprstuwyz";
const randName = () => `${LETTERS[Math.floor(Math.random() * LETTERS.length)]}***${Math.floor(Math.random() * 10)}`;

function makeCrowd(): { total: number; rows: Player[] } {
  const stakes = [0.5, 1, 1, 2, 2, 5, 5, 10, 10, 20, 50, 100, 200];
  const rows: Player[] = Array.from({ length: 36 }, (_, i) => {
    const r = Math.random();
    return {
      id: `p${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: randName(),
      av: Math.floor(Math.random() * AV.length),
      bet: stakes[Math.floor(Math.random() * stakes.length)] * scale(),
      target: r < 0.22 ? null : Math.round((1.05 + Math.pow(Math.random(), 2.2) * 9) * 100) / 100,
      cashed: null,
    };
  }).sort((a, b) => b.bet - a.bet);
  return { total: 1800 + Math.floor(Math.random() * 2400), rows };
}

const TOP = Array.from({ length: 20 }, (_, i) => {
  const bet = [5, 10, 20, 50, 100, 200][i % 6];
  const mult = Math.round((20 + Math.random() * 480) * 100) / 100;
  const d = new Date(Date.now() - Math.random() * 6 * 86_400_000);
  return { id: `t${i}`, name: randName(), av: i % AV.length, bet, mult, win: Math.round(bet * mult * 100) / 100, date: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}` };
});

/* ------------------------------------------------------------------ */
/* small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Avatar({ i, size = 26, label, me }: { i: number; size?: number; label?: string; me?: boolean }) {
  const [a, b] = me ? ["#ffd23f", "#f59e0b"] : AV[i % AV.length];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border-2 border-[#1b1c1d] text-[10px] font-black uppercase text-white"
      style={{ width: size, height: size, backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {label ?? ""}
    </span>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-[22px] w-10 shrink-0 rounded-full border transition disabled:opacity-40", on ? "border-[#60ae05] bg-[#229607]" : "border-[#4a4a4f] bg-[#2c2d30]")}
    >
      <span className={cn("absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all", on ? "left-[20px]" : "left-[2px]")} />
    </button>
  );
}

function DarkSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[90] flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[85%] flex-col rounded-t-3xl bg-[#1b1c1d] text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-[15px] font-bold uppercase tracking-wide">{title}</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[16px]" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bet panel                                                           */
/* ------------------------------------------------------------------ */

function stepFor(v: number) {
  const b = v / scale();
  return (b < 1 ? 0.1 : b < 20 ? 1 : b < 100 ? 5 : 10) * scale();
}

function BetPanel({
  p,
  phase,
  mult,
  onChange,
  onBet,
  onCancel,
  onCashOut,
  corner,
}: {
  p: Panel;
  phase: Phase;
  mult: number;
  onChange: (patch: Partial<Panel>) => void;
  onBet: () => void;
  onCancel: () => void;
  onCashOut: () => void;
  corner?: ReactNode;
}) {
  const locked = p.status !== "idle";
  const v = parseFloat(p.stake) || 0;
  const setStake = (n: number) => onChange({ stake: Math.min(MAX_BET(), Math.max(MIN_BET(), Math.round(n * 100) / 100)).toFixed(2) });

  let button: ReactNode;
  if (p.status === "active" && phase === "flying") {
    button = (
      <button onClick={onCashOut} className="flex h-full w-full flex-col items-center justify-center rounded-[18px] border-2 border-[#ffbd71] bg-[#d07206] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] active:scale-[0.98]">
        <span className="text-[22px] font-normal leading-tight">Cash Out</span>
        <span className="text-[26px] font-normal leading-tight tabular-nums">
          {money(Math.min(MAX_WIN(), p.amount * mult))}
          <span className="text-[16px]"> {cur()}</span>
        </span>
      </button>
    );
  } else if (p.status === "queued" || p.status === "placed") {
    button = (
      <div className="flex h-full w-full flex-col gap-1">
        {p.status === "queued" ? <p className="text-center text-[11px] text-white/60">Waiting for next round</p> : null}
        <button onClick={onCancel} className="flex w-full flex-1 flex-col items-center justify-center rounded-[18px] border-2 border-[#ff7d8e] bg-[#cb011a] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] active:scale-[0.98]">
          <span className="text-[24px] font-normal">Cancel</span>
        </button>
      </div>
    );
  } else {
    button = (
      <button onClick={onBet} className="flex h-full w-full flex-col items-center justify-center rounded-[18px] border-2 border-[#b2f2a3] bg-[#28a909] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] active:scale-[0.98]">
        <span className="text-[24px] font-normal leading-tight">Bet</span>
        <span className="text-[26px] font-normal leading-tight tabular-nums">
          {money(v)}
          <span className="text-[16px]"> {cur()}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="relative rounded-[20px] bg-[#1b1c1d] px-3 pb-3 pt-2.5">
      <div className="relative flex items-center justify-center">
        <div className="flex w-[190px] rounded-full bg-[#141516] p-[3px]">
          {(["bet", "auto"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ tab: t })}
              className={cn("flex-1 rounded-full py-1.5 text-[14px] capitalize transition", p.tab === t ? "bg-[#2c2d30] text-white" : "text-white/55")}
            >
              {t}
            </button>
          ))}
        </div>
        {corner ? <div className="absolute right-0 top-1/2 -translate-y-1/2">{corner}</div> : null}
      </div>

      <div className="mt-2.5 flex h-[118px] gap-2.5">
        <div className={cn("flex w-[44%] flex-col gap-1.5", locked && "pointer-events-none opacity-50")}>
          <div className="flex h-10 items-center rounded-full bg-[#141516] px-1">
            <button aria-label="Decrease" onClick={() => setStake(v - stepFor(v - 0.001))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3a3b3f] text-[18px] text-white/80">
              −
            </button>
            <input
              inputMode="decimal"
              value={p.stake}
              onChange={(e) => onChange({ stake: cleanAmount(e.target.value) })}
              onBlur={() => setStake(parseFloat(p.stake) || MIN_BET())}
              className="w-full min-w-0 bg-transparent text-center text-[18px] font-bold text-white outline-none"
            />
            <button aria-label="Increase" onClick={() => setStake(v + stepFor(v))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3a3b3f] text-[18px] text-white/80">
              +
            </button>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-1.5">
            {[2, 5, 10, 50].map(sc).map((q) => (
              <button key={q} onClick={() => setStake(q)} className="rounded-full bg-[#141516] text-[15px] text-white/55 active:bg-[#2c2d30]">
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">{button}</div>
      </div>

      {p.tab === "auto" ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[12.5px] text-white/70">
          <label className="flex items-center gap-2">
            <Toggle on={p.autoBet} onChange={(on) => onChange({ autoBet: on })} />
            Auto Bet
          </label>
          <label className="flex items-center gap-2">
            Auto Cash Out
            <Toggle on={p.autoCash} onChange={(on) => onChange({ autoCash: on })} disabled={p.status === "active"} />
            <span className={cn("flex h-7 items-center rounded-full bg-[#141516] px-2", !p.autoCash && "opacity-40")}>
              <input
                inputMode="decimal"
                disabled={!p.autoCash || p.status === "active"}
                value={p.autoCashAt}
                onChange={(e) => onChange({ autoCashAt: cleanAmount(e.target.value) })}
                onBlur={() => onChange({ autoCashAt: Math.max(1.01, parseFloat(p.autoCashAt) || 1.01).toFixed(2) })}
                className="w-11 bg-transparent text-right text-[13px] font-bold text-white outline-none"
              />
              <span className="ml-0.5 text-white/50">x</span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* main game                                                           */
/* ------------------------------------------------------------------ */

export function Aviator({ wallet, playerName, setMode, onExit, onDeposit }: FullGameProps) {
  const [sound, setSound] = useSound();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const panels = useRef<Panel[]>([newPanel(), newPanel()]);
  const [twoPanels, setTwoPanels] = useState(true);
  const twoRef = useRef(true);
  twoRef.current = twoPanels;

  const [phase, setPhase] = useState<Phase>("waiting");
  const phaseRef = useRef<Phase>("waiting");
  const [mult, setMult] = useState(1);
  const multRef = useRef(1);
  const crashRef = useRef(2);
  const startRef = useRef(0);
  const [waitKey, setWaitKey] = useState(0);
  const [history, setHistory] = useState<number[]>(() => Array.from({ length: 40 }, drawCrash));
  const crowd = useRef(makeCrowd());
  const mine = useRef<Player[]>([]);
  const [prev, setPrev] = useState<{ crash: number; rows: Player[] } | null>(null);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [winToast, setWinToast] = useState<{ id: number; m: number; win: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | "history" | "limits" | "rules" | "fair" | "rounds">(null);
  const [tab, setTab] = useState<"all" | "prev" | "top">("all");
  const [topTab, setTopTab] = useState<"win" | "mult">("win");
  const [anim, setAnim] = useState(true);
  const [confirmExit, setConfirmExit] = useState(false);
  const [seed, setSeed] = useState<{ current: string; prev: { seed: string; crash: number } | null }>(() => ({ current: hex(), prev: null }));
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const setPanel = (i: number, patch: Partial<Panel>) => {
    panels.current = panels.current.map((p, j) => (j === i ? { ...p, ...patch } : p));
    bump();
  };

  const record = (b: Omit<MyBet, "id" | "at">) => setMyBets((list) => [{ ...b, id: Math.random().toString(36).slice(2), at: Date.now() }, ...list].slice(0, 100));

  const debitPanel = (i: number) => {
    const p = panels.current[i];
    const amt = Math.round((parseFloat(p.stake) || 0) * 100) / 100;
    const w = walletRef.current;
    if (amt < MIN_BET() || amt > MAX_BET()) {
      w.fail(`Bet must be between ${MIN_BET().toFixed(2)} and ${MAX_BET().toFixed(2)} ${cur()}`);
      setPanel(i, { status: "idle", autoBet: false });
      return;
    }
    if (!w.debit(amt)) {
      w.fail(w.demo ? "Not enough demo balance – reset it from the menu" : "Insufficient balance – please deposit");
      setPanel(i, { status: "idle", autoBet: false });
      return;
    }
    mine.current = [...mine.current.filter((r) => r.id !== `me${i}`), { id: `me${i}`, name: playerName, av: 0, bet: amt, target: null, cashed: null, me: true }];
    setPanel(i, { status: "placed", amount: amt });
  };

  const cashOut = (i: number, at?: number) => {
    const p = panels.current[i];
    if (p.status !== "active") return;
    const m = at ?? multRef.current;
    const win = Math.min(MAX_WIN(), Math.round(p.amount * m * 100) / 100);
    walletRef.current.credit(win, "Aviator win");
    mine.current = mine.current.map((r) => (r.id === `me${i}` ? { ...r, cashed: m } : r));
    setPanel(i, { status: "idle", amount: 0 });
    record({ stake: p.amount, mult: m, win });
    setWinToast({ id: Date.now() + i, m, win });
    sfx.win();
  };

  const onBet = (i: number) => {
    sfx.click();
    if (phaseRef.current === "waiting") debitPanel(i);
    else setPanel(i, { status: "queued" });
  };

  const onCancel = (i: number) => {
    const p = panels.current[i];
    if (p.status === "placed") {
      walletRef.current.credit(p.amount, "Aviator bet cancelled");
      mine.current = mine.current.filter((r) => r.id !== `me${i}`);
    }
    setPanel(i, { status: "idle", amount: 0, autoBet: false });
  };

  /* ---------------- round loop ---------------- */
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let timer = 0;

    const startWaiting = () => {
      if (!alive) return;
      phaseRef.current = "waiting";
      setPhase("waiting");
      setWaitKey((k) => k + 1);
      crowd.current = makeCrowd();
      mine.current = [];
      multRef.current = 1;
      setMult(1);
      panels.current.forEach((p, i) => {
        if (i === 1 && !twoRef.current) return;
        if (p.status === "queued" || (p.status === "idle" && p.autoBet)) debitPanel(i);
      });
      timer = window.setTimeout(startFlying, WAIT_MS);
    };

    const startFlying = () => {
      if (!alive) return;
      crashRef.current = drawCrash();
      panels.current = panels.current.map((p) => (p.status === "placed" ? { ...p, status: "active" } : p));
      bump();
      startRef.current = performance.now();
      phaseRef.current = "flying";
      setPhase("flying");
      sfx.takeoff();
      const tick = (now: number) => {
        if (!alive) return;
        const crash = crashRef.current;
        const m = Math.max(1, Math.floor(Math.exp(K * (now - startRef.current)) * 100) / 100);
        const cur = Math.min(m, crash);
        multRef.current = cur;
        panels.current.forEach((p, i) => {
          if (p.status !== "active") return;
          const at = parseFloat(p.autoCashAt);
          if (p.autoCash && at >= 1.01 && cur >= at && at <= crash) cashOut(i, at);
          else if (p.amount * cur >= MAX_WIN()) cashOut(i, cur);
        });
        for (const r of crowd.current.rows) if (r.cashed === null && r.target !== null && r.target <= cur && r.target < crash) r.cashed = r.target;
        if (m >= crash) {
          doCrash();
          return;
        }
        setMult(cur);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const doCrash = () => {
      const crash = crashRef.current;
      multRef.current = crash;
      setMult(crash);
      phaseRef.current = "crashed";
      setPhase("crashed");
      sfx.crash();
      panels.current.forEach((p) => {
        if (p.status === "active") record({ stake: p.amount, mult: null, win: 0, crash });
      });
      panels.current = panels.current.map((p) => (p.status === "active" ? { ...p, status: "idle", amount: 0 } : p));
      bump();
      setHistory((h) => [crash, ...h].slice(0, 60));
      setPrev({ crash, rows: [...mine.current, ...crowd.current.rows].map((r) => ({ ...r })) });
      setSeed((s) => ({ current: hex(), prev: { seed: s.current, crash } }));
      timer = window.setTimeout(startWaiting, CRASH_MS);
    };

    startWaiting();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      panels.current.forEach((p) => {
        if (p.status === "placed") walletRef.current.credit(p.amount, "Aviator bet refunded");
      });
    };
    // engine runs once for the lifetime of the game window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!winToast) return;
    const t = window.setTimeout(() => setWinToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [winToast]);

  const busy = panels.current.some((p) => p.status !== "idle");
  const activeCount = panels.current.filter((p) => p.status === "active").length;

  const requestExit = () => {
    if (activeCount) setConfirmExit(true);
    else onExit();
  };

  const changeMode = (m: "demo" | "real") => {
    if (busy) {
      wallet.fail("Cancel or settle your current bets before switching mode");
      return;
    }
    setMenu(false);
    setMode(m);
  };

  /* ---------------- canvas geometry ---------------- */
  const elapsed = phase === "flying" ? (performance.now() - startRef.current) / 1000 : 0;
  const px = Math.min(1, elapsed / 7.5);
  const ease = 1 - Math.pow(1 - px, 2);
  const py = Math.min(1, Math.log(mult) / Math.log(3.2));
  const bob = px >= 1 ? Math.sin(elapsed * 1.4) * 3 : 0;
  const x = phase === "waiting" ? 7 : 7 + 74 * ease;
  const y = phase === "waiting" ? 86 : 86 - 56 * py + bob;
  const players = crowd.current.total + mine.current.length;

  const allRows = useMemo(() => [...mine.current, ...crowd.current.rows], [mult, phase, waitKey, busy]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalWin = allRows.reduce((a, r) => a + (r.cashed ? r.bet * r.cashed : 0), 0) * (players / Math.max(1, allRows.length)) * 0.35;

  const topRows = TOP.map((r) => ({ ...r, bet: r.bet * scale(), win: r.win * scale() })).sort((a, b) => (topTab === "win" ? b.win - a.win : b.mult - a.mult));

  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-[#0e0e0e] font-sans text-white">
      {/* header */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 bg-[#1b1c1d] px-2.5">
        <button onClick={requestExit} aria-label="Back to casino" className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] shadow-[0_0_0_3px_rgba(167,139,250,0.25)]">
          <span className="h-4 w-4 rounded-[5px] bg-white" />
        </button>
        <span className="font-aviator text-[28px] leading-none text-[#e50539]">Aviator</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right leading-tight">
            {wallet.demo ? <p className="text-[9px] font-bold uppercase tracking-wider text-[#f5a623]">Demo</p> : null}
            <p className="text-[17px] font-bold tabular-nums">
              {money(wallet.balance)} <span className="text-[13px] font-semibold text-white/70">{cur()}</span>
            </p>
          </div>
          <button onClick={() => setMenu((m) => !m)} aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-full bg-[#2c2d30]">
            <span className="flex flex-col gap-[3px]">
              <span className="h-[2px] w-4 rounded bg-white" />
              <span className="h-[2px] w-4 rounded bg-white" />
              <span className="h-[2px] w-4 rounded bg-white" />
            </span>
          </button>
        </div>
      </div>

      {/* menu */}
      {menu ? (
        <>
          <button aria-label="Close menu" className="absolute inset-0 z-[80]" onClick={() => setMenu(false)} />
          <div className="animate-pop absolute right-2 top-[52px] z-[85] w-[270px] overflow-hidden rounded-2xl bg-[#2c2d30] shadow-2xl">
            <div className="flex items-center gap-2.5 bg-[#1b1c1d] p-3">
              <Avatar i={0} me size={36} label={playerName.slice(0, 1)} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold">{playerName}</p>
                <p className="text-[10.5px] text-white/50">{wallet.demo ? "Demo mode" : "Real money"}</p>
              </div>
            </div>
            <div className="flex border-b border-white/[0.06] p-2">
              {(["demo", "real"] as const).map((m) => (
                <button key={m} onClick={() => changeMode(m)} className={cn("flex-1 rounded-lg py-1.5 text-[12px] font-bold capitalize", (m === "demo") === wallet.demo ? "bg-[#28a909]" : "text-white/60")}>
                  {m === "demo" ? "Demo" : "Real money"}
                </button>
              ))}
            </div>
            {[
              { label: "Sound", right: <Toggle on={sound} onChange={setSound} /> },
              { label: "Animation", right: <Toggle on={anim} onChange={setAnim} /> },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5 text-[13px]">
                {r.label}
                {r.right}
              </div>
            ))}
            {[
              { label: "My Bet History", act: () => setSheet("history") },
              { label: "Round History", act: () => setSheet("rounds") },
              { label: "Game Limits", act: () => setSheet("limits") },
              { label: "How To Play", act: () => setSheet("rules") },
              { label: "Provably Fair Settings", act: () => setSheet("fair") },
              ...(wallet.demo ? [{ label: "Reset demo balance", act: () => walletRef.current.credit(Math.max(0, 1000 - wallet.balance), "reset") }] : [{ label: "Deposit", act: onDeposit }]),
              { label: "Back to Casino", act: requestExit },
            ].map((r) => (
              <button
                key={r.label}
                onClick={() => {
                  setMenu(false);
                  r.act();
                }}
                className="flex w-full items-center justify-between border-b border-white/[0.06] px-3 py-2.5 text-left text-[13px] last:border-0 active:bg-white/5"
              >
                {r.label}
                <span className="text-white/30">›</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
        {/* round history strip */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="flex gap-3.5 whitespace-nowrap">
              {history.slice(0, 14).map((h, i) => (
                <span key={`${h}-${i}-${history.length}`} className={cn("text-[14px] font-semibold tabular-nums", multColor(h), i === 0 && phase === "crashed" && "animate-pop")}>
                  {h.toFixed(2)}x
                </span>
              ))}
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0e0e0e]" />
          </div>
          <button onClick={() => setSheet("rounds")} aria-label="Round history" className="grid h-7 w-11 shrink-0 place-items-center rounded-full bg-[#2c2d30] text-[14px] font-bold tracking-widest text-white/80">
            •••
          </button>
        </div>

        {/* game canvas */}
        <div className="relative mx-2 h-[250px] overflow-hidden rounded-[22px] border border-[#2a2b2e] bg-black">
          <div
            className={cn("absolute h-[900px] w-[900px] rounded-full", anim && phase === "flying" && "animate-rays")}
            style={{
              left: -450,
              bottom: -450,
              backgroundImage: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.055) 0deg 4deg, transparent 4deg 12deg)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_60%,rgba(124,58,237,0.55),rgba(76,29,149,0.25)_35%,transparent_65%)]" />

          {phase !== "waiting" ? (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("absolute inset-0 h-full w-full transition-opacity duration-300", phase === "crashed" && "opacity-0")}>
              <defs>
                <linearGradient id="avFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8a0020" stopOpacity="0.95" />
                  <stop offset="1" stopColor="#5a0013" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <path d={`M0,100 L0,96 Q${(x - 0) * 0.62},96 ${x},${y + 4} L${x},100 Z`} fill="url(#avFill)" />
              <path d={`M0,96 Q${(x - 0) * 0.62},96 ${x},${y + 4}`} fill="none" stroke="#e50539" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : null}

          {/* plane */}
          <div
            className={cn("absolute z-10 w-[86px]", phase === "crashed" ? "transition-all duration-700 ease-in" : "")}
            style={{
              left: phase === "crashed" ? "125%" : `${x}%`,
              top: phase === "crashed" ? "-30%" : `${y}%`,
              transform: `translate(-12%, -62%) rotate(${phase === "flying" ? -8 + bob : -8}deg)`,
            }}
          >
            <Plane className="w-full drop-shadow-[0_4px_10px_rgba(229,5,57,0.5)]" spinning={anim} />
          </div>

          {/* centre text */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
            {phase === "waiting" ? (
              <>
                <svg viewBox="0 0 60 60" className={cn("h-16 w-16", anim && "animate-spin-fast")}>
                  <ellipse cx="30" cy="14" rx="6" ry="14" fill="#e50539" />
                  <ellipse cx="30" cy="46" rx="6" ry="14" fill="#e50539" />
                  <circle cx="30" cy="30" r="6" fill="#7a0018" />
                </svg>
                <p className="mt-3 text-[15px] font-semibold uppercase tracking-wide text-white">Waiting for next round</p>
                <div className="mt-2.5 h-[6px] w-48 overflow-hidden rounded-full bg-[#2c2d30]">
                  <div key={waitKey} className="h-full rounded-full bg-[#e50539]" style={{ animation: `shrinkBar ${WAIT_MS}ms linear forwards` }} />
                </div>
              </>
            ) : (
              <>
                {phase === "crashed" ? <p className="mb-1 text-[20px] font-bold uppercase tracking-wide text-white">Flew away!</p> : null}
                <p className={cn("text-[70px] font-black leading-none tracking-tight tabular-nums drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]", phase === "crashed" ? "text-[#e50539]" : "text-white")}>
                  {mult.toFixed(2)}x
                </p>
              </>
            )}
          </div>

          {/* cash-out toast */}
          {winToast ? (
            <div key={winToast.id} className="animate-pop absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center overflow-hidden rounded-full border border-[#427f00] bg-[#123405] shadow-xl">
              <div className="px-3 py-1.5 text-center leading-tight">
                <p className="text-[10.5px] text-white/70">You have cashed out!</p>
                <p className="text-[16px] font-bold">{winToast.m.toFixed(2)}x</p>
              </div>
              <div className="bg-[#28a909] px-3 py-1.5 text-center leading-tight">
                <p className="text-[10.5px] text-white/80">Win {cur()}</p>
                <p className="text-[16px] font-bold tabular-nums">{money(winToast.win)}</p>
              </div>
            </div>
          ) : null}

          {/* players chip */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3 backdrop-blur-sm">
            <span className="flex -space-x-2.5">
              {[1, 5, 3].map((i) => (
                <Avatar key={i} i={i} size={28} />
              ))}
            </span>
            <span className="text-[15px] font-semibold tabular-nums">{players.toLocaleString()}</span>
          </div>
        </div>

        {/* bet panels */}
        <div className="mt-2 space-y-2 px-2">
          <BetPanel
            p={panels.current[0]}
            phase={phase}
            mult={mult}
            onChange={(patch) => setPanel(0, patch)}
            onBet={() => onBet(0)}
            onCancel={() => onCancel(0)}
            onCashOut={() => cashOut(0)}
            corner={
              !twoPanels ? (
                <button onClick={() => setTwoPanels(true)} aria-label="Add second bet" className="grid h-8 w-8 place-items-center rounded-full bg-[#141516] text-[18px] text-white/70">
                  +
                </button>
              ) : undefined
            }
          />
          {twoPanels ? (
            <BetPanel
              p={panels.current[1]}
              phase={phase}
              mult={mult}
              onChange={(patch) => setPanel(1, patch)}
              onBet={() => onBet(1)}
              onCancel={() => onCancel(1)}
              onCashOut={() => cashOut(1)}
              corner={
                <button
                  onClick={() => {
                    if (panels.current[1].status !== "idle") return wallet.fail("Settle this bet before removing the panel");
                    setTwoPanels(false);
                  }}
                  aria-label="Remove second bet"
                  className="grid h-8 w-8 place-items-center rounded-full bg-[#141516]"
                >
                  <span className="grid h-4 w-5 place-items-center rounded-[4px] border-2 border-white/70">
                    <span className="h-[2px] w-2 bg-white/70" />
                  </span>
                </button>
              }
            />
          ) : null}
        </div>

        {/* bets tables */}
        <div className="mx-2 mt-2 rounded-[20px] bg-[#1b1c1d] p-2.5">
          <div className="flex rounded-full bg-[#141516] p-[3px]">
            {(
              [
                ["all", "All Bets"],
                ["prev", "Previous"],
                ["top", "Top"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-full py-2 text-[14px] transition", tab === k ? "bg-[#2c2d30] text-white" : "text-white/55")}>
                {l}
              </button>
            ))}
          </div>

          {tab === "all" ? (
            <>
              <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-[#141516] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex -space-x-2.5">
                    {[2, 6, 4].map((i) => (
                      <Avatar key={i} i={i} size={30} />
                    ))}
                  </span>
                  <span className="text-[11px] leading-tight text-white/55">
                    {players.toLocaleString()}
                    <br />
                    bets
                  </span>
                </div>
                <div className="text-right leading-tight">
                  <p className="text-[10.5px] text-white/45">Total win {cur()}</p>
                  <p className="text-[22px] font-bold tabular-nums">{money(totalWin)}</p>
                </div>
              </div>
              <BetsTable rows={allRows} />
            </>
          ) : null}

          {tab === "prev" ? (
            prev ? (
              <>
                <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-[#141516] px-3 py-2.5">
                  <span className="text-[12px] text-white/55">Round result</span>
                  <span className={cn("rounded-full px-3 py-1 text-[15px] font-bold", multBg(prev.crash))}>{prev.crash.toFixed(2)}x</span>
                </div>
                <BetsTable rows={prev.rows} settled />
              </>
            ) : (
              <p className="py-8 text-center text-[12px] text-white/45">The previous round will appear here after this round ends.</p>
            )
          ) : null}

          {tab === "top" ? (
            <>
              <div className="mt-2.5 flex justify-center gap-2">
                {(
                  [
                    ["win", "Huge wins"],
                    ["mult", "Multipliers"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} onClick={() => setTopTab(k)} className={cn("rounded-full px-3 py-1 text-[12px]", topTab === k ? "bg-[#2c2d30] text-white" : "text-white/50")}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-2 space-y-1.5">
                {topRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 rounded-xl bg-[#141516] px-2.5 py-2">
                    <Avatar i={r.av} size={30} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-[12px] font-semibold">{r.name}</p>
                      <p className="text-[10.5px] text-white/45">
                        {r.date} · Bet {money(r.bet)} {cur()}
                      </p>
                    </div>
                    <div className="text-right leading-tight">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", multBg(r.mult))}>{r.mult.toFixed(2)}x</span>
                      <p className="mt-0.5 text-[12.5px] font-bold tabular-nums">{money(r.win)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <p className="mt-3 text-center text-[10.5px] text-white/30">
          Provably fair game · {seed.current.slice(0, 10)}… · 18+
        </p>
      </div>

      {/* sheets */}
      {sheet === "rounds" ? (
        <DarkSheet title="Round history" onClose={() => setSheet(null)}>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span key={i} className={cn("rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums", multBg(h))}>
                {h.toFixed(2)}x
              </span>
            ))}
          </div>
        </DarkSheet>
      ) : null}
      {sheet === "history" ? (
        <DarkSheet title="My bet history" onClose={() => setSheet(null)}>
          {myBets.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-white/50">You have not placed any bets in this session yet.</p>
          ) : (
            <div className="space-y-1.5">
              {myBets.map((b) => (
                <div key={b.id} className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px]", b.mult ? "border border-[#427f00] bg-[#123405]" : "bg-[#141516]")}>
                  <span className="text-white/60">{new Date(b.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <span>Bet {money(b.stake)}</span>
                  {b.mult ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", multBg(b.mult))}>{b.mult.toFixed(2)}x</span> : <span className="text-white/40">lost {b.crash?.toFixed(2)}x</span>}
                  <span className="font-bold tabular-nums">{b.win ? money(b.win) : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </DarkSheet>
      ) : null}
      {sheet === "limits" ? (
        <DarkSheet title="Game limits" onClose={() => setSheet(null)}>
          {[
            ["Minimum bet", `${MIN_BET().toFixed(2)} ${cur()}`],
            ["Maximum bet", `${MAX_BET().toFixed(2)} ${cur()}`],
            ["Maximum win per bet", `${MAX_WIN().toLocaleString()}.00 ${cur()}`],
            ["Return to player", "97%"],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between border-b border-white/10 py-3 text-[13.5px]">
              <span className="text-white/60">{l}</span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
        </DarkSheet>
      ) : null}
      {sheet === "rules" ? (
        <DarkSheet title="How to play" onClose={() => setSheet(null)}>
          <ol className="space-y-3 text-[13px] leading-relaxed text-white/75">
            <li>
              <b className="text-white">1. Make a bet</b> – choose your stake and press Bet before the round starts. Bets placed during a flight join the next round.
            </li>
            <li>
              <b className="text-white">2. Watch the plane</b> – your potential win grows with the multiplier as the plane climbs.
            </li>
            <li>
              <b className="text-white">3. Cash out</b> – press Cash Out before the plane flies away. Your win is your stake × the multiplier at that moment. If the plane flies away first, the bet is lost.
            </li>
            <li>
              <b className="text-white">Two bets</b> – use both panels to place two independent bets in the same round.
            </li>
            <li>
              <b className="text-white">Auto</b> – Auto Bet re-places your bet every round; Auto Cash Out settles automatically at your chosen multiplier.
            </li>
          </ol>
        </DarkSheet>
      ) : null}
      {sheet === "fair" ? (
        <DarkSheet title="Provably fair" onClose={() => setSheet(null)}>
          <p className="text-[12.5px] leading-relaxed text-white/65">Each round result is generated from a server seed that is fixed before the round starts. After the round you can verify the previous seed against its result.</p>
          <p className="mt-4 text-[11px] uppercase tracking-wide text-white/45">Next round seed (hashed)</p>
          <p className="mt-1 break-all rounded-xl bg-[#141516] p-3 font-mono text-[12px]">{seed.current}</p>
          {seed.prev ? (
            <>
              <p className="mt-4 text-[11px] uppercase tracking-wide text-white/45">Previous round</p>
              <p className="mt-1 break-all rounded-xl bg-[#141516] p-3 font-mono text-[12px]">
                {seed.prev.seed}
                <br />
                <span className={multColor(seed.prev.crash)}>Result {seed.prev.crash.toFixed(2)}x</span>
              </p>
            </>
          ) : null}
        </DarkSheet>
      ) : null}

      {confirmExit ? (
        <div className="absolute inset-0 z-[95] grid place-items-center bg-black/70 p-6">
          <div className="animate-pop w-full rounded-3xl bg-[#1b1c1d] p-5 text-center">
            <p className="text-[16px] font-bold">You have an active bet</p>
            <p className="mt-1.5 text-[12.5px] text-white/60">Leaving now will cash out your active bet{activeCount > 1 ? "s" : ""} at {mult.toFixed(2)}x.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmExit(false)} className="rounded-2xl bg-[#2c2d30] py-3 text-[14px]">
                Stay
              </button>
              <button
                onClick={() => {
                  panels.current.forEach((_, i) => cashOut(i));
                  onExit();
                }}
                className="rounded-2xl bg-[#d07206] py-3 text-[14px] font-bold"
              >
                Cash out & leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BetsTable({ rows, settled }: { rows: Player[]; settled?: boolean }) {
  return (
    <div className="mt-2">
      <div className="grid grid-cols-[1fr_70px_56px_80px] px-2.5 py-1.5 text-[11px] text-white/40">
        <span>User</span>
        <span className="text-right">Bet {cur()}</span>
        <span className="text-center">X</span>
        <span className="text-right">Cash out {cur()}</span>
      </div>
      <div className="space-y-1">
        {rows.slice(0, 40).map((r) => (
          <div
            key={r.id}
            className={cn(
              "grid grid-cols-[1fr_70px_56px_80px] items-center rounded-full px-1.5 py-1 text-[12.5px]",
              r.cashed ? "border border-[#427f00] bg-[#123405]" : "border border-transparent bg-[#101011]",
              r.me && !r.cashed && "border-[#f5a623]/60",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar i={r.av} size={26} me={r.me} label={r.me ? r.name.slice(0, 1) : ""} />
              <span className={cn("truncate", r.me ? "font-bold text-[#f5c86a]" : "text-white/70")}>{r.me ? "You" : r.name}</span>
            </span>
            <span className="text-right tabular-nums text-white/85">{money(r.bet)}</span>
            <span className="text-center">{r.cashed ? <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold", multBg(r.cashed))}>{r.cashed.toFixed(2)}x</span> : null}</span>
            <span className="pr-1.5 text-right font-semibold tabular-nums">{r.cashed ? money(r.bet * r.cashed) : settled ? <span className="text-white/25">—</span> : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
