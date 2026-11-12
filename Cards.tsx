import { useEffect, useRef, useState } from "react";
import { money, parseAmount, round2 } from "../lib/format";
import { cn } from "../utils/cn";
import { ActionButton, StakeInput, placeStake, type EngineProps } from "./common";

/* ------------------------------------------------------------------ */
/* Blackjack                                                            */
/* ------------------------------------------------------------------ */

type Card = { rank: string; suit: string; value: number; red: boolean };
const SUITS = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♦", red: true },
  { symbol: "♣", red: false },
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit: suit.symbol, value: rank === "A" ? 11 : ["J", "Q", "K"].includes(rank) ? 10 : Number(rank), red: suit.red });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
const total = (cards: Card[]) => {
  let sum = cards.reduce((a, c) => a + c.value, 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return sum;
};

function PlayingCard({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <div className="grid h-24 w-[68px] place-items-center rounded-lg bg-[repeating-linear-gradient(45deg,#1e3a8a_0_6px,#1d4ed8_6px_12px)] text-[22px] font-black text-white/40 shadow-md ring-1 ring-white/20">?</div>;
  return (
    <div className={cn("flex h-24 w-[68px] flex-col rounded-lg bg-white p-1.5 shadow-md", card.red ? "text-red-600" : "text-slate-900")}>
      <span className="text-[16px] font-black leading-none">{card.rank}</span>
      <span className="text-[20px] leading-none">{card.suit}</span>
      <span className="mt-auto self-end text-[22px] leading-none">{card.suit}</span>
    </div>
  );
}

type BjPhase = "idle" | "player" | "dealer" | "done";

export function BlackjackClassic({ wallet }: EngineProps) {
  const [stake, setStake] = useState("5");
  const [deck, setDeck] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [phase, setPhase] = useState<BjPhase>("idle");
  const [bet, setBet] = useState(0);
  const [message, setMessage] = useState("Place your bet to deal");
  const [doubled, setDoubled] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const draw = (d: Card[]) => d.pop()!;

  const start = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    const d = freshDeck();
    const p = [d.pop()!, d.pop()!];
    const dl = [d.pop()!, d.pop()!];
    setDeck(d);
    setPlayer(p);
    setDealer(dl);
    setBet(amount);
    setDoubled(false);
    setPhase("player");
    const pBJ = total(p) === 21;
    const dBJ = total(dl) === 21;
    if (pBJ || dBJ) {
      setPhase("done");
      if (pBJ && dBJ) {
        wallet.credit(amount, "Blackjack push");
        setMessage("Both blackjack – push, stake returned");
      } else if (pBJ) {
        wallet.credit(round2(amount * 2.5), "Blackjack pays 3:2");
        setMessage(`Blackjack! You win ${money(amount * 2.5)}`);
      } else setMessage("Dealer has blackjack – you lose");
    } else setMessage("Hit, stand or double down");
  };

  const settle = (finalPlayer: Card[], currentDeck: Card[], currentBet: number) => {
    const d = [...currentDeck];
    let dl = [...dealer];
    while (total(dl) < 17 && d.length) dl = [...dl, draw(d)];
    setDealer(dl);
    setDeck(d);
    setPhase("done");
    const pTotal = total(finalPlayer);
    const dTotal = total(dl);
    if (pTotal > 21) setMessage(`You bust with ${pTotal} – you lose`);
    else if (dTotal > 21) {
      wallet.credit(round2(currentBet * 2), "Dealer bust");
      setMessage(`Dealer busts with ${dTotal} – you win ${money(currentBet * 2)}`);
    } else if (pTotal > dTotal) {
      wallet.credit(round2(currentBet * 2), "Blackjack win");
      setMessage(`${pTotal} vs ${dTotal} – you win ${money(currentBet * 2)}`);
    } else if (pTotal < dTotal) setMessage(`${pTotal} vs ${dTotal} – dealer wins`);
    else {
      wallet.credit(currentBet, "Blackjack push");
      setMessage(`${pTotal} vs ${dTotal} – push, stake returned`);
    }
  };

  const hit = () => {
    if (phase !== "player" || !deck.length) return;
    const d = [...deck];
    const p = [...player, draw(d)];
    setDeck(d);
    setPlayer(p);
    if (total(p) > 21) {
      setPhase("done");
      setMessage(`You bust with ${total(p)} – you lose`);
    } else if (total(p) === 21) settle(p, d, bet);
    else setMessage("Hit again or stand");
  };

  const stand = () => {
    if (phase !== "player") return;
    setPhase("dealer");
    setMessage("Dealer is drawing…");
    const id = window.setTimeout(() => settle(player, deck, bet), 650);
    timers.current.push(id);
  };

  const double = () => {
    if (phase !== "player" || player.length !== 2) return;
    if (!wallet.debit(bet)) return wallet.fail(wallet.demo ? "Not enough demo balance to double" : "Insufficient balance to double down");
    const d = [...deck];
    const p = [...player, draw(d)];
    setBet(bet * 2);
    setDoubled(true);
    setDeck(d);
    setPlayer(p);
    setPhase("dealer");
    setMessage("Double down – dealer is drawing…");
    const id = window.setTimeout(() => settle(p, d, bet * 2), 650);
    timers.current.push(id);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[radial-gradient(ellipse_at_center,#065f46,#022c22)] p-3 ring-1 ring-emerald-300/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/55">Dealer {phase === "player" ? "(one card hidden)" : `· ${total(dealer)}`}</p>
            <div className="mt-2 flex gap-2">
              {dealer.map((c, i) => <PlayingCard key={i} card={c} hidden={phase === "player" && i === 1} />)}
            </div>
          </div>
          <div className="rounded-xl bg-black/25 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase text-white/45">Bet</p>
            <p className="text-[16px] font-black text-amber-300">{money(bet)}</p>
          </div>
        </div>
        <div className="my-3 h-px bg-white/10" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/55">You · {total(player)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {player.map((c, i) => <PlayingCard key={i} card={c} />)}
        </div>
        <p className={cn("mt-3 text-center text-[13px] font-black", phase === "done" ? "text-amber-200" : "text-white/70")}>{message}</p>
      </div>

      {phase === "player" ? (
        <div className="grid grid-cols-3 gap-2">
          <ActionButton onClick={hit}>Hit</ActionButton>
          <ActionButton tone="gray" onClick={stand}>Stand</ActionButton>
          <ActionButton tone="orange" onClick={double} disabled={player.length !== 2}>Double</ActionButton>
        </div>
      ) : null}
      {phase === "dealer" ? <p className="text-center text-[12px] font-bold text-white/60">Dealer stands on 17</p> : null}
      {phase === "done" || phase === "idle" ? (
        <>
          <StakeInput value={stake} onChange={setStake} />
          <ActionButton onClick={start}>{phase === "done" ? "Deal again" : "Deal cards"} · {money(parseAmount(stake))}</ActionButton>
        </>
      ) : null}
      {doubled ? <p className="text-center text-[11px] font-bold text-amber-300">Doubled down</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini roulette                                                        */
/* ------------------------------------------------------------------ */

const RED = new Set([1, 3, 5, 7, 9, 11]);
const NUMBERS = Array.from({ length: 13 }, (_, i) => i);
type BetType = "red" | "black" | "odd" | "even" | "low" | "high" | "number" | "zero";

export function MiniRoulette({ wallet }: EngineProps) {
  const [stake, setStake] = useState("2");
  const [betType, setBetType] = useState<BetType>("red");
  const [number, setNumber] = useState(7);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState("Choose a bet and spin the wheel");
  const [history, setHistory] = useState<number[]>([]);
  const [rotation, setRotation] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = () => {
    const amount = placeStake(wallet, stake);
    if (!amount) return;
    setSpinning(true);
    setResult(null);
    setMessage("Wheel spinning…");
    const n = Math.floor(Math.random() * 13);
    setRotation((r) => r + 360 * 6 + n * (360 / 13));
    timer.current = window.setTimeout(() => {
      let payout = 0;
      if (betType === "red" && RED.has(n)) payout = amount * 2;
      else if (betType === "black" && n !== 0 && !RED.has(n)) payout = amount * 2;
      else if (betType === "odd" && n % 2 === 1) payout = amount * 2;
      else if (betType === "even" && n !== 0 && n % 2 === 0) payout = amount * 2;
      else if (betType === "low" && n >= 1 && n <= 6) payout = amount * 2;
      else if (betType === "high" && n >= 7 && n <= 12) payout = amount * 2;
      else if (betType === "number" && n === number) payout = amount * 12;
      else if (betType === "zero" && n === 0) payout = amount * 14;
      payout = round2(payout);
      if (payout > 0) wallet.credit(payout, "Mini Roulette win");
      setResult(n);
      setHistory((h) => [n, ...h].slice(0, 8));
      setMessage(payout > 0 ? `${n} – you win ${money(payout)}` : `${n} – no win this spin`);
      setSpinning(false);
    }, 1900);
  };

  const options: { key: BetType; label: string; pays: string }[] = [
    { key: "red", label: "Red", pays: "2×" },
    { key: "black", label: "Black", pays: "2×" },
    { key: "odd", label: "Odd", pays: "2×" },
    { key: "even", label: "Even", pays: "2×" },
    { key: "low", label: "1–6", pays: "2×" },
    { key: "high", label: "7–12", pays: "2×" },
    { key: "zero", label: "Zero", pays: "14×" },
    { key: "number", label: `Number ${number}`, pays: "12×" },
  ];

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-[270px]">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-amber-300" />
        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)]" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 1.8s cubic-bezier(0.12,0.8,0.18,1)" : "none" }}>
          <circle cx="50" cy="50" r="49" fill="#064e3b" stroke="#fbbf24" strokeWidth="1.5" />
          {NUMBERS.map((n, i) => {
            const a = (i * 360) / 13 - 90;
            const a2 = ((i + 1) * 360) / 13 - 90;
            const r = 46;
            const x1 = 50 + r * Math.cos((a * Math.PI) / 180), y1 = 50 + r * Math.sin((a * Math.PI) / 180);
            const x2 = 50 + r * Math.cos((a2 * Math.PI) / 180), y2 = 50 + r * Math.sin((a2 * Math.PI) / 180);
            const mid = ((a + a2) / 2) * (Math.PI / 180);
            const tx = 50 + 37 * Math.cos(mid), ty = 50 + 37 * Math.sin(mid);
            return (
              <g key={n}>
                <path d={`M50,50 L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`} fill={n === 0 ? "#16a34a" : RED.has(n) ? "#dc2626" : "#111827"} stroke="#fbbf24" strokeWidth="0.25" />
                <text x={tx} y={ty + 2} textAnchor="middle" fontSize="6" fontWeight="900" fill="#fff" transform={`rotate(${mid * (180 / Math.PI) + 90} ${tx} ${ty})`}>{n}</text>
              </g>
            );
          })}
          <circle cx="50" cy="50" r="12" fill="#022c22" stroke="#fbbf24" strokeWidth="1.5" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#022c22] text-[22px] font-black text-amber-300 ring-2 ring-amber-300">{result ?? "—"}</div>
        </div>
      </div>
      <p className="text-center text-[13px] font-bold text-white/65">{message}</p>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {history.map((n, i) => <span key={i} className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black text-white", n === 0 ? "bg-emerald-600" : RED.has(n) ? "bg-red-600" : "bg-slate-800")}>{n}</span>)}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((o) => (
          <button key={o.key} onClick={() => setBetType(o.key)} disabled={spinning} className={cn("rounded-xl px-1 py-2 text-[11px] font-black transition", betType === o.key ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white")}>
            {o.label}<span className="block text-[9px] opacity-70">{o.pays}</span>
          </button>
        ))}
      </div>
      {betType === "number" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {NUMBERS.filter((n) => n > 0).map((n) => <button key={n} onClick={() => setNumber(n)} className={cn("grid h-8 place-items-center rounded-lg text-[12px] font-black", number === n ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white")}>{n}</button>)}
        </div>
      ) : null}
      <StakeInput value={stake} onChange={setStake} disabled={spinning} />
      <ActionButton onClick={play} disabled={spinning}>{spinning ? "Spinning…" : `Spin · ${money(parseAmount(stake))}`}</ActionButton>
    </div>
  );
}
