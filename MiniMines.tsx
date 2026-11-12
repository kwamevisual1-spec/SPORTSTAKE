import { useEffect, useRef, useState, type ReactNode } from "react";
import { money } from "../lib/format";
import { num, sc, sym } from "../lib/currency";
import { cn } from "../utils/cn";
import { Bomb, GoldStar } from "./art";
import { sfx, useSound } from "./sfx";
import type { FullGameProps } from "./common";

const RTP = 0.97;
const BASE_STAKES = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const stakes = () => BASE_STAKES.map(sc);
const MAX_MINES = 14;

export function minesMultiplier(mines: number, picks: number, tiles = 15) {
  if (picks <= 0) return 1;
  let m = 1;
  for (let i = 0; i < picks; i++) m *= (tiles - i) / (tiles - mines - i);
  return Math.floor(m * RTP * 100) / 100;
}

type Phase = "idle" | "playing" | "busted" | "cashed";
type Round = { id: string; at: number; mines: number; stake: number; picks: number; mult: number; win: number };

function CircleBtn({ children, onClick, disabled, label, active }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid aspect-square w-full place-items-center rounded-full border-2 text-white transition active:scale-95 disabled:opacity-30",
        active ? "border-[#2be13a] bg-[#2be13a]/15 text-[#2be13a]" : "border-white/70",
      )}
    >
      {children}
    </button>
  );
}

