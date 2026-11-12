import type { CSSProperties } from "react";
import { cn } from "../utils/cn";

export type PosterTheme =
  | "chicken" | "chicken-ice" | "chicken-gold" | "chicken-vegas"
  | "rocket" | "balloon" | "jet" | "keno" | "limbo" | "hilo" | "coin"
  | "scratch" | "tower" | "plinko" | "cascade" | "blackjack" | "roulette";

const glow = (c: string) => `radial-gradient(circle at 78% 12%, ${c}66, transparent 58%), radial-gradient(circle at 8% 90%, #00000066, transparent 60%)`;

function Chicken({ tone }: { tone: string }) {
  const road = tone === "chicken-ice" ? "#9bd7ff" : tone === "chicken-gold" ? "#ffd34d" : tone === "chicken-vegas" ? "#ff4d8d" : "#f8fafc";
  return (
    <g>
      <rect x="0" y="70" width="120" height="30" fill="#1c2430" opacity=".9" />
      <path d="M0 78h120M0 90h120" stroke={road} strokeWidth="1.4" strokeDasharray="8 8" opacity=".8" />
      <g transform="translate(30 26)">
        <ellipse cx="22" cy="37" rx="18" ry="17" fill="#fff" />
        <circle cx="28" cy="20" r="14" fill="#fff" />
        <path d="M39 19l10 4-10 5z" fill="#ffb020" />
        <path d="M24 7c2-6 7-6 8 0 4-4 8-1 5 4" fill="#ef4444" />
        <circle cx="31" cy="17" r="2.4" fill="#111827" />
        <path d="M7 35c-8 0-11 7-7 11 5 4 12 2 14-3" fill="#f1f5f9" />
        <path d="M16 51v10M30 51v10" stroke="#ffb020" strokeWidth="4" strokeLinecap="round" />
        <path d="M11 61h10M25 61h10" stroke="#ffb020" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 31c7-4 17-2 19 6-6 5-14 4-19-6z" fill="#e5e7eb" />
        <rect x="16" y="11" width="26" height="7" rx="3" fill="#111827" />
        <rect x="17" y="13" width="10" height="6" rx="2" fill="#334155" />
        <rect x="29" y="13" width="10" height="6" rx="2" fill="#334155" />
      </g>
      <g transform="translate(80 34) rotate(8)">
        <rect x="0" y="10" width="30" height="14" rx="5" fill={road} />
        <path d="M5 10l5-7h12l5 7z" fill={road} opacity=".8" />
        <circle cx="7" cy="25" r="4" fill="#111827" /><circle cx="23" cy="25" r="4" fill="#111827" />
        <path d="M0 16h-12" stroke="#fff7ae" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      </g>
    </g>
  );
}

function Rocket({ balloon, jet }: { balloon?: boolean; jet?: boolean }) {
  if (balloon) return (
    <g>
      <path d="M60 8c23 0 34 18 30 34-3 13-16 26-30 42C46 68 33 55 30 42 26 26 37 8 60 8z" fill="url(#balG)" />
      <path d="M60 8c-8 9-10 25-6 39 3 13 5 26 6 37 1-11 3-24 6-37 4-14 2-30-6-39z" fill="#fff" opacity=".28" />
      <path d="M49 76h22l-4 12H53z" fill="#a16207" />
      <path d="M50 76l4-9M70 76l-4-9" stroke="#fef3c7" strokeWidth="1.5" />
      <path d="M20 90c20-10 40 10 60 0s30 4 40 0" stroke="#fff" strokeOpacity=".4" strokeWidth="3" fill="none" />
    </g>
  );
  if (jet) return (
    <g transform="rotate(-18 60 50)">
      <path d="M12 56L108 18 68 62 54 88 48 64z" fill="url(#jetG)" />
      <path d="M48 64l20-46-56 38z" fill="#fff" opacity=".3" />
      <path d="M4 74c22-2 24-16 44-16" stroke="#ffdf00" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
    </g>
  );
  return (
    <g transform="rotate(38 60 50)">
      <path d="M60 6c13 12 18 28 15 44l-15 14-15-14C42 34 47 18 60 6z" fill="url(#rocketG)" />
      <path d="M45 44L32 60l16-2M75 44l13 16-16-2" fill="#f43f5e" />
      <circle cx="60" cy="30" r="7" fill="#bae6fd" stroke="#fff" strokeWidth="2" />
      <path d="M52 62l8 26 8-26z" fill="#fbbf24" />
      <path d="M56 62l4 18 4-18z" fill="#fff7ae" />
    </g>
  );
}

