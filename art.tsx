import type { SVGProps } from "react";
import { cn } from "../utils/cn";

/** Red propeller plane, side view facing right. */
export function Plane({ className, spinning = true, ...p }: SVGProps<SVGSVGElement> & { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 120 64" className={className} {...p}>
      <defs>
        <linearGradient id="planeBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff2a57" />
          <stop offset="1" stopColor="#c8002e" />
        </linearGradient>
      </defs>
      {/* tail */}
      <path d="M14 34 L6 10 Q5 7 8 7 L17 7 Q19 7 20 9 L32 31 Z" fill="#e50539" />
      <path d="M4 33 L24 30 L26 37 L6 39 Q2 38 4 33 Z" fill="#b8002c" />
      {/* fuselage */}
      <path d="M10 36 C18 27 50 24 88 25 L100 27 Q106 28 106 34 Q106 40 100 41 L88 43 C50 46 20 44 10 36 Z" fill="url(#planeBody)" />
      {/* lower wing */}
      <path d="M46 37 L74 37 L64 58 Q63 60 60 60 L50 60 Q47 60 48 57 Z" fill="#a80027" />
      {/* upper wing */}
      <path d="M50 27 L70 27 L64 6 Q63 4 61 4 L54 4 Q51 4 52 7 Z" fill="#ff3a63" />
      {/* cockpit */}
      <path d="M66 26 C68 17 80 16 84 25 Z" fill="#ffd1dc" opacity="0.9" />
      {/* wheel */}
      <circle cx="78" cy="50" r="4.5" fill="#2a0a12" />
      <path d="M76 43 L78 50" stroke="#2a0a12" strokeWidth="2" />
      {/* nose + propeller */}
      <circle cx="107" cy="34" r="3.5" fill="#7a0018" />
      <g className={cn(spinning && "animate-prop")} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <ellipse cx="111" cy="34" rx="2.6" ry="19" fill="#e50539" />
      </g>
    </svg>
  );
}

/** Bottom-nav Aviator icon: plane climbing on a stand. */
export function AviatorNavIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 52" className={className}>
      <ellipse cx="32" cy="48" rx="15" ry="3" fill="#1f2937" />
      <rect x="30.5" y="31" width="3" height="16" rx="1.5" fill="#1f2937" />
      <g transform="rotate(-22 34 24)">
        <path d="M10 26 L5 12 Q5 10 7 10 L13 10 Q14 10 15 11 L22 24 Z" fill="#e50539" />
        <path d="M8 26 C14 19 34 18 50 19 L56 20 Q60 21 60 25 Q60 29 56 30 L50 31 C34 33 14 32 8 26 Z" fill="#e50539" />
        <path d="M30 27 L46 27 L41 40 L33 40 Z" fill="#a80027" />
        <path d="M32 20 L44 20 L40 6 L35 6 Z" fill="#ff3a63" />
        <path d="M42 19 C43 14 50 13 52 19 Z" fill="#1f2937" />
        <rect x="59" y="14" width="3" height="22" rx="1.5" fill="#1f2937" />
      </g>
    </svg>
  );
}

export function Bomb({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <defs>
        <radialGradient id="bombG" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#6b6b78" />
          <stop offset="0.45" stopColor="#24242c" />
          <stop offset="1" stopColor="#050507" />
        </radialGradient>
      </defs>
      <circle cx="30" cy="38" r="21" fill="url(#bombG)" />
      <ellipse cx="22" cy="29" rx="6" ry="4" fill="#fff" opacity="0.28" transform="rotate(-30 22 29)" />
      <rect x="35" y="12" width="12" height="9" rx="2.5" fill="#2b2b33" transform="rotate(35 41 16)" />
      <path d="M44 12 Q50 4 56 8" stroke="#d6b98c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="57" cy="7" r="4" fill="#ffd34d" />
      <circle cx="57" cy="7" r="2" fill="#fff" />
    </svg>
  );
}

export function GoldStar({ className, dim }: { className?: string; dim?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <defs>
        <linearGradient id="starG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset="0.5" stopColor="#ffc928" />
          <stop offset="1" stopColor="#e08a00" />
        </linearGradient>
      </defs>
      <path
        d="M32 5 L40 23 L59 25 L45 38 L49 57 L32 47 L15 57 L19 38 L5 25 L24 23 Z"
        fill={dim ? "#7a5aa0" : "url(#starG)"}
        stroke={dim ? "#5b3d80" : "#b86a00"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {!dim ? <path d="M32 12 L37 24 L50 26" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" fill="none" strokeLinecap="round" /> : null}
    </svg>
  );
}
