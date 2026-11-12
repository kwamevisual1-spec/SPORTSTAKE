import { cur, num, sc } from "./currency";
export type PromoAction = "deposit" | "today" | "mybets" | "affiliate" | "aviator" | "jackpot" | "casino" | "aiselect";

export type Promo = {
  id: string;
  title: string;
  sub: string;
  gradient: string;
  emoji: string;
  cta: string;
  action: PromoAction;
  steps: string[];
  terms: string[];
};

export const getPromos = (): Promo[] => [
  {
    id: "welcome",
    title: "100% First Deposit Bonus",
    sub: `Double your first deposit – up to ${cur()} ${num(sc(200))}`,
    gradient: "from-[#4c1d95] via-[#7c3aed] to-[#db2777]",
    emoji: "🎁",
    cta: "Deposit now",
    action: "deposit",
    steps: ["Create your SportStake account", "Make your first deposit with MoMo or card", `Bonus equal to your deposit (max ${cur()} ${num(sc(200))}) is credited instantly`],
    terms: ["Valid on the first deposit only", `Maximum bonus ${cur()} ${num(sc(200))}`, "One bonus per person, phone number and device"],
  },
  {
    id: "boost",
    title: "Multiple Boost up to +20%",
    sub: "Add 3 or more selections and boost your winnings",
    gradient: "from-[#0e7a37] via-[#17a34a] to-[#84cc16]",
    emoji: "🚀",
    cta: "Build a multiple",
    action: "today",
    steps: ["Add 3+ selections to your betslip", "Choose Multiple", "Boost is applied automatically: 3 legs +3% up to 10+ legs +20%"],
    terms: ["Applies to multiple bets only", "Boost is paid on the winnings of the multiple", `Maximum payout ${cur()} ${num(sc(500000))} per bet`],
  },
  {
    id: "cashout",
    title: "Cash Out",
    sub: "Take your money before the final whistle",
    gradient: "from-[#0f172a] via-[#1e3a8a] to-[#0ea5e9]",
    emoji: "💸",
    cta: "Go to My Bets",
    action: "mybets",
    steps: ["Open My Bets", "Find an open sports bet", "Tap Cash Out to settle it instantly at the offered value"],
    terms: ["Cash out value changes with the match situation", "Cash out may be unavailable when markets are suspended"],
  },
  {
    id: "ai",
    title: "AI-Select Tips",
    sub: "Let our model build a 4-fold from today's football",
    gradient: "from-[#1d4ed8] via-[#3b82f6] to-[#22d3ee]",
    emoji: "🤖",
    cta: "Get AI picks",
    action: "aiselect",
    steps: ["Tap AI-Select", "The 4 highest-confidence picks from today's football are added", "Review, adjust your stake and place"],
    terms: ["Predictions are statistical estimates, not guarantees", "Always bet responsibly"],
  },
  {
    id: "refer",
    title: "Refer & Earn",
    sub: "Earn up to 40% commission for every friend",
    gradient: "from-[#b45309] via-[#f59e0b] to-[#fde047]",
    emoji: "🤝",
    cta: "Get my link",
    action: "affiliate",
    steps: ["Copy your personal referral link", "Share it with friends", "Earn commission on their activity every week"],
    terms: ["Referred friends must be new customers", "Commission is paid weekly"],
  },
  {
    id: "jackpot",
    title: `Sports Jackpot – ${cur()} ${num(sc(8623))}`,
    sub: `Predict 12 matches correctly for just ${cur()} ${num(sc(2))}`,
    gradient: "from-[#065f46] via-[#059669] to-[#34d399]",
    emoji: "🏆",
    cta: "Play jackpot",
    action: "jackpot",
    steps: ["Pick 1, X or 2 for all 12 matches", "Use doubles/triples to cover more outcomes", `Submit your ticket – ${cur()} ${num(sc(2))} per line`],
    terms: ["12/12 wins the jackpot; 11/12 and 10/12 win bonus prizes", "Prize pool shared between winning tickets"],
  },
  {
    id: "aviator",
    title: "Aviator Rain",
    sub: "Our crash game – cash out up to ×10,000",
    gradient: "from-[#7f1d1d] via-[#dc2626] to-[#f59e0b]",
    emoji: "✈️",
    cta: "Play Aviator",
    action: "aviator",
    steps: ["Set your stake", "Watch the multiplier climb", "Cash out before the plane flies away"],
    terms: ["Every round is independent and provably random", "Demo mode available without an account"],
  },
];