function Balls() {
  return <g>{[["1", 24, 28, "#f59e0b"], ["7", 60, 18, "#22c55e"], ["12", 90, 36, "#3b82f6"], ["21", 40, 58, "#e11d48"], ["33", 76, 66, "#a855f7"]].map(([n, x, y, c], i) => <g key={i}><circle cx={x as number} cy={y as number} r="15" fill={c as string} /><circle cx={x as number} cy={y as number} r="15" fill="url(#ballShade)" /><text x={x as number} y={(y as number) + 5} textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">{n}</text></g>)}</g>;
}

function Cards() {
  return <g><g transform="rotate(-14 46 52)"><rect x="24" y="18" width="42" height="60" rx="6" fill="#f8fafc" /><text x="32" y="38" fontSize="18" fontWeight="900" fill="#dc2626">A</text><path d="M44 48l8 10-8 10-8-10z" fill="#dc2626" /></g><g transform="rotate(12 74 52)"><rect x="54" y="18" width="42" height="60" rx="6" fill="#f8fafc" /><text x="62" y="38" fontSize="18" fontWeight="900" fill="#111827">K</text><path d="M74 46c-8-8-16 4 0 16 16-12 8-24 0-16z" fill="#111827" /></g><circle cx="92" cy="76" r="12" fill="#fbbf24" /><circle cx="92" cy="76" r="8" fill="none" stroke="#a16207" strokeWidth="2" strokeDasharray="2 2" /></g>;
}

function Pins() {
  return <g>{Array.from({ length: 5 }, (_, r) => Array.from({ length: r + 3 }, (_, c) => <circle key={`${r}-${c}`} cx={30 + (60 - (r + 2) * 7) + c * 14} cy={26 + r * 12} r="2.8" fill="#e2e8f0" />))}<circle cx="62" cy="12" r="7" fill="url(#ballG2)" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={18 + i * 15} y="80" width="12" height="14" rx="2" fill={["#ef4444", "#f59e0b", "#22c55e", "#f59e0b", "#ef4444", "#64748b"][i]} />)}</g>;
}

function Wheel() {
  return <g><circle cx="60" cy="50" r="38" fill="#111827" stroke="#fbbf24" strokeWidth="4" /><circle cx="60" cy="50" r="30" fill="none" stroke="#f8fafc" strokeWidth="12" strokeDasharray="6 8" /><circle cx="60" cy="50" r="30" fill="none" stroke="#dc2626" strokeWidth="12" strokeDasharray="6 8" strokeDashoffset="7" /><circle cx="60" cy="50" r="12" fill="#fbbf24" /><path d="M60 2l6 14H54z" fill="#f8fafc" /><circle cx="60" cy="50" r="4" fill="#111827" /></g>;
}

function Gems() {
  return <g>{[[30, 24, "#f43f5e"], [60, 14, "#22d3ee"], [90, 28, "#fbbf24"], [46, 54, "#a855f7"], [78, 62, "#34d399"], [26, 74, "#60a5fa"]].map(([x, y, c], i) => <path key={i} d={`M${x} ${(y as number) - 12}l12 12-12 12-12-12z`} fill={c as string} opacity=".95" />)}<path d="M12 90h96" stroke="#fbbf24" strokeWidth="2" opacity=".5" /></g>;
}

function Tiles() {
  return <g>{Array.from({ length: 9 }, (_, i) => <rect key={i} x={22 + (i % 3) * 26} y={16 + Math.floor(i / 3) * 24} width="22" height="20" rx="4" fill={i === 4 ? "#fbbf24" : "#ffffff"} opacity={i === 4 ? 1 : 0.22} />)}<path d="M55 26l4 8 8 1-6 6 2 9-8-5-8 5 2-9-6-6 8-1z" fill="#78350f" /></g>;
}

