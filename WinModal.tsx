import { useEffect, useMemo } from "react";
import { cur, scale } from "../lib/currency";
import { money } from "../lib/format";
import { useStore, type Bet } from "../store";
import { CloseIcon, ShareIcon } from "./Icons";

/* ------------------------------------------------------------------ */
/* gold trophy                                                         */
/* ------------------------------------------------------------------ */
function Trophy() {
  return (
    <svg viewBox="0 0 200 190" className="h-full w-full drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="0.28" stopColor="#ffe066" />
          <stop offset="0.6" stopColor="#f5b301" />
          <stop offset="1" stopColor="#b07d00" />
        </linearGradient>
        <linearGradient id="goldDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d99e00" />
          <stop offset="1" stopColor="#8a6100" />
        </linearGradient>
        <linearGradient id="silver" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
          <stop offset="0" stopColor="#ffe066" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffe066" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* glow */}
      <circle cx="100" cy="72" r="96" fill="url(#glow)" />

      {/* handles */}
      <path d="M40 46c-16 0-28 12-28 28s12 28 28 28" fill="none" stroke="url(#goldDark)" strokeWidth="11" strokeLinecap="round" />
      <path d="M160 46c16 0 28 12 28 28s-12 28-28 28" fill="none" stroke="url(#goldDark)" strokeWidth="11" strokeLinecap="round" />

      {/* cup */}
      <path d="M52 30h96l-8 62c-2.5 22-13 34-40 34s-37.5-12-40-34z" fill="url(#gold)" />
      {/* cup shading */}
      <path d="M52 30h96l-8 62c-1 9-3 16-6 22H62c-3-6-5-13-6-22z" fill="#fff" opacity="0.18" />
      {/* star */}
      <path d="M100 46l9.5 19.6 21.5 3.1-15.6 15.2 3.7 21.4L100 96.5l-19.1 10.1 3.7-21.4-15.6-15.2 21.5-3.1z" fill="#fff8dc" stroke="#b07d00" strokeWidth="1.6" strokeLinejoin="round" />
      {/* rim */}
      <rect x="46" y="22" width="108" height="16" rx="7" fill="url(#gold)" />
      <rect x="46" y="22" width="108" height="7" rx="3.5" fill="#fff" opacity="0.35" />
      {/* stem */}
      <path d="M88 122h24v18H88z" fill="url(#gold)" />
      {/* base */}
      <ellipse cx="100" cy="144" rx="46" ry="9" fill="url(#silver)" />
      <path d="M56 140h88l6 14H50z" fill="url(#silver)" />
      <ellipse cx="100" cy="154" rx="44" ry="8" fill="url(#silver)" />
      <ellipse cx="100" cy="152" rx="44" ry="8" fill="#e2e8f0" opacity="0.55" />
      <ellipse cx="100" cy="140" rx="30" ry="6" fill="#94a3b8" opacity="0.45" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* confetti                                                            */
/* ------------------------------------------------------------------ */
const CONFETTI = ["#ffe066", "#ff6b6b", "#4ade80", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa", "#f87171"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 1.9 + Math.random() * 1.9,
        color: CONFETTI[i % CONFETTI.length],
        size: 5 + Math.random() * 7,
        rotate: Math.random() * 360,
        round: Math.random() > 0.5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-8%] block animate-none"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.7,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confettiFall ${p.duration}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(520px) rotate(540deg); opacity: 0; } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* win modal                                                           */
/* ------------------------------------------------------------------ */
export function WinModal({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const { go, setSlip, setSlipOpen } = useStore();
  const amount = bet.payout ?? bet.potentialWin;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const details = () => {
    onClose();
    go({ name: "mybets" });
  };

  const share = () => {
    setSlip(bet.legs.map((l) => l.key));
    setSlipOpen(true);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[96] flex flex-col justify-end bg-black/55 backdrop-blur-[2px]">
      <Confetti />
      <div className="relative mx-auto w-full max-w-[560px] px-6 pb-8 pt-4">
        {/* trophy */}
        <div className="animate-pop mx-auto h-[168px] w-[168px]">
          <Trophy />
        </div>

        {/* you won */}
        <div className="animate-pop mt-1 text-center" style={{ animationDelay: "80ms" }}>
          <p className="text-[34px] font-black uppercase leading-none tracking-tight text-brand-yellow drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">You won</p>
          <p className="mt-2 text-[40px] font-black leading-none tracking-tight text-white tabular-nums drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            {cur()} {money(amount * scale())}
          </p>
        </div>

        {/* buttons */}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button onClick={details} className="rounded-full border-2 border-white/40 bg-white/10 py-3 text-[16px] font-black text-white backdrop-blur-sm transition active:scale-95">
            Details
          </button>
          <button onClick={share} className="flex items-center justify-center gap-2 rounded-full bg-brand-green py-3 text-[16px] font-black text-white shadow-[0_10px_22px_-10px_rgba(23,163,74,0.9)] transition active:scale-95">
            <ShareIcon className="h-[18px] w-[18px]" strokeWidth={2.4} />
            Share
          </button>
        </div>

        <button onClick={onClose} aria-label="Close" className="mx-auto mt-6 grid h-11 w-11 place-items-center rounded-full border border-white/35 text-white/85 active:scale-90">
          <CloseIcon className="h-5 w-5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
