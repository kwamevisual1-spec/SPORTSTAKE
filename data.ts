import { TEAMS, CLUB_KEYS, type Team, type CrestPattern } from "./clubs";
import { hash01, kickoffAt, liveState, type SimInput, type SportKind } from "./lib/sim";

export { TEAMS, CLUB_KEYS, hash01 };
export type { Team, CrestPattern };

export type SportKey = SportKind;

export const SPORTS: SportKey[] = ["football", "v-football", "basketball", "v-basketball"];

export const SPORT_LABEL: Record<SportKey, string> = {
  football: "Football",
  "v-football": "V-Football",
  basketball: "Basketball",
  "v-basketball": "V-Basketball",
};

const MIN = 60_000;

/**
 * Schedule anchor. Kept for 60 minutes in localStorage so a page refresh shows the
 * same matches at the same minute; after that a fresh schedule is generated.
 */
const ANCHOR_KEY = "ss.anchor.v3";
const ANCHOR_TTL = 60 * MIN;
export const ANCHOR: number = (() => {
  const now = Date.now();
  try {
    const saved = Number(localStorage.getItem(ANCHOR_KEY));
    if (saved && saved <= now && now - saved < ANCHOR_TTL) return saved;
    localStorage.setItem(ANCHOR_KEY, String(now));
  } catch {
    /* private mode */
  }
  return now;
})();

export type Match = SimInput & {
  id: string;
  home: string;
  away: string;
  league: string;
  country: string;
  extraMarkets: number;
  hot?: boolean;
};

/* ------------------------------------------------------------------ */
/* schedule helpers                                                    */
/* ------------------------------------------------------------------ */

const ceil5 = (t: number) => Math.ceil(t / (5 * MIN)) * 5 * MIN;

