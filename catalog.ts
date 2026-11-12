import type { PosterTheme } from "./poster";

export type Engine =
  | "aviator" | "mines" | "slots" | "dice" | "wheel" | "penalty"
  | "chicken" | "tower" | "plinko" | "keno" | "limbo" | "hilo" | "coinflip" | "scratch"
  | "crash" | "cascade" | "blackjack" | "roulette";

export type GameCategory = "Crash" | "Slots" | "Instant" | "Numbers" | "Cards";

export type Game = {
  id: string;
  name: string;
  tileTitle: string;
  engine: Engine;
  category: GameCategory;
  tag?: "HOT" | "NEW" | "JACKPOT" | "TOP";
  art: string;
  poster?: PosterTheme;
  variant?: string;
  accent: string;
  rtp: number;
  players: number;
  royals?: string[];
  blurb: string;
};

export const STUDIO = "SportStake Originals";

export const GAMES: Game[] = [
  /* ---- crash & flight ---- */
  { id: "aviator", name: "Aviator", tileTitle: "AVIATOR", engine: "aviator", category: "Crash", tag: "TOP", art: "/games/aviator.jpg", poster: "rocket", accent: "#e50539", rtp: 97, players: 3480, blurb: "Cash out before the plane flies away." },
  { id: "rocket-rush", name: "Rocket Rush", tileTitle: "ROCKET RUSH", engine: "crash", category: "Crash", tag: "NEW", art: "", poster: "rocket", variant: "rocket", accent: "#f43f5e", rtp: 97, players: 1284, blurb: "Ride the rocket and jump off before it explodes." },
  { id: "balloon-blast", name: "Balloon Blast", tileTitle: "BALLOON BLAST", engine: "crash", category: "Crash", art: "", poster: "balloon", variant: "balloon", accent: "#06b6d4", rtp: 97, players: 906, blurb: "Float higher for bigger multipliers – land before the pop." },
  { id: "jet-dash", name: "Jet Dash", tileTitle: "JET DASH", engine: "crash", category: "Crash", tag: "HOT", art: "", poster: "jet", variant: "jet", accent: "#3b82f6", rtp: 97, players: 1672, blurb: "A paper jet, a rising curve, one decision: cash out." },

  /* ---- Chicken Road Festival ---- */
  { id: "chicken-road", name: "Chicken Road", tileTitle: "CHICKEN ROAD", engine: "chicken", category: "Crash", tag: "TOP", art: "", poster: "chicken", variant: "classic", accent: "#f59e0b", rtp: 96, players: 2914, blurb: "Cross the road one lane at a time and cash out before the traffic." },
  { id: "chicken-road-ice", name: "Chicken Road Ice", tileTitle: "ROAD ICE", engine: "chicken", category: "Crash", tag: "NEW", art: "", poster: "chicken-ice", variant: "ice", accent: "#38bdf8", rtp: 96, players: 1188, blurb: "Frozen lanes, faster cars and a colder cash-out decision." },
  { id: "chicken-road-gold", name: "Chicken Road Gold", tileTitle: "ROAD GOLD", engine: "chicken", category: "Crash", tag: "JACKPOT", art: "", poster: "chicken-gold", variant: "gold", accent: "#fbbf24", rtp: 96, players: 1406, blurb: "Golden lanes with the biggest step multipliers." },
  { id: "chicken-road-vegas", name: "Chicken Road Vegas", tileTitle: "ROAD VEGAS", engine: "chicken", category: "Crash", art: "", poster: "chicken-vegas", variant: "vegas", accent: "#fb7185", rtp: 96, players: 973, blurb: "Neon traffic, higher risk, higher reward." },

  /* ---- mines & arcade instant ---- */
  { id: "mines", name: "Mini Mines", tileTitle: "MINES", engine: "mines", category: "Instant", tag: "HOT", art: "/games/mines.jpg", poster: "tower", accent: "#ff7a00", rtp: 97, players: 1544, blurb: "Find the stars, avoid the mines, cash out any time." },
  { id: "mines-xl", name: "Mega Mines", tileTitle: "MEGA MINES", engine: "mines", category: "Instant", tag: "NEW", art: "/games/mines.jpg", poster: "tower", variant: "xl", accent: "#f97316", rtp: 97, players: 688, blurb: "A 25-tile board for players who want a longer climb." },
  { id: "tower-rush", name: "Tower Rush", tileTitle: "TOWER RUSH", engine: "tower", category: "Instant", tag: "HOT", art: "", poster: "tower", accent: "#818cf8", rtp: 96, players: 1092, blurb: "Pick a safe door on every floor and climb for bigger multipliers." },
  { id: "plinko-storm", name: "Plinko Storm", tileTitle: "PLINKO STORM", engine: "plinko", category: "Instant", art: "", poster: "plinko", accent: "#22d3ee", rtp: 97, players: 1821, blurb: "Drop the ball, watch it bounce, land the big bucket." },
  { id: "scratch-gold", name: "Scratch Gold", tileTitle: "SCRATCH GOLD", engine: "scratch", category: "Instant", art: "", poster: "scratch", accent: "#fbbf24", rtp: 96, players: 764, blurb: "Reveal nine tiles – three matching symbols pays." },
  { id: "limbo", name: "Limbo", tileTitle: "LIMBO", engine: "limbo", category: "Instant", art: "", poster: "limbo", accent: "#22c55e", rtp: 97, players: 1337, blurb: "Choose your target multiplier and beat the number." },
  { id: "fortune-wheel", name: "Fortune Wheel", tileTitle: "FORTUNE WHEEL", engine: "wheel", category: "Instant", art: "/games/wheel.jpg", poster: "roulette", accent: "#9333ea", rtp: 95.5, players: 921, blurb: "Spin for multipliers up to ×4." },
  { id: "penalty-king", name: "Penalty King", tileTitle: "PENALTY KING", engine: "penalty", category: "Instant", tag: "NEW", art: "/games/penalty.jpg", poster: "chicken", accent: "#16a34a", rtp: 96, players: 1188, blurb: "Beat the keeper – each goal multiplies your win." },
  { id: "lucky-dice", name: "Lucky Dice", tileTitle: "LUCKY DICE", engine: "dice", category: "Instant", art: "/games/dice.jpg", poster: "keno", accent: "#059669", rtp: 97, players: 640, blurb: "Pick your odds and roll under the target." },

  /* ---- slots ---- */
  { id: "golden-kente", name: "Golden Kente", tileTitle: "GOLDEN KENTE", engine: "slots", category: "Slots", tag: "JACKPOT", art: "/games/kente.jpg", accent: "#d4a017", rtp: 96, players: 2410, royals: ["#ffd54a", "#34d399", "#f87171", "#60a5fa", "#e5e7eb"], blurb: "Royal kente riches across 5 reels and 5 lines." },
  { id: "kente-cascades", name: "Kente Cascades", tileTitle: "KENTE CASCADES", engine: "cascade", category: "Slots", tag: "NEW", art: "/games/kente.jpg", poster: "cascade", variant: "kente", accent: "#d4a017", rtp: 96, players: 1124, royals: ["#ffd54a", "#34d399", "#f87171", "#60a5fa", "#e5e7eb"], blurb: "Winning symbols explode and the multiplier climbs on every cascade." },
  { id: "safari-riches", name: "Safari Riches", tileTitle: "SAFARI RICHES", engine: "slots", category: "Slots", art: "/games/safari.jpg", accent: "#f59e0b", rtp: 96, players: 1312, royals: ["#fbbf24", "#fb923c", "#f87171", "#a3e635", "#fde68a"], blurb: "The king of the savanna pays the big wins." },
  { id: "pharaoh-gold", name: "Pharaoh's Gold", tileTitle: "PHARAOH'S GOLD", engine: "slots", category: "Slots", tag: "NEW", art: "/games/pharaoh.jpg", accent: "#2563eb", rtp: 96, players: 1104, royals: ["#facc15", "#38bdf8", "#f472b6", "#a78bfa", "#e5e7eb"], blurb: "Uncover the treasure of the Nile." },
  { id: "pharaoh-cascades", name: "Pharaoh Cascades", tileTitle: "PHARAOH CASCADES", engine: "cascade", category: "Slots", art: "/games/pharaoh.jpg", poster: "cascade", variant: "pharaoh", accent: "#2563eb", rtp: 96, players: 842, royals: ["#facc15", "#38bdf8", "#f472b6", "#a78bfa", "#e5e7eb"], blurb: "Ancient gold keeps falling with a rising cascade multiplier." },
  { id: "fruit-fiesta", name: "Fruit Fiesta", tileTitle: "FRUIT FIESTA", engine: "slots", category: "Slots", tag: "HOT", art: "/games/fruits.jpg", accent: "#db2777", rtp: 96, players: 1980, royals: ["#facc15", "#f472b6", "#a78bfa", "#4ade80", "#fb923c"], blurb: "A classic fruit machine with juicy lines." },

  /* ---- numbers & cards ---- */
  { id: "keno-royal", name: "Keno Royal", tileTitle: "KENO ROYAL", engine: "keno", category: "Numbers", tag: "HOT", art: "", poster: "keno", accent: "#a855f7", rtp: 96, players: 1502, blurb: "Pick your lucky numbers and watch ten balls drop." },
  { id: "hilo-royale", name: "Hi-Lo Royale", tileTitle: "HI-LO ROYALE", engine: "hilo", category: "Numbers", art: "", poster: "hilo", accent: "#ef4444", rtp: 96, players: 1190, blurb: "Higher or lower? Build a streak and cash out before you miss." },
  { id: "coin-flip", name: "Coin Flip", tileTitle: "COIN FLIP", engine: "coinflip", category: "Numbers", art: "", poster: "coin", accent: "#f59e0b", rtp: 98, players: 2035, blurb: "Heads or tails – 1.96× on every correct call." },
  { id: "blackjack-classic", name: "Blackjack Classic", tileTitle: "BLACKJACK", engine: "blackjack", category: "Cards", tag: "TOP", art: "", poster: "blackjack", accent: "#059669", rtp: 99.5, players: 2260, blurb: "Hit, stand or double down against the dealer. Blackjack pays 3:2." },
  { id: "mini-roulette", name: "Mini Roulette", tileTitle: "MINI ROULETTE", engine: "roulette", category: "Cards", tag: "NEW", art: "", poster: "roulette", accent: "#dc2626", rtp: 96.3, players: 1711, blurb: "A fast 12-number wheel with red/black, odd/even and straight numbers." },
];

export const GAME_BY_ID = new Map(GAMES.map((g) => [g.id, g]));

export const FEATURED_IDS = ["chicken-road", "aviator", "golden-kente", "plinko-storm", "blackjack-classic", "rocket-rush", "mines", "keno-royal", "kente-cascades", "tower-rush", "limbo", "mini-roulette"];
export const FESTIVAL_IDS = ["chicken-road", "chicken-road-ice", "chicken-road-gold", "chicken-road-vegas"];
export const CRASH_IDS = ["aviator", "rocket-rush", "balloon-blast", "jet-dash"];
export const SLOT_IDS = ["golden-kente", "kente-cascades", "safari-riches", "pharaoh-gold", "pharaoh-cascades", "fruit-fiesta"];
export const INSTANT_IDS = ["mines", "mines-xl", "tower-rush", "plinko-storm", "scratch-gold", "limbo", "fortune-wheel", "penalty-king", "lucky-dice"];
export const NUMBER_CARD_IDS = ["keno-royal", "hilo-royale", "coin-flip", "blackjack-classic", "mini-roulette"];

export const gamesByIds = (ids: string[]) => ids.map((id) => GAME_BY_ID.get(id)!).filter(Boolean);
