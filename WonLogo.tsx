/** Small 3D gold "Won" coin used beside the recent-wins ticker. */
export function WonLogo() {
  return (
    <span className="won-coin" aria-label="Won">
      <span className="won-coin-rotor">
        <span className="won-coin-face won-coin-front">
          <svg viewBox="0 0 34 34" aria-hidden="true" className="h-[26px] w-[26px]">
            <defs>
              <linearGradient id="wonRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff7ae" />
                <stop offset="1" stopColor="#d4a017" />
              </linearGradient>
            </defs>
            <circle cx="17" cy="17" r="14.5" fill="none" stroke="url(#wonRing)" strokeWidth="1.6" />
            <path d="M10 21c-3-3-4-7-2-11M24 21c3-3 4-7 2-11" fill="none" stroke="#0e7a37" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7.5 12l3 1M8.5 17l3-1M26.5 12l-3 1M25.5 17l-3-1" stroke="#0e7a37" strokeWidth="1.3" strokeLinecap="round" />
            <text x="17" y="20.2" textAnchor="middle" fontSize="8.2" fontWeight="900" fill="#0e7a37" fontFamily="Inter, sans-serif" letterSpacing="-0.3">Won</text>
          </svg>
        </span>
        <span className="won-coin-face won-coin-back">Won</span>
        <span className="won-coin-edge" />
        <span className="won-coin-shine" />
      </span>
    </span>
  );
}