function Stepper({ label, value, onMinus, onPlus, disabled }: { label: string; value: string; onMinus: () => void; onPlus: () => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between rounded-full border-2 border-white/40 p-1", disabled && "opacity-45")}>
      <button aria-label={`Decrease ${label}`} disabled={disabled} onClick={onMinus} className="grid h-10 w-10 place-items-center rounded-full border-2 border-white/70 text-[20px] leading-none text-white active:scale-95">
        −
      </button>
      <div className="text-center leading-tight">
        <p className="text-[11px] font-bold tracking-wide text-white">{label}</p>
        <p className={cn("font-extrabold tabular-nums text-white", value.length > 7 ? "text-[13px]" : "text-[16px]")}>{value}</p>
      </div>
      <button aria-label={`Increase ${label}`} disabled={disabled} onClick={onPlus} className="grid h-10 w-10 place-items-center rounded-full border-2 border-white/70 text-[20px] leading-none text-white active:scale-95">
        +
      </button>
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[90] flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[82%] flex-col rounded-t-3xl bg-[#241433] text-white ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-[15px] font-extrabold uppercase tracking-wide">{title}</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            ✕
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function MiniMines({ game, wallet, setMode, onExit, onDeposit }: FullGameProps) {
  const TILES = game.variant === "xl" ? 25 : 15;
  const [sound, setSound] = useSound();
  const [mines, setMines] = useState(3);
  const [stakeIdx, setStakeIdx] = useState(4);
  const [phase, setPhase] = useState<Phase>("idle");
  const [bombs, setBombs] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hit, setHit] = useState<number | null>(null);
  const [bet, setBet] = useState(0);
  const [win, setWin] = useState(0);
  const [last, setLast] = useState<{ mines: number; stakeIdx: number } | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [panel, setPanel] = useState<null | "info" | "history" | "auto">(null);
  const [auto, setAuto] = useState<{ running: boolean; rounds: number; tiles: number; left: number }>({ running: false, rounds: 10, tiles: 2, left: 0 });
  const [shake, setShake] = useState(0);

  const stake = stakes()[stakeIdx];
  const playing = phase === "playing";
  const picks = revealed.length;
  const maxPicks = TILES - mines;
  const curMult = minesMultiplier(mines, picks, TILES);
  const nextMult = minesMultiplier(mines, Math.min(maxPicks, picks + 1));
  const nextPayout = (playing ? bet : stake) * nextMult;
  const cashValue = Math.round(bet * curMult * 100) / 100;

  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const stateRef = useRef({ phase, revealed, bombs, bet, mines });
  stateRef.current = { phase, revealed, bombs, bet, mines };

  const start = (m = mines, sIdx = stakeIdx) => {
    const amount = stakes()[sIdx];
    if (!walletRef.current.debit(amount)) {
      walletRef.current.fail(walletRef.current.demo ? "Not enough demo balance – reset it in the info panel" : "Insufficient balance – please deposit");
      setAuto((a) => ({ ...a, running: false }));
      return false;
    }
    const b = new Set<number>();
    while (b.size < m) b.add(Math.floor(Math.random() * TILES));
    setBombs(b);
    setRevealed([]);
    setHit(null);
    setBet(amount);
    setWin(0);
    setLast({ mines: m, stakeIdx: sIdx });
    setPhase("playing");
    sfx.click();
    return true;
  };

  const finish = (result: "busted" | "cashed", pickCount: number, value: number) => {
    const s = stateRef.current;
    setRounds((r) => [{ id: Math.random().toString(36).slice(2), at: Date.now(), mines: s.mines, stake: s.bet, picks: pickCount, mult: result === "cashed" ? minesMultiplier(s.mines, pickCount, TILES) : 0, win: value }, ...r].slice(0, 50));
    setPhase(result);
  };

  const cashOut = (pickCount = stateRef.current.revealed.length) => {
    const s = stateRef.current;
    if (s.phase !== "playing" || pickCount === 0) return;
    const value = Math.round(s.bet * minesMultiplier(s.mines, pickCount, TILES) * 100) / 100;
    walletRef.current.credit(value, "Mini Mines win");
    setWin(value);
    sfx.win();
    finish("cashed", pickCount, value);
  };

  const pick = (i: number) => {
    const s = stateRef.current;
    if (s.phase !== "playing" || s.revealed.includes(i)) return;
    if (s.bombs.has(i)) {
      setHit(i);
      setShake((k) => k + 1);
      sfx.boom();
      finish("busted", s.revealed.length, 0);
      return;
    }
    const next = [...s.revealed, i];
    setRevealed(next);
    setWin(Math.round(s.bet * minesMultiplier(s.mines, next.length, TILES) * 100) / 100);
    sfx.gem();
    if (next.length === TILES - s.mines) {
      stateRef.current = { ...s, revealed: next };
      cashOut(next.length);
    }
  };

  /* ---------------- autoplay ---------------- */
  useEffect(() => {
    if (!auto.running) return;
    const t = window.setTimeout(
      () => {
        const s = stateRef.current;
        if (s.phase !== "playing") {
          if (auto.left <= 0) {
            setAuto((a) => ({ ...a, running: false }));
            return;
          }
          if (start(mines, stakeIdx)) setAuto((a) => ({ ...a, left: a.left - 1 }));
          return;
        }
        const target = Math.min(auto.tiles, TILES - s.mines);
        if (s.revealed.length >= target) {
          cashOut();
          return;
        }
        const options = Array.from({ length: TILES }, (_, i) => i).filter((i) => !s.revealed.includes(i));
        pick(options[Math.floor(Math.random() * options.length)]);
      },
      stateRef.current.phase === "playing" ? 420 : 900,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, revealed]);

  const over = phase === "busted" || phase === "cashed";

  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-[#111413] text-white">
      {/* top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button
          onClick={() => {
            if (playing) return wallet.fail("Cash out or finish the round before leaving");
            onExit();
          }}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center text-[30px] font-light leading-none text-white"
        >
          ‹
        </button>
        <button onClick={onDeposit} className="rounded-full bg-[#2be13a] px-5 py-2 text-[16px] font-black text-[#0b2a10] shadow-[0_6px_16px_-6px_rgba(43,225,58,0.8)] active:scale-95">
          Deposit
        </button>
      </div>

      <div className={cn("relative flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[#242424] via-[#2e1a3d] to-[#481a6e]", shake ? "" : "")}>
        {/* title & stats */}
        <div className="px-3 pt-1.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-white/80">{game.name}</p>
              <p className="text-[30px] leading-tight text-white/60">{game.name}</p>
              <div className="h-[2px] w-[210px] bg-gradient-to-r from-white/30 to-transparent" />
            </div>
            <div className="mt-2 flex items-center gap-4">
              <button onClick={() => setSound(!sound)} aria-label={sound ? "Mute" : "Unmute"} className="text-white/80">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
                  {sound ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" /> : <path d="M16 10l4 4M20 10l-4 4" strokeLinecap="round" />}
                </svg>
              </button>
              <button onClick={() => setPanel("info")} aria-label="Game info" className="grid h-7 w-7 place-items-center rounded-full border-[1.6px] border-white/80 text-[15px] font-semibold text-white/80">
                i
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 text-[16px]">
            <p>
              Balance({sym()}): <span className="text-[#f5a623] tabular-nums">{money(wallet.balance)}</span>
              {wallet.demo ? <span className="ml-1.5 rounded bg-[#f5a623]/20 px-1 py-0.5 align-middle text-[9px] font-bold text-[#f5a623]">DEMO</span> : null}
            </p>
            <div>
              <p>
                Bet({sym()}): <span className="text-[#f5a623] tabular-nums">{money(playing || over ? bet : 0)}</span>
              </p>
              <p>
                Win({sym()}): <span className="text-[#f5a623] tabular-nums">{money(win)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* message area */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          {phase === "cashed" ? (
            <div key={`w${rounds.length}`} className="animate-pop text-center">
              <p className="text-[15px] font-extrabold uppercase tracking-[0.25em] text-[#f5a623]">You win</p>
              <p className="text-[44px] font-black tabular-nums text-[#ffd34d] drop-shadow-[0_4px_20px_rgba(255,211,77,0.45)]">{sym()} {money(win)}</p>
              <p className="text-[14px] font-bold text-white/70">{minesMultiplier(mines, picks, TILES).toFixed(2)}x</p>
            </div>
          ) : phase === "busted" ? (
            <div key={`b${rounds.length}`} className="animate-pop text-center">
              <Bomb className="mx-auto h-20 w-20" />
              <p className="mt-1 text-[30px] font-black uppercase text-[#ff4d6a]">Boom!</p>
              <p className="text-[13px] font-semibold text-white/60">Press PLAY to try again</p>
            </div>
          ) : playing && picks === 0 ? (
            <p className="text-center text-[14px] font-bold uppercase tracking-wider text-white/45">Pick a tile</p>
          ) : null}
        </div>

        {/* board + controls */}
        <div className="flex gap-2.5 px-2.5 pb-4">
          <div className="min-w-0 flex-[1.85]">
            <p className="text-center text-[15px] font-extrabold tracking-wide text-[#f5a623]">NEXT PAYOUT {money(picks >= maxPicks ? cashValue : nextPayout)}</p>
            <div className="mt-1 h-[7px] overflow-hidden rounded-full border border-[#6b3a8c] bg-[#2a1238]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#f5a623] to-[#ffd34d] transition-all duration-300" style={{ width: `${(picks / maxPicks) * 100}%` }} />
            </div>
            <div key={shake} className={cn("mt-2.5 grid grid-cols-5 gap-1.5", shake ? "animate-shake" : "")}>
              {Array.from({ length: TILES }, (_, i) => {
                const isBomb = bombs.has(i);
                const isOpen = revealed.includes(i);
                const show = isOpen || over;
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={!playing || isOpen}
                    aria-label={`Tile ${i + 1}`}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-[10px] border-2 transition",
                      !show && "border-[#2c1340] bg-gradient-to-b from-[#6a3a8e] to-[#4e2669] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-3px_0_rgba(0,0,0,0.3)]",
                      !show && playing && "hover:from-[#7d47a6] active:scale-95",
                      isOpen && "border-[#f5a623]/70 bg-gradient-to-b from-[#7b4aa0] to-[#5a2d7a] shadow-[0_0_16px_rgba(245,166,35,0.45)]",
                      over && !isOpen && isBomb && (hit === i ? "border-[#ff4d6a] bg-[#7a1030]" : "border-[#2c1340] bg-[#3a1a50]"),
                      over && !isOpen && !isBomb && "border-[#2c1340] bg-[#3a1a50]",
                    )}
                  >
                    {isOpen ? (
                      <GoldStar className="animate-tile h-[62%] w-[62%] drop-shadow-[0_0_8px_rgba(255,201,40,0.8)]" />
                    ) : over ? (
                      isBomb ? (
                        <Bomb className={cn("h-[70%] w-[70%]", hit === i ? "animate-tile" : "opacity-70")} />
                      ) : (
                        <GoldStar className="h-[50%] w-[50%] opacity-30" />
                      )
                    ) : (
                      <GoldStar dim className="h-[48%] w-[48%]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-end gap-2">
            <div className="grid grid-cols-3 gap-1.5">
              <CircleBtn label="Repeat last bet" disabled={!last || playing || auto.running} onClick={() => last && (setMines(last.mines), setStakeIdx(last.stakeIdx), start(last.mines, last.stakeIdx))}>
                <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 7L5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2" />
                </svg>
              </CircleBtn>
              <CircleBtn label="Round history" onClick={() => setPanel("history")}>
                <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
              </CircleBtn>
              <CircleBtn label="Autoplay" active={auto.running} onClick={() => (auto.running ? setAuto((a) => ({ ...a, running: false })) : setPanel("auto"))}>
                <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11a8 8 0 0 1 14-4.5M20 13a8 8 0 0 1-14 4.5M18 3v4h-4M6 21v-4h4" />
                  <path d="M10 9l5 3-5 3z" />
                </svg>
              </CircleBtn>
            </div>
            <Stepper label="MINES" value={String(mines)} disabled={playing || auto.running} onMinus={() => setMines((m) => Math.max(1, m - 1))} onPlus={() => setMines((m) => Math.min(MAX_MINES, m + 1))} />
            <Stepper label={sym()} value={money(stake)} disabled={playing || auto.running} onMinus={() => setStakeIdx((i) => Math.max(0, i - 1))} onPlus={() => setStakeIdx((i) => Math.min(stakes().length - 1, i + 1))} />
            {auto.running ? (
              <button onClick={() => setAuto((a) => ({ ...a, running: false }))} className="rounded-full border-2 border-[#ff7d8e] bg-gradient-to-b from-[#e11d48] to-[#9f1239] py-3 text-[17px] font-black">
                STOP AUTO ({auto.left})
              </button>
            ) : playing ? (
              <button
                onClick={() => cashOut()}
                disabled={picks === 0}
                className="rounded-full border-2 border-[#ffd38a] bg-gradient-to-b from-[#ffb020] to-[#d97706] py-2 text-center leading-tight disabled:opacity-50"
              >
                <span className="block text-[15px] font-black">CASH OUT</span>
                <span className="block text-[13px] font-bold tabular-nums">{sym()} {money(cashValue)}</span>
              </button>
            ) : (
              <button onClick={() => start()} className="rounded-full border-2 border-[#2be13a] bg-gradient-to-b from-[#1fb52c] to-[#077a12] py-3 text-[22px] font-black tracking-wide shadow-[0_8px_20px_-8px_rgba(43,225,58,0.8)] active:scale-[0.98]">
                PLAY
              </button>
            )}
          </div>
        </div>
      </div>

      {panel === "info" ? (
        <Panel title="How to play" onClose={() => setPanel(null)}>
          <p className="text-[13px] leading-relaxed text-white/75">
            Choose how many mines are hidden (1–{MAX_MINES}) and your stake, then press PLAY. Open tiles one by one – every star raises your payout. Hit a mine and the round is lost. Press CASH OUT at any time to collect.
          </p>
          <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-white/50">Payouts with {mines} mine{mines === 1 ? "" : "s"}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {Array.from({ length: maxPicks }, (_, i) => (
              <div key={i} className={cn("rounded-lg bg-white/[0.06] px-2 py-1.5 text-center", i + 1 === picks + 1 && playing && "ring-1 ring-[#f5a623]")}>
                <p className="text-[10px] text-white/50">{i + 1} star{i ? "s" : ""}</p>
                <p className="text-[13px] font-bold text-[#f5a623]">{minesMultiplier(mines, i + 1, TILES).toFixed(2)}x</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-white/50">Return to player {Math.round(RTP * 100)}% · Min stake {sym()} {money(stakes()[0])} · Max stake {sym()} {money(stakes()[stakes().length - 1])}</p>
          <div className="mt-4 flex gap-2">
            {(["demo", "real"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (playing || auto.running) return wallet.fail("Finish the current round first");
                  setPanel(null);
                  setMode(m);
                }}
                className={cn("flex-1 rounded-full py-2.5 text-[13px] font-bold", (m === "demo") === wallet.demo ? "bg-[#2be13a] text-[#0b2a10]" : "bg-white/10")}
              >
                {m === "demo" ? "Demo mode" : "Real money"}
              </button>
            ))}
          </div>
          {wallet.demo ? (
            <button onClick={() => wallet.credit(Math.max(0, 1000 - wallet.balance), "reset")} className="mt-2 w-full rounded-full bg-white/10 py-2.5 text-[13px] font-bold">
              Reset demo balance to {sym()} {num(sc(1000))}
            </button>
          ) : null}
        </Panel>
      ) : null}

      {panel === "history" ? (
        <Panel title="Round history" onClose={() => setPanel(null)}>
          {rounds.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-white/50">No rounds played yet.</p>
          ) : (
            <div className="space-y-1.5">
              {rounds.map((r) => (
                <div key={r.id} className={cn("grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl px-3 py-2 text-[12.5px]", r.win ? "bg-[#2be13a]/10 ring-1 ring-[#2be13a]/40" : "bg-white/[0.05]")}>
                  <span className="text-white/55">{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>
                    {r.mines} mines · {r.picks} stars
                  </span>
                  <span className="tabular-nums">{money(r.stake)}</span>
                  <span className={cn("font-bold tabular-nums", r.win ? "text-[#2be13a]" : "text-white/40")}>{r.win ? `+${money(r.win)}` : "lost"}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {panel === "auto" ? (
        <Panel title="Autoplay" onClose={() => setPanel(null)}>
          <p className="text-[12px] font-bold uppercase tracking-wide text-white/50">Number of rounds</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[5, 10, 25, 50].map((n) => (
              <button key={n} onClick={() => setAuto((a) => ({ ...a, rounds: n }))} className={cn("rounded-full py-2 text-[14px] font-bold", auto.rounds === n ? "bg-[#2be13a] text-[#0b2a10]" : "bg-white/10")}>
                {n}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-white/50">Tiles to open each round</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].filter((n) => n <= maxPicks).map((n) => (
              <button key={n} onClick={() => setAuto((a) => ({ ...a, tiles: n }))} className={cn("rounded-full py-2 text-[14px] font-bold", auto.tiles === n ? "bg-[#2be13a] text-[#0b2a10]" : "bg-white/10")}>
                {n}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-white/[0.06] p-3 text-[12.5px] text-white/70">
            {auto.rounds} rounds × {sym()} {money(stake)} with {mines} mines · cashes out at {minesMultiplier(mines, Math.min(auto.tiles, maxPicks)).toFixed(2)}x ({sym()} {money(stake * minesMultiplier(mines, Math.min(auto.tiles, maxPicks)))})
          </div>
          <button
            onClick={() => {
              if (playing) return wallet.fail("Finish the current round first");
              setPanel(null);
              setAuto((a) => ({ ...a, running: true, left: a.rounds }));
            }}
            className="mt-4 w-full rounded-full border-2 border-[#2be13a] bg-gradient-to-b from-[#1fb52c] to-[#077a12] py-3 text-[17px] font-black"
          >
            START AUTOPLAY
          </button>
        </Panel>
      ) : null}
    </div>
  );
}
