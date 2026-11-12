import { TEAMS, type CrestPattern } from "../data";

const SHIELD_PATH = "M24 2.2 44.4 8.1V27.6c0 9.3-8.2 17-20.4 21.4C11.8 44.6 3.6 36.9 3.6 27.6V8.1z";

function PatternLayer({ pattern, secondary }: { pattern: CrestPattern; secondary: string }) {
  switch (pattern) {
    case "vstripes":
      return (
        <g fill={secondary} fillOpacity="0.88">
          <rect x="8" y="0" width="4.6" height="56" />
          <rect x="16" y="0" width="4.6" height="56" />
          <rect x="24" y="0" width="4.6" height="56" />
          <rect x="32" y="0" width="4.6" height="56" />
        </g>
      );
    case "hband":
      return (
        <g fill={secondary} fillOpacity="0.9">
          <rect x="0" y="20" width="48" height="7" />
          <rect x="0" y="32" width="48" height="3.5" />
        </g>
      );
    case "sash":
      return <path d="M-4 40 L30 -6 L42 -6 L8 40 Z" fill={secondary} />;
    case "cross":
      return (
        <g fill={secondary} fillOpacity="0.92">
          <rect x="20" y="0" width="8" height="56" />
          <rect x="0" y="18" width="48" height="8" />
        </g>
      );
    case "quarters":
      return (
        <g fill={secondary} fillOpacity="0.92">
          <rect x="0" y="0" width="24" height="28" />
          <rect x="24" y="28" width="24" height="28" />
        </g>
      );
    case "chevron":
      return <path d="M8 17 L24 31 L40 17 L44 22 L24 39 L4 22 Z" fill={secondary} fillOpacity="0.9" />;
    default:
      return null;
  }
}

function CrestArt({ team }: { team: (typeof TEAMS)[string] }) {
  const { shape, primary, secondary, text, abbr, pattern = "plain" } = team;

  if (shape === "circle") {
    return (
      <svg viewBox="0 0 48 48" className="h-full w-full">
        <defs>
          <linearGradient id={`cg-${abbr}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
          </linearGradient>
          <clipPath id={`cc-${abbr}`}>
            <circle cx="24" cy="24" r="20.2" />
          </clipPath>
        </defs>
        <circle cx="24" cy="24" r="22.4" fill={secondary} />
        <circle cx="24" cy="24" r="20.2" fill={primary} />
        <g clipPath={`url(#cc-${abbr})`}>
          <PatternLayer pattern={pattern} secondary={secondary} />
        </g>
        <circle cx="24" cy="24" r="20.2" fill={`url(#cg-${abbr})`} />
        <circle cx="24" cy="24" r="15.6" fill="none" stroke={secondary} strokeWidth="1.4" strokeOpacity="0.55" />
        <circle cx="24" cy="24" r="20.2" fill="none" stroke="#0b1220" strokeOpacity="0.16" strokeWidth="1.2" />
        <text
          x="24"
          y="29.6"
          textAnchor="middle"
          fontSize="14"
          fontWeight="900"
          letterSpacing="-0.55"
          fill={text}
          fontFamily="Inter, sans-serif"
        >
          {abbr}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 56" className="h-full w-full">
      <defs>
        <linearGradient id={`sg-${abbr}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.26" />
        </linearGradient>
        <clipPath id={`sc-${abbr}`}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>
      <path d={SHIELD_PATH} fill={secondary} />
      <path d={SHIELD_PATH} fill={primary} transform="translate(1.1 1.1) scale(0.954)" />
      <g clipPath={`url(#sc-${abbr})`}>
        <PatternLayer pattern={pattern} secondary={secondary} />
      </g>
      <path d={SHIELD_PATH} fill={`url(#sg-${abbr})`} />
      <path d={SHIELD_PATH} fill="none" stroke="#0b1220" strokeOpacity="0.18" strokeWidth="1.4" />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontSize="14.2"
        fontWeight="900"
        letterSpacing="-0.62"
        fill={text}
        fontFamily="Inter, sans-serif"
      >
        {abbr}
      </text>
    </svg>
  );
}

export function Crest({ team, className = "" }: { team: string; className?: string }) {
  const t = TEAMS[team];
  if (!t) return null;
  const isShield = t.shape === "shield";
  return (
    <span
      className={`relative block shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)] ${isShield ? "aspect-[48/56]" : "aspect-square"} ${className}`}
      title={t.name}
    >
      <CrestArt team={t} />
    </span>
  );
}