function endOfDay(t: number) {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Kick-off later today – front-loaded so new games go live during a session. */
function today(frac: number) {
  const start = ANCHOR + 6 * MIN;
  const last = new Date(ANCHOR);
  last.setHours(23, 30, 0, 0);
  const span = Math.max(40 * MIN, last.getTime() - start);
  return ceil5(start + span * Math.pow(frac, 1.65));
}

function inDays(days: number, hhmm: string) {
  const d = new Date(ANCHOR);
  d.setDate(d.getDate() + days);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const extra = (id: string, base: number, spread: number) => base + Math.floor(hash01(id + ":mk") * spread);

const fbStr = (id: string): [number, number] => [
  Math.round((0.85 + hash01(id + ":h") * 1.25) * 100) / 100,
  Math.round((0.6 + hash01(id + ":a") * 1.15) * 100) / 100,
];
const bbStr = (id: string): [number, number] => [Math.round(76 + hash01(id + ":h") * 20), Math.round(74 + hash01(id + ":a") * 20)];

const EN1 = "England - Premier Division";
const EN2 = "England - Championship";
const IT = "Italy - Serie Nazionale";
const ES = "Spain - Liga Primera";
const DE = "Germany - Bundesklasse";
const FR = "France - Ligue Élite";
const SC = "Scotland - Premiership";
const IE = "Ireland - Premier League";
const INT = "International - Royal Heritage Cup";
const VFL = "V-Football - Virtual Premier League";
const EBL = "Europe - Elite Basketball League";
const VBL = "V-Basketball - Virtual Hoops League";

function F(id: string, home: string, away: string, league: string, country: string, kickoff: number, hot = false): Match {
  return { id, seed: `${id}@${ANCHOR}`, sport: "football", kickoff, str: fbStr(id), home, away, league, country, extraMarkets: extra(id, 60, 120), hot };
}

/** A match already in play at `minute` when the schedule starts. */
function FL(id: string, home: string, away: string, league: string, country: string, minute: number | "HT", hot = false): Match {
  const base = { seed: `${id}@${ANCHOR}`, sport: "football" as const, str: fbStr(id) };
  return { id, ...base, kickoff: kickoffAt(base, minute, ANCHOR), home, away, league, country, extraMarkets: extra(id, 30, 60), hot };
}

function B(id: string, home: string, away: string, league: string, country: string, kickoff: number | { minute: number }): Match {
  const base = { seed: `${id}@${ANCHOR}`, sport: "basketball" as const, str: bbStr(id) };
  const k = typeof kickoff === "number" ? kickoff : kickoffAt(base, kickoff.minute, ANCHOR);
  return { id, ...base, kickoff: k, home, away, league, country, extraMarkets: extra(id, 15, 25) };
}

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const FOOTBALL: Match[] = [
  /* in play when the schedule starts (fewer than today's upcoming games) */
  FL("f01", "ashford_united", "westbridge_town", EN1, "England", 61, true),
  FL("f02", "kingsbury_athletic", "redcliffe_wanderers", EN1, "England", 34),
  FL("f03", "southwick_albion", "wexford_borough", EN2, "England", 73),
  FL("f04", "montelupo", "bellariva", IT, "Italy", "HT"),
  FL("f05", "torremare", "castelrosso", IT, "Italy", 86),
  FL("f06", "puerto_blanco", "almaraz", ES, "Spain", 12),
  FL("f07", "rotenburg", "eisenbruck", DE, "Germany", 67, true),
  FL("f08", "saint_romain", "valmont", FR, "France", 39),
  FL("f09", "dunhaven", "inverleigh", SC, "Scotland", 52),

  /* later today */
  F("f11", "eastbourne_county", "millchester_united", EN1, "England", today(0.0), true),
  F("f12", "northbury_town", "harrowgate_rovers", EN1, "England", today(0.06)),
  F("f13", "whitestone_athletic", "brackenford", EN1, "England", today(0.5)),
  F("f14", "ironbridge_town", "dunmore_united", EN2, "England", today(0.1)),
  F("f15", "blackthorn_city", "fairmont_rovers", EN2, "England", today(0.32)),
  F("f16", "aldermere_athletic", "thornfield_county", EN2, "England", today(0.44)),
  F("f17", "westhaven", "oldcastle_athletic", EN2, "England", today(0.88)),
  F("f18", "san_lorenzo", "castellano", IT, "Italy", today(0.14), true),
  F("f19", "valdoria", "portavento", IT, "Italy", today(0.38)),
  F("f20", "fiorentella", "novarosa", IT, "Italy", today(0.8)),
  F("f21", "valdemora", "san_telmo", ES, "Spain", today(0.03)),
  F("f22", "villaclara", "castellana", ES, "Spain", today(0.26)),
  F("f23", "estrella_norte", "villareina", ES, "Spain", today(0.6), true),
  F("f24", "ribera", "san_aurelio", ES, "Spain", today(0.94)),
  F("f25", "falkenheim", "lindenstadt", DE, "Germany", today(0.18), true),
  F("f26", "kronenburg", "adlerstein", DE, "Germany", today(0.47)),
  F("f27", "westfalenberg", "grunwald", DE, "Germany", today(0.74)),
  F("f28", "montclair", "belleville", FR, "France", today(0.22)),
  F("f29", "artois", "villeneuve", FR, "France", today(0.56)),
  F("f30", "clairmont", "porteneuve", FR, "France", today(0.84)),
  F("f31", "clydeford", "st_andrews", SC, "Scotland", today(0.29)),
  F("f32", "ballycastle", "carrickbridge", IE, "Ireland", today(0.08)),
  F("f33", "shamrock_vale", "north_caledonia", IE, "Ireland", today(0.66)),
  F("f34", "kingswell", "saint_edmund", INT, "International", today(0.35)),
  F("f35", "crownbridge", "royal_westford", INT, "International", today(0.7), true),
  F("f36", "imperial_borough", "victoria_caledon", INT, "International", today(0.97)),
  F("f10", "royal_ashbourne", "montfort", INT, "International", today(0.41)),

  /* upcoming days */
  F("f37", "westbridge_town", "kingsbury_athletic", EN1, "England", inDays(1, "15:00")),
  F("f38", "redcliffe_wanderers", "eastbourne_county", EN1, "England", inDays(2, "17:30")),
  F("f39", "millchester_united", "ashford_united", EN1, "England", inDays(3, "20:00")),
  F("f40", "dunmore_united", "blackthorn_city", EN2, "England", inDays(1, "19:45")),
  F("f41", "fairmont_rovers", "southwick_albion", EN2, "England", inDays(2, "15:00")),
  F("f42", "monteverde", "bellacosta", IT, "Italy", inDays(1, "18:00")),
  F("f43", "san_vittore", "ravellino", IT, "Italy", inDays(2, "20:45")),
  F("f44", "monterivo", "montelupo", IT, "Italy", inDays(3, "14:00")),
  F("f45", "monteluz", "arandia", ES, "Spain", inDays(1, "21:00")),
  F("f46", "valcera", "montelago", ES, "Spain", inDays(2, "18:30")),
  F("f47", "torrevella", "valdemora", ES, "Spain", inDays(3, "20:00")),
  F("f48", "hohenbruck", "neustadt", DE, "Germany", inDays(1, "14:30")),
  F("f49", "rosenheim", "altenburg", DE, "Germany", inDays(2, "14:30")),
  F("f50", "stahlheim", "nordhausen", DE, "Germany", inDays(2, "17:30")),
  F("f51", "bergstadt", "falkenheim", DE, "Germany", inDays(3, "17:30")),
  F("f52", "rochefort", "stade_du_nord", FR, "France", inDays(1, "20:00")),
  F("f53", "valmont", "montclair", FR, "France", inDays(2, "16:00")),
  F("f54", "glenmore_thistle", "dunhaven", SC, "Scotland", inDays(1, "15:00")),
  F("f55", "east_dunleigh", "ballycastle", IE, "Ireland", inDays(2, "19:45")),
  F("f56", "blackmoor", "royal_bellmont", INT, "International", inDays(1, "20:00")),
  F("f57", "norchester", "st_georges", INT, "International", inDays(2, "20:00")),
  F("f58", "grandchester", "oldhamshire", INT, "International", inDays(3, "18:00")),
  F("f59", "crownfield", "royal_ashbourne", INT, "International", inDays(3, "20:45")),
];

/* Virtual football: a new 3-match round every 3 minutes, each lasting 3 minutes. */
const VF_ROUND = 3 * MIN;
const VF_BASE = Math.floor(ANCHOR / VF_ROUND) * VF_ROUND;
const VIRTUAL_FOOTBALL: Match[] = Array.from({ length: 40 }, (_, r) =>
  Array.from({ length: 3 }, (_, i): Match => {
    const kickoff = VF_BASE + r * VF_ROUND;
    const off = Math.floor(hash01(`vf:${r}`) * 100);
    const id = `vf${r}-${i}`;
    return {
      id,
      seed: `vf@${kickoff}:${i}`,
      sport: "v-football",
      kickoff,
      str: fbStr(`vf${kickoff}:${i}`),
      home: CLUB_KEYS[(off + i * 2) % 100],
      away: CLUB_KEYS[(off + i * 2 + 37) % 100],
      league: VFL,
      country: "Virtual",
      extraMarkets: 38 + i * 3,
    };
  }),
).flat();

const BASKETBALL: Match[] = [
  B("b01", "royal_bellmont", "imperial_borough", EBL, "International", { minute: 13 }),
  B("b02", "castellano", "san_lorenzo", EBL, "International", { minute: 18 }),
  B("b03", "ribera", "monteluz", "Spain - Liga Basket", "Spain", { minute: 27 }),
  B("b04", "falkenheim", "rotenburg", EBL, "International", today(0.3)),
  B("b05", "valmont", "artois", "France - Pro A Basket", "France", today(0.72)),
  B("b06", "grandchester", "norchester", EBL, "International", inDays(1, "19:00")),
];

/* Virtual basketball: 2-match rounds every 7 minutes (8× speed). */
const VB_ROUND = 7 * MIN;
const VB_BASE = Math.floor(ANCHOR / VB_ROUND) * VB_ROUND;
const VIRTUAL_BASKETBALL: Match[] = Array.from({ length: 18 }, (_, r) =>
  Array.from({ length: 2 }, (_, i): Match => {
    const kickoff = VB_BASE + r * VB_ROUND;
    const off = Math.floor(hash01(`vb:${r}`) * 100);
    return {
      id: `vb${r}-${i}`,
      seed: `vb@${kickoff}:${i}`,
      sport: "v-basketball",
      kickoff,
      str: bbStr(`vb${kickoff}:${i}`),
      home: CLUB_KEYS[(off + i * 3 + 50) % 100],
      away: CLUB_KEYS[(off + i * 3 + 71) % 100],
      league: VBL,
      country: "Virtual",
      extraMarkets: 16 + i * 2,
    };
  }),
).flat();

export const ALL_MATCHES: Match[] = [...FOOTBALL, ...VIRTUAL_FOOTBALL, ...BASKETBALL, ...VIRTUAL_BASKETBALL];
export const MATCH_BY_ID = new Map(ALL_MATCHES.map((m) => [m.id, m]));

/* ------------------------------------------------------------------ */
/* phase helpers (all time-based)                                       */
/* ------------------------------------------------------------------ */

export type Phase = "live" | "today" | "upcoming" | "ft";

export function phaseOf(m: Match, now = Date.now()): Phase {
  const st = liveState(m, now);
  if (st.phase === "live") return "live";
  if (st.phase === "ft") return "ft";
  return m.kickoff <= endOfDay(now) ? "today" : "upcoming";
}

export const isVirtual = (m: { sport: SportKey }) => m.sport === "v-football" || m.sport === "v-basketball";
export const isFootballLike = (m: { sport: SportKey }) => m.sport === "football" || m.sport === "v-football";

/** Virtual sports list only the next few rounds. */
const virtualWindow = (m: Match, now: number) => (m.sport === "v-football" ? 16 * MIN : 36 * MIN) >= m.kickoff - now;

export function inWindow(m: Match, now: number) {
  return !isVirtual(m) || virtualWindow(m, now);
}

export const isNext6h = (m: Match, now = Date.now()) =>
  liveState(m, now).phase === "pre" && m.kickoff - now <= 6 * 60 * MIN && inWindow(m, now);

export const liveClock = (m: Match, now: number) => liveState(m, now).label;

export const teamName = (key: string) => TEAMS[key]?.name ?? key;
export const fixtureName = (m: { home: string; away: string }) => `${teamName(m.home)} vs ${teamName(m.away)}`;

/** Today's football = in play now + still to kick off today. */
export const todaysFootball = (now: number) => ALL_MATCHES.filter((m) => m.sport === "football" && (phaseOf(m, now) === "live" || phaseOf(m, now) === "today"));

export const liveCount = (now: number) => ALL_MATCHES.filter((m) => phaseOf(m, now) === "live").length;

export const simOf = (m: Match): SimInput => ({ seed: m.seed, sport: m.sport, kickoff: m.kickoff, str: m.str });