function Coin() {
  return <g><circle cx="60" cy="48" r="34" fill="url(#coinG)" /><circle cx="60" cy="48" r="27" fill="none" stroke="#a16207" strokeWidth="3" strokeDasharray="3 4" /><text x="60" y="60" textAnchor="middle" fontSize="34" fontWeight="900" fill="#78350f">S</text><path d="M20 84h80" stroke="#fff" strokeOpacity=".2" strokeWidth="3" /></g>;
}

function LimboArt() {
  return <g><path d="M20 74a42 42 0 0 1 80 0" fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round" /><path d="M20 74a42 42 0 0 1 62-37" fill="none" stroke="url(#limG)" strokeWidth="12" strokeLinecap="round" /><path d="M60 66L86 32" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" /><circle cx="60" cy="70" r="9" fill="#f8fafc" /><text x="60" y="52" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff">×</text></g>;
}

function TowerArt() {
  return <g>{[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={28 + c * 24 + (r % 2) * 4} y={62 - r * 16} width="20" height="12" rx="3" fill={r === 3 && c === 1 ? "#fbbf24" : "#94a3b8"} opacity={0.45 + r * 0.15} />))}<path d="M58 16l5 10-5 10-5-10z" fill="#fbbf24" /></g>;
}

export function Poster({ theme, className, style }: { theme: PosterTheme; className?: string; style?: CSSProperties }) {
  const palettes: Record<string, [string, string, string]> = {
    chicken: ["#0f172a", "#7c2d12", "#f59e0b"], "chicken-ice": ["#082f49", "#0369a1", "#38bdf8"], "chicken-gold": ["#291a02", "#a16207", "#fbbf24"], "chicken-vegas": ["#2a0718", "#9d174d", "#fb7185"],
    rocket: ["#0b1020", "#4c1d95", "#f43f5e"], balloon: ["#082f49", "#0e7490", "#fbbf24"], jet: ["#0f172a", "#1d4ed8", "#60a5fa"],
    keno: ["#101828", "#4c1d95", "#fbbf24"], limbo: ["#0b1020", "#065f46", "#22c55e"], hilo: ["#111827", "#7f1d1d", "#f8fafc"], coin: ["#1f2937", "#92400e", "#fbbf24"],
    scratch: ["#111827", "#065f46", "#fbbf24"], tower: ["#0b1020", "#3730a3", "#818cf8"], plinko: ["#0f172a", "#155e75", "#22d3ee"], cascade: ["#170b2e", "#6d28d9", "#f0abfc"],
    blackjack: ["#071a12", "#065f46", "#f8fafc"], roulette: ["#1c0b0b", "#991b1b", "#fbbf24"],
  };
  const [bg, accent, light] = palettes[theme];
  const art = theme.startsWith("chicken") ? <Chicken tone={theme} /> : theme === "balloon" ? <Rocket balloon /> : theme === "jet" ? <Rocket jet /> : theme === "rocket" ? <Rocket /> : theme === "keno" ? <Balls /> : theme === "hilo" || theme === "blackjack" ? <Cards /> : theme === "plinko" ? <Pins /> : theme === "roulette" ? <Wheel /> : theme === "cascade" ? <Gems /> : theme === "scratch" ? <Tiles /> : theme === "coin" ? <Coin /> : theme === "limbo" ? <LimboArt /> : <TowerArt />;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: `${glow(light)}, linear-gradient(145deg, ${bg}, ${accent})`, ...style }}>
      <svg viewBox="0 0 120 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="rocketG" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#94a3b8" /></linearGradient>
          <linearGradient id="jetG" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#93c5fd" /></linearGradient>
          <linearGradient id="balG" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fbbf24" /><stop offset="1" stopColor="#ef4444" /></linearGradient>
          <linearGradient id="coinG" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fef08a" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
          <linearGradient id="limG" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#22c55e" /><stop offset="1" stopColor="#fbbf24" /></linearGradient>
          <radialGradient id="ballShade" cx=".3" cy=".2" r=".9"><stop stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity=".15" /></radialGradient>
          <radialGradient id="ballG2" cx=".3" cy=".2" r=".9"><stop stopColor="#fff" /><stop offset="1" stopColor="#f59e0b" /></radialGradient>
        </defs>
        {art}
      </svg>
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.12)_50%,transparent_65%)]" />
    </div>
  );
}
