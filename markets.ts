import { ALL_MATCHES, MATCH_BY_ID, TEAMS, isFootballLike, type Match, type SportKey } from "../data";
import { sc } from "./currency";
import { bbLines, fbDetail, fbModel, goalGrid, halfGrid, hash01, liveState, poisson, probsAt, toOdds, type FbModel, type SimInput } from "./sim";

/** Reference order: home wins first, then draws, then away wins (the grid reads column by column). */
/** Exactly the reference layout: priced scores first, then every remaining result falls into "Other". */
export const CS_SCORES = [
  /* home wins */
  "1:0", "2:0", "2:1", "3:0", "3:1", "3:2", "4:0", "4:1",
  /* draws */
  "0:0", "1:1", "2:2", "3:3",
  /* away wins */
  "0:1", "0:2", "1:2", "0:3", "1:3", "2:3",
];
export const CS1H_SCORES = ["0:0", "1:0", "0:1", "1:1", "2:0", "0:2", "2:1", "1:2", "2:2", "3:0", "0:3", "3:1", "1:3", "3:2", "2:3", "3:3"];

/** does a final score match this correct-score selection? (handles the "Any Other ..." options) */
export function csHit(code: string, scores: string[], fh: number, fa: number) {
  const listed = scores.some((sc) => { const [x, y] = sc.split(":").map(Number); return x === fh && y === fa; });
  // one catch-all option: any score line that is not listed above
  if (code === "OTHER" || code === "other") return !listed;
  return code === `${fh}:${fa}`;
}

export type MarketKey =
  /* match result */
  | "1x2" | "dc" | "dnb" | "mw" | "team_win" | "htft" | "ht" | "sh" | "ht_dc" | "sh_dc"
  /* 1UP family */
  | "oneup" | "twoup" | "neverdown"
  /* goals */
  | "ou" | "ou_lines" | "ttg" | "ou1h" | "ou2h" | "home_ou" | "away_ou"
  | "btts" | "btts1h" | "btts2h" | "home_score" | "away_score"
  | "oe" | "oe1h" | "home_oe" | "away_oe"
  /* scores */
  | "cs" | "cs1h" | "cs2h"
  /* team goals */
  | "hcp" | "hcp_table" | "hcp1h" | "tot"
  /* corners & bookings */
  | "corners" | "corners_home" | "corners_away" | "corners1h" | "corners2h"
  | "bookings"
  /* specials */
  | "first_goal" | "last_goal" | "win_nil" | "clean_sheet" | "highest_half" | "win_margin" | "goals_range" | "score_both_halves"
  /* basketball */
  | "ml"
  | "oe1h" | "hcp1h" | "fg1h";

export type MarketGroup = "popular" | "result" | "goals" | "btts" | "score" | "corners" | "half" | "half2" | "team" | "specials" | "main" | "handicap";

export type Outcome = {
  key: string;
  index: number;
  matchId: string;
  market: MarketKey;
  marketTitle: string;
  code: string;
  label: string;
  short: string;
  /** line for table markets (over/under, handicap) */
  line?: number;
  /** column index for correct-score markets: 0 home, 1 draw, 2 away, -1 other */
  column?: number;
};

export type Market = {
  key: MarketKey;
  title: string;
  group: MarketGroup;
  layout: "row" | "table" | "score";
  columns?: string[];
  hint?: string;
  outcomes: Outcome[];
};

export type Price = { odds: number; locked: boolean; settled?: "won" | "lost"; capped?: boolean };

/* ------------------------------------------------------------------ */
/* catalogue                                                            */
/* ------------------------------------------------------------------ */

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const OU_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5];
const TTG_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5];
const OU1H_LINES = [0.5, 1.5, 2.5, 3.5];
const OU2H_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];
const TEAM_OU_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];
const CORNER_LINES = [4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5];
const TEAM_CORNER_LINES = [2.5, 3.5, 4.5, 5.5, 6.5];
const HALF_CORNER_LINES = [2.5, 3.5, 4.5, 5.5];
const HCP_LINES = [-2, -1, 1, 2];
const HCP1H_LINES = [-1, 1];
export const HALF_MARKETS: MarketKey[] = ["ht", "cs1h", "oe1h", "hcp1h", "btts1h", "ou1h", "corners1h", "first_goal", "htft", "ht_dc"];

type Draft = {
  key: MarketKey;
  title: string;
  group: MarketGroup;
  layout: Market["layout"];
  columns?: string[];
  hint?: string;
  outs: { code: string; label: string; short: string; line?: number; column?: number }[];
};

/** column of a score relative to the home team: 0 home win, 1 draw, 2 away win */
const scoreColumn = (score: string) => {
  const [x, y] = score.split(":").map(Number);
  return x > y ? 0 : x === y ? 1 : 2;
};
const oneX2 = (labels: [string, string, string] = ["1", "X", "2"]) =>
  labels.map((l, i) => ({ code: i === 0 ? "1" : i === 1 ? "X" : "2", label: l, short: l }));

function draftsFor(m: Match): Draft[] {
  const home = TEAMS[m.home].name;
  const away = TEAMS[m.away].name;
  const hs = TEAMS[m.home].abbr;
  const as = TEAMS[m.away].abbr;

  if (!isFootballLike(m)) {
    const { hcp, tot } = bbLines(m);
    return [
      { key: "ml", title: "Winner", group: "main", layout: "row", outs: [{ code: "1", label: home, short: "1" }, { code: "2", label: away, short: "2" }] },
      { key: "hcp", title: `Handicap (${signed(hcp)})`, group: "handicap", layout: "row", outs: [{ code: "H1", label: `${home} ${signed(hcp)}`, short: "Home" }, { code: "H2", label: `${away} ${signed(-hcp)}`, short: "Away" }] },
      { key: "tot", title: `Total points ${tot}`, group: "goals", layout: "row", outs: [{ code: "O", label: `Over ${tot}`, short: "Over" }, { code: "U", label: `Under ${tot}`, short: "Under" }] },
      { key: "oe", title: "Odd/Even total", group: "goals", layout: "row", outs: [{ code: "ODD", label: "Odd", short: "Odd" }, { code: "EVEN", label: "Even", short: "Even" }] },
    ];
  }

  const lines = (key: MarketKey, title: string, group: MarketGroup, set: number[], prefix = ""): Draft => ({
    key, title, group, layout: "table", columns: ["Over", "Under"],
    outs: set.flatMap((line) => [
      { code: `${prefix}O${line}`, label: `Over ${line}`, short: "Over", line },
      { code: `${prefix}U${line}`, label: `Under ${line}`, short: "Under", line },
    ]),
  });

  const handicap = (key: MarketKey, title: string, group: MarketGroup, set: number[]): Draft => ({
    key, title, group, layout: "table", columns: ["Home", "Draw", "Away"],
    outs: set.flatMap((line) =>
      ["H", "D", "A"].map((s) => ({
        code: `${s}${line}`, line,
        label: `${s === "H" ? home : s === "A" ? away : "Draw"} ${signed(line)}`,
        short: s === "H" ? "Home" : s === "A" ? "Away" : "Draw",
        column: s === "H" ? 0 : s === "D" ? 1 : 2,
      })),
    ),
  });

  /** Correct score: big two-column cards. Home wins first, then draws, then away wins (as on the big bookmakers). */
  const scores = (key: MarketKey, title: string, group: MarketGroup, set: string[], half = false): Draft => {
    const ordered = set;
    return {
      key, title, group, layout: "score", columns: [hs, "Draw", as],
      outs: [
        ...ordered.map((sc) => ({ code: sc, label: sc.replace(":", "-"), short: sc.replace(":", "-"), column: scoreColumn(sc) })),
        { code: "OTHER", label: "Other", short: "Other", column: -1 },
      ],
      hint: half ? "Scores are for the first half only." : undefined,
    };
  };

  return [
    /* ---------------- popular / match result ---------------- */
    { key: "1x2", title: "1X2 – Full Time Result", group: "popular", layout: "row", outs: oneX2() },
    { key: "dc", title: "Double Chance", group: "popular", layout: "row", outs: [{ code: "1X", label: "1X – Home or Draw", short: "1X" }, { code: "X2", label: "X2 – Draw or Away", short: "X2" }, { code: "12", label: "12 – Home or Away", short: "12" }] },
    { key: "ou_lines", title: "Total Goals – Over/Under", group: "popular", layout: "table", columns: ["Over", "Under"], outs: OU_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "btts", title: "Both Teams to Score (GG/NG)", group: "popular", layout: "row", outs: [{ code: "GG", label: "GG – Yes", short: "Yes" }, { code: "NG", label: "NG – No", short: "No" }] },
    scores("cs", "Correct Score", "popular", CS_SCORES),

    { key: "dnb", title: "Draw No Bet", group: "result", layout: "row", hint: "Your stake is returned if the match is drawn.", outs: [{ code: "1", label: `1 – ${home}`, short: home.slice(0, 7) }, { code: "2", label: `2 – ${away}`, short: away.slice(0, 7) }] },
    { key: "mw", title: "Match Winner (3-Way)", group: "result", layout: "row", outs: [{ code: "1", label: "Home", short: "Home" }, { code: "X", label: "Draw", short: "Draw" }, { code: "2", label: "Away", short: "Away" }] },
    { key: "team_win", title: "Team to Win", group: "result", layout: "row", outs: [{ code: "1", label: `${home} to win`, short: "Home" }, { code: "2", label: `${away} to win`, short: "Away" }] },
    { key: "oneup", title: "1X2 – 1UP", group: "result", layout: "row", hint: "The home team is given a 1-goal start.", outs: oneX2(["1 – Home +1", "X – Draw +1", "2 – Away +1"]) },
    { key: "twoup", title: "1X2 – 2UP", group: "result", layout: "row", hint: "The home team is given a 2-goal start.", outs: oneX2(["1 – Home +2", "X – Draw +2", "2 – Away +2"]) },
    { key: "neverdown", title: "1X2 – Never Down", group: "result", layout: "row", outs: [{ code: "1", label: "Home never behind", short: "Home" }, { code: "X", label: "Draw", short: "Draw" }, { code: "2", label: "Away wins", short: "Away" }] },

    /* ---------------- goals ---------------- */
    { key: "ttg", title: "Total Goals – Full Time", group: "goals", layout: "table", columns: ["Over", "Under"], outs: TTG_LINES.flatMap((line) => [{ code: `TO${line}`, label: `Over ${line}`, short: "Over", line }, { code: `TU${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "ou1h", title: "1st Half – Over/Under", group: "goals", layout: "table", columns: ["Over", "Under"], outs: OU1H_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "ou2h", title: "2nd Half – Over/Under", group: "goals", layout: "table", columns: ["Over", "Under"], outs: OU2H_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    lines("home_ou", `Home Team Goals – ${hs}`, "team", TEAM_OU_LINES),
    lines("away_ou", `Away Team Goals – ${as}`, "team", TEAM_OU_LINES),
    { key: "oe", title: "Odd/Even Total Goals", group: "goals", layout: "row", outs: [{ code: "ODD", label: "Odd", short: "Odd" }, { code: "EVEN", label: "Even", short: "Even" }] },
    { key: "btts1h", title: "Both Teams to Score – 1st Half", group: "btts", layout: "row", outs: [{ code: "GG", label: "Yes", short: "Yes" }, { code: "NG", label: "No", short: "No" }] },
    { key: "btts2h", title: "Both Teams to Score – 2nd Half", group: "btts", layout: "row", outs: [{ code: "GG", label: "Yes", short: "Yes" }, { code: "NG", label: "No", short: "No" }] },
    { key: "home_score", title: `${home} to Score`, group: "btts", layout: "row", outs: [{ code: "YES", label: "Yes", short: "Yes" }, { code: "NO", label: "No", short: "No" }] },
    { key: "away_score", title: `${away} to Score`, group: "btts", layout: "row", outs: [{ code: "YES", label: "Yes", short: "Yes" }, { code: "NO", label: "No", short: "No" }] },
    { key: "first_goal", title: "First Team to Score", group: "goals", layout: "row", outs: [{ code: "1", label: home, short: "Home" }, { code: "NONE", label: "No goal", short: "None" }, { code: "2", label: away, short: "Away" }] },
    { key: "last_goal", title: "Last Team to Score", group: "goals", layout: "row", outs: [{ code: "1", label: home, short: "Home" }, { code: "NONE", label: "No goal", short: "None" }, { code: "2", label: away, short: "Away" }] },
    { key: "goals_range", title: "Total Goals Range", group: "goals", layout: "row", outs: [{ code: "0-1", label: "0 – 1 goal", short: "0-1" }, { code: "2-3", label: "2 – 3 goals", short: "2-3" }, { code: "4-6", label: "4 – 6 goals", short: "4-6" }, { code: "7+", label: "7 or more", short: "7+" }] },
    { key: "home_oe", title: `${home} Goals Odd/Even`, group: "team", layout: "row", outs: [{ code: "ODD", label: "Odd", short: "Odd" }, { code: "EVEN", label: "Even", short: "Even" }] },
    { key: "away_oe", title: `${away} Goals Odd/Even`, group: "team", layout: "row", outs: [{ code: "ODD", label: "Odd", short: "Odd" }, { code: "EVEN", label: "Even", short: "Even" }] },

    /* ---------------- correct score ---------------- */
    scores("cs1h", "1st Half – Correct Score", "score", CS1H_SCORES, true),
    scores("cs2h", "2nd Half – Correct Score", "half2", CS1H_SCORES, true),

    /* ---------------- corners ---------------- */
    { key: "corners", title: "Total Match Corners", group: "corners", layout: "table", columns: ["Over", "Under"], outs: CORNER_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "corners_home", title: `${hs} Corners`, group: "corners", layout: "table", columns: ["Over", "Under"], outs: TEAM_CORNER_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "corners_away", title: `${as} Corners`, group: "corners", layout: "table", columns: ["Over", "Under"], outs: TEAM_CORNER_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "corners1h", title: "1st Half Corners", group: "corners", layout: "table", columns: ["Over", "Under"], outs: HALF_CORNER_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "corners2h", title: "2nd Half Corners", group: "corners", layout: "table", columns: ["Over", "Under"], outs: HALF_CORNER_LINES.flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },
    { key: "bookings", title: "Total Bookings (points)", group: "specials", layout: "table", columns: ["Over", "Under"], outs: [2.5, 3.5, 4.5, 5.5].flatMap((line) => [{ code: `O${line}`, label: `Over ${line}`, short: "Over", line }, { code: `U${line}`, label: `Under ${line}`, short: "Under", line }]) },

    /* ---------------- half time / second half ---------------- */
    { key: "ht", title: "Half Time Result", group: "half", layout: "row", outs: oneX2() },
    { key: "sh", title: "Second Half Result", group: "half2", layout: "row", outs: oneX2() },
    { key: "ht_dc", title: "Half Time Double Chance", group: "half", layout: "row", outs: [{ code: "1X", label: "1X", short: "1X" }, { code: "X2", label: "X2", short: "X2" }, { code: "12", label: "12", short: "12" }] },
    { key: "sh_dc", title: "Second Half Double Chance", group: "half2", layout: "row", outs: [{ code: "1X", label: "1X", short: "1X" }, { code: "X2", label: "X2", short: "X2" }, { code: "12", label: "12", short: "12" }] },
    { key: "htft", title: "Half Time / Full Time", group: "half", layout: "table", columns: ["Full time"], outs: (["1", "X", "2"] as const).flatMap((a1) => (["1", "X", "2"] as const).map((a2) => ({ code: `${a1}/${a2}`, label: `${a1} / ${a2}`, short: `${a1}/${a2}` }))) },
    { key: "oe1h", title: "1st Half Odd/Even", group: "half", layout: "row", outs: [{ code: "ODD", label: "Odd", short: "Odd" }, { code: "EVEN", label: "Even", short: "Even" }] },
    { key: "hcp1h", title: "1st Half Handicap", group: "half", layout: "table", columns: ["Home", "Draw", "Away"], outs: HCP1H_LINES.flatMap((line) => ["H", "D", "A"].map((s) => ({ code: `${s}${line}`, label: `${s === "H" ? hs : s === "A" ? as : "Draw"} ${signed(line)}`, short: s === "H" ? "Home" : s === "A" ? "Away" : "Draw", line, column: s === "H" ? 0 : s === "D" ? 1 : 2 }))) },

    /* ---------------- team goals & handicaps ---------------- */
    handicap("hcp_table", "Asian Handicap", "team", HCP_LINES),
    { key: "win_nil", title: "Win to Nil", group: "team", layout: "row", outs: [{ code: "1", label: `${home} to win to nil`, short: "Home" }, { code: "2", label: `${away} to win to nil`, short: "Away" }] },
    { key: "clean_sheet", title: "Clean Sheet", group: "team", layout: "row", outs: [{ code: "1", label: `${home} clean sheet`, short: "Home" }, { code: "2", label: `${away} clean sheet`, short: "Away" }] },
    { key: "score_both_halves", title: "Team to Score in Both Halves", group: "team", layout: "row", outs: [{ code: "1", label: home, short: "Home" }, { code: "2", label: away, short: "Away" }, { code: "BOTH", label: "Both teams", short: "Both" }, { code: "NONE", label: "Neither", short: "Neither" }] },

    /* ---------------- specials ---------------- */
    { key: "highest_half", title: "Highest Scoring Half", group: "specials", layout: "row", outs: [{ code: "1", label: "1st half", short: "1st" }, { code: "X", label: "Equal", short: "Equal" }, { code: "2", label: "2nd half", short: "2nd" }] },
    { key: "win_margin", title: "Winning Margin", group: "specials", layout: "row", outs: [{ code: "DRAW", label: "Draw", short: "Draw" }, { code: "H-1", label: `${home} by 1`, short: "H by 1" }, { code: "H-2", label: `${home} by 2`, short: "H by 2" }, { code: "H-3", label: `${home} by 3+`, short: "H by 3+" }, { code: "A-1", label: `${away} by 1`, short: "A by 1" }, { code: "A-2", label: `${away} by 2`, short: "A by 2" }, { code: "A-3", label: `${away} by 3+`, short: "A by 3+" }] },
  ];
}

export const CATALOG: Outcome[] = [];
export const MARKETS = new Map<string, Market[]>();
export const OUTCOME_BY_KEY = new Map<string, Outcome>();

for (const m of ALL_MATCHES) {
  const ms: Market[] = draftsFor(m).map((d) => {
    const outcomes = d.outs.map((o) => {
      const out: Outcome = {
        key: `${m.id}|${d.key}|${o.code}`,
        index: CATALOG.length,
        matchId: m.id,
        market: d.key,
        marketTitle: d.title,
        code: o.code,
        label: o.label,
        short: o.short,
        line: o.line,
        column: o.column,
      };
      CATALOG.push(out);
      OUTCOME_BY_KEY.set(out.key, out);
      return out;
    });
    return { key: d.key, title: d.title, group: d.group, layout: d.layout, columns: d.columns, hint: d.hint, outcomes };
  });
  MARKETS.set(m.id, ms);
}

export const marketFor = (matchId: string, key: MarketKey): Market => {
  const list = MARKETS.get(matchId) ?? [];
  return list.find((mk) => mk.key === key) ?? list[0];
};

export const primaryMarket = (m: Match) => marketFor(m.id, isFootballLike(m) ? "1x2" : "ml");

export const marketsFor = (matchId: string): Market[] => MARKETS.get(matchId) ?? [];

export const marketGroups: { key: MarketGroup | "all" | "fav"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fav", label: "My favourite" },
  { key: "popular", label: "Popular" },
  { key: "result", label: "Match Result" },
  { key: "goals", label: "Goals" },
  { key: "btts", label: "Both to Score" },
  { key: "score", label: "Correct Score" },
  { key: "corners", label: "Corners" },
  { key: "half", label: "Half-Time" },
  { key: "half2", label: "Second Half" },
  { key: "team", label: "Team Goals" },
  { key: "specials", label: "Special Markets" },
];

/* ------------------------------------------------------------------ */
/* pricing – every market in the competition spec                       */
/* ------------------------------------------------------------------ */

const MARGIN: Partial<Record<MarketKey, number>> = {
  "1x2": 1.065, dc: 1.06, dnb: 1.06, mw: 1.06, team_win: 1.06, htft: 1.1, ht: 1.08, sh: 1.08,
  btts: 1.06, btts1h: 1.07, btts2h: 1.07, home_score: 1.05, away_score: 1.05,
  ou: 1.06, ou_lines: 1.06, ttg: 1.06, ou1h: 1.07, ou2h: 1.07, home_ou: 1.07, away_ou: 1.07,
  cs: 1.22, cs1h: 1.24, cs2h: 1.24, ht_dc: 1.08, sh_dc: 1.06,
  corners: 1.08, corners_home: 1.08, corners_away: 1.08, corners1h: 1.09, corners2h: 1.09,
  first_goal: 1.08, last_goal: 1.08, oe: 1.07, home_oe: 1.08, away_oe: 1.08,
  win_nil: 1.08, clean_sheet: 1.07, highest_half: 1.1, win_margin: 1.1, goals_range: 1.08,
  score_both_halves: 1.1, bookings: 1.08, oneup: 1.06, twoup: 1.07, neverdown: 1.08,
  ml: 1.05, hcp: 1.05, tot: 1.05,
};

/** numbers embedded in a selection code, e.g. "O2.5" → 2.5, "T3.5" → 3.5 */
/** Longest price displayed per market. Longer prices are shown as unavailable instead of a silly number. */
const MAX_PRICE: Partial<Record<MarketKey, number>> = {
  ou_lines: 21, ttg: 21, ou1h: 17, ou2h: 17, home_ou: 17, away_ou: 17, corners: 21, corners_home: 17, corners_away: 17,
  corners1h: 13, corners2h: 13, htft: 51, hcp1h: 26, oe1h: 8, highest_half: 8, win_margin: 15, goals_range: 26,
  score_both_halves: 13, neverdown: 15, twoup: 26, hcp_table: 17, hcp: 8, btts: 7, "1x2": 17, dc: 6, dnb: 11, team_win: 11, mw: 17,
  first_goal: 11, last_goal: 11, home_oe: 7, away_oe: 7, win_nil: 13, clean_sheet: 7, oe: 7, ou: 15, ht: 11, sh: 11, ht_dc: 6, sh_dc: 6,
  bookings: 15, home_score: 6, away_score: 6, btts1h: 6, btts2h: 6, ml: 8, tot: 4, cs: 101, cs1h: 101, cs2h: 101,
};

const lineOf = (code: string) => {
  const n = Number(code.replace(/^[A-Z]+/, "").replace(/[A-Z]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const pct = (p: number) => (p >= 0.9995 ? 1 : p <= 0.0005 ? 0 : p);

function handProbability(sim: SimInput, model: FbModel, market: MarketKey, code: string): { p: number; decided?: "won" | "lost" } {
  void fbDetail;
  const [h, a] = model.score;
  const total = h + a;
  const remTotal = model.remH + model.remA;
  const { grid } = goalGrid(model);
  const half = model.half;

  /* ---------- decided outcomes ---------- */
  if (model.phase === "ft") {
    const done = (hit: boolean): { p: number; decided: "won" | "lost" } => ({ p: hit ? 1 : 0, decided: hit ? "won" : "lost" });
    const fh = half.h;
    const fa = half.a;
    const htres = fh > fa ? "1" : fh === fa ? "X" : "2";
    const second: [number, number] = [h - fh, a - fa];
    const shres = second[0] > second[1] ? "1" : second[0] === second[1] ? "X" : "2";
    switch (market) {
      case "1x2": case "mw": return done(code === "1" ? h > a : code === "X" ? h === a : a > h);
      case "team_win": return done(code === "1" ? h > a : a > h);
      case "oneup": return done(code === "1" ? h + 1 > a : code === "X" ? h + 1 === a : a > h + 1);
      case "twoup": return done(code === "1" ? h + 2 > a : code === "X" ? h + 2 === a : a > h + 2);
      case "neverdown": return done(code === "1" ? h >= a : code === "2" ? a > h : false);
      case "dc": return done(code === "1X" ? h >= a : code === "X2" ? a >= h : h !== a);
      case "ht_dc": return done(code === "1X" ? fh >= fa : code === "X2" ? fa >= fh : fh !== fa);
      case "sh_dc": return done(code === "1X" ? second[0] >= second[1] : code === "X2" ? second[1] >= second[0] : second[0] !== second[1]);
      case "dnb": return done(code === "1" ? h > a : a > h);
      case "ht": return done(code === htres);
      case "sh": return done(code === shres);
      case "htft": return done(code === `${htres}/${h > a ? "1" : h === a ? "X" : "2"}`);
      case "btts": return done(code === "GG" ? h > 0 && a > 0 : !(h > 0 && a > 0));
      case "btts1h": return done(code === "GG" ? fh > 0 && fa > 0 : !(fh > 0 && fa > 0));
      case "btts2h": return done(code === "GG" ? second[0] > 0 && second[1] > 0 : !(second[0] > 0 && second[1] > 0));
      case "home_score": return done(code === "YES" ? h > 0 : h === 0);
      case "away_score": return done(code === "YES" ? a > 0 : a === 0);
      case "oe": return done(code === "ODD" ? total % 2 === 1 : total % 2 === 0);
      case "home_oe": return done(code === "ODD" ? h % 2 === 1 : h % 2 === 0);
      case "away_oe": return done(code === "ODD" ? a % 2 === 1 : a % 2 === 0);
      case "ou": case "ou_lines": case "ttg": {
        const line = code.startsWith("T") ? lineOf(code) : /[OU]\d/.test(code) ? lineOf(code) : 2.5;
        return done(code.includes("O") ? total > line : total < line);
      }
      case "ou1h": return done(code.startsWith("O") ? fh + fa > lineOf(code) : fh + fa < lineOf(code));
      case "ou2h": return done(code.startsWith("O") ? second[0] + second[1] > lineOf(code) : second[0] + second[1] < lineOf(code));
      case "home_ou": return done(code.startsWith("O") ? h > lineOf(code) : h < lineOf(code));
      case "away_ou": return done(code.startsWith("O") ? a > lineOf(code) : a < lineOf(code));
      case "hcp":
      case "hcp_table": {
        const line = code[0] === "H" || code[0] === "D" || code[0] === "A" ? lineOf(code) : 0;
        const diff = h + line - a;
        const sel = code[0];
        if (market === "hcp") return done(sel === "H1" ? diff > 0 : diff < 0);
        return done(sel === "D" ? diff === 0 : sel === "H" ? diff > 0 : diff < 0);
      }
      case "tot": return done(code === "O" ? total > (m0Tot(model) || 0) : total < (m0Tot(model) || 0));
      case "win_nil": return done(code === "1" ? a === 0 && h > a : h === 0 && a > h);
      case "clean_sheet": return done(code === "1" ? a === 0 : h === 0);
      case "highest_half": return done(code === "1" ? fh + fa > second[0] + second[1] : code === "2" ? second[0] + second[1] > fh + fa : fh + fa === second[0] + second[1]);
      case "win_margin": {
        const m = h - a;
        if (code === "DRAW") return done(m === 0);
        const [side, n] = code.split("-");
        return done(side === "H" ? m === Number(n) : m === -Number(n));
      }
      case "goals_range": return done(rangeHit(code, total));
      case "cs": return done(csHit(code, CS_SCORES, h, a));
      case "cs1h": return done(csHit(code, CS1H_SCORES, fh, fa));
      case "cs2h": return done(csHit(code, CS1H_SCORES, second[0], second[1]));
      case "highest_half": break;
      case "score_both_halves": return done(code === "1" ? fh > 0 && second[0] > 0 : code === "2" ? fa > 0 && second[1] > 0 : code === "BOTH" ? fh > 0 && second[0] > 0 && fa > 0 && second[1] > 0 : !((fh > 0 || fa > 0) && (second[0] > 0 || second[1] > 0)));
      case "last_goal": {
        const gs = fbDetail(sim).goals;
        const lastG = gs.length ? gs[gs.length - 1].side : null;
        return done(code === "NONE" ? lastG === null : code === "1" ? lastG === 0 : lastG === 1);
      }
      case "first_goal": {
        const fg = half.firstGoal;
        return done(code === "NONE" ? fg === null : code === "1" ? fg === 0 : fg === 1);
      }
      case "corners": { const d = fbDetail(sim); return done(code.startsWith("O") ? d.corners.length > lineOf(code) : d.corners.length < lineOf(code)); }
      case "corners_home": { const d = fbDetail(sim); const n = d.corners.filter((c) => c.side === 0).length; return done(code.startsWith("O") ? n > lineOf(code) : n < lineOf(code)); }
      case "corners_away": { const d = fbDetail(sim); const n = d.corners.filter((c) => c.side === 1).length; return done(code.startsWith("O") ? n > lineOf(code) : n < lineOf(code)); }
      case "corners1h": { const d = fbDetail(sim); const n = d.corners.filter((c) => c.half === 1).length; return done(code.startsWith("O") ? n > lineOf(code) : n < lineOf(code)); }
      case "corners2h": { const d = fbDetail(sim); const n = d.corners.filter((c) => c.half === 2).length; return done(code.startsWith("O") ? n > lineOf(code) : n < lineOf(code)); }
      case "bookings": { const d = fbDetail(sim); const n = d.bookings.reduce((a, b) => a + b.pts, 0); return done(code.startsWith("O") ? n > lineOf(code) : n < lineOf(code)); }
      case "oe1h": return done(code === "ODD" ? (fh + fa) % 2 === 1 : (fh + fa) % 2 === 0);
      case "hcp1h": { const line = lineOf(code); const d = fh + line - fa; const sel = code[0]; return done(sel === "D" ? d === 0 : sel === "H" ? d > 0 : d < 0); }
      default: break;
    }
  }
  void total; void remTotal;

  /* ---------- first half markets freeze once the half is over ---------- */
  const firstHalfMarkets: MarketKey[] = ["cs1h", "btts1h", "ou1h", "corners1h", "first_goal", "bookings"];
  void firstHalfMarkets;

  /* ---------- probability tables ---------- */
  const sum = (fn: (fh: number, fa: number, g: number) => number | boolean) => {
    let out = 0;
    for (let x = 0; x < grid.length; x++) for (let y = 0; y < grid[x].length; y++) { const v = fn(h + x, a + y, grid[x][y]); if (typeof v === "boolean") { if (v) out += grid[x][y]; } else out += v; }
    return out;
  };
  const { grid: hgrid } = halfGrid(model);
  const halfSum = (fn: (fh: number, fa: number) => boolean) => {
    let out = 0;
    for (let x = 0; x < hgrid.length; x++) for (let y = 0; y < hgrid[x].length; y++) if (fn(half.h + x, half.a + y)) out += hgrid[x][y];
    return out;
  };
  /* goals still to come in the 2nd half */
  const shStart: [number, number] = model.period === "H1" ? [0, 0] : [h - half.h, a - half.a];
  const shSum = (fn: (fh: number, fa: number) => boolean) => {
    let out = 0;
    for (let x = 0; x <= 12; x++) for (let y = 0; y <= 12; y++) if (fn(shStart[0] + x, shStart[1] + y)) out += poisson(x, model.shRemH) * poisson(y, model.shRemA);
    return out;
  };
  let p = 0;
  switch (market) {
    case "1x2": case "mw": case "dc": case "dnb": case "team_win": case "oneup": case "twoup": case "neverdown": {
      p = sum((fh, fa) => {
        const d = fh - fa;
        if (market === "team_win") return code === "1" ? d > 0 : d < 0;
        if (market === "dnb") return d !== 0 && (code === "1" ? d > 0 : d < 0);
        if (market === "dc") return code === "1X" ? d >= 0 : code === "X2" ? d <= 0 : d !== 0;
        if (market === "oneup") { const x = d + 1; return code === "1" ? x > 0 : code === "X" ? x === 0 : x < 0; }
        if (market === "twoup") { const x = d + 2; return code === "1" ? x > 0 : code === "X" ? x === 0 : x < 0; }
        if (market === "neverdown") return code === "1" ? d >= 0 : code === "2" ? d < 0 : false;
        return code === "1" ? d > 0 : code === "X" ? d === 0 : d < 0;
      });
      if (market === "dnb") { const p1 = sum((fh, fa) => fh > fa); const p2 = sum((fh, fa) => fa > fh); p = p1 + p2 ? (code === "1" ? p1 : p2) / (p1 + p2) : 0.5; }
      break;
    }
    case "btts": p = sum((fh, fa) => (code === "GG" ? fh > 0 && fa > 0 : !(fh > 0 && fa > 0))); break;
    case "home_score": p = sum((fh) => (code === "YES" ? fh > 0 : fh === 0)); break;
    case "away_score": p = sum((_fh, fa) => (code === "YES" ? fa > 0 : fa === 0)); break;
    case "ou": case "ou_lines": case "ttg": {
      const line = /[OU]\d/.test(code) || code.startsWith("T") ? lineOf(code) : 2.5;
      p = sum((fh, fa) => (code.includes("O") ? fh + fa > line : fh + fa < line));
      break;
    }
    case "home_ou": { const line = lineOf(code); p = sum((fh) => (code.startsWith("O") ? fh > line : fh < line)); break; }
    case "away_ou": { const line = lineOf(code); p = sum((_fh, fa) => (code.startsWith("O") ? fa > line : fa < line)); break; }
    case "cs": p = sum((fh, fa) => csHit(code, CS_SCORES, fh, fa)); break;
    case "oe": p = sum((fh, fa) => (code === "ODD" ? (fh + fa) % 2 === 1 : (fh + fa) % 2 === 0)); break;
    case "home_oe": p = sum((fh) => (code === "ODD" ? fh % 2 === 1 : fh % 2 === 0)); break;
    case "away_oe": p = sum((_fh, fa) => (code === "ODD" ? fa % 2 === 1 : fa % 2 === 0)); break;
    case "hcp_table": case "hcp": {
      const line = lineOf(code);
      const sel = code[0];
      p = sum((fh, fa) => { const v = fh + line - fa; return market === "hcp" ? (sel === "H" ? v > 0 : v < 0) : sel === "D" ? v === 0 : sel === "H" ? v > 0 : v < 0; });
      break;
    }

    case "win_nil": p = sum((fh, fa) => (code === "1" ? fa === 0 && fh > fa : fh === 0 && fa > fh)); break;
    case "clean_sheet": p = sum((fh, fa) => (code === "1" ? fa === 0 : fh === 0)); break;
    case "highest_half": {
      const h1 = half.remH + half.remA;
      const homeRem = model.shRemH + model.shRemA;
      p = 0;
      for (let x = 0; x <= 10; x++) for (let y = 0; y <= 10; y++) {
        const g1 = poisson(x, h1) * poisson(y, homeRem);
        const fh = half.h + x;
        const fa = half.a + y;
        const s1 = fh + fa;
        const s2 = h - half.h + (x - (fh - h)) + (a - half.a) + (y - (fa - a));
        void s2;
        const second = (h - fh) + (a - fa);
        if ((code === "1" && s1 > second) || (code === "2" && second > s1) || (code === "X" && s1 === second)) p += g1;
      }
      break;
    }
    case "win_margin": {
      p = sum((fh, fa) => {
        const d = fh - fa;
        if (code === "DRAW") return d === 0;
        const [side, n] = code.split("-");
        return side === "H" ? d === Number(n) : d === -Number(n);
      });
      break;
    }
    case "goals_range": p = sum((fh, fa) => rangeHit(code, fh + fa)); break;
    case "score_both_halves": p = halfSum((fh, fa) => {
      const sh: [number, number] = [h - fh, a - fa];
      if (code === "1") return fh > 0 && sh[0] > 0;
      if (code === "2") return fa > 0 && sh[1] > 0;
      if (code === "BOTH") return fh > 0 && sh[0] > 0 && fa > 0 && sh[1] > 0;
      return !((fh > 0 || fa > 0) && (sh[0] > 0 || sh[1] > 0));
    }); break;

    /* ---------------- half-time ---------------- */
    case "ht": p = halfSum((fh, fa) => (code === "1" ? fh > fa : code === "X" ? fh === fa : fa > fh)); break;
    case "ht_dc": p = halfSum((fh, fa) => (code === "1X" ? fh >= fa : code === "X2" ? fa >= fh : fh !== fa)); break;
    case "cs1h": p = halfSum((fh, fa) => csHit(code, CS1H_SCORES, fh, fa)); break;
    case "btts1h": p = halfSum((fh, fa) => (code === "GG" ? fh > 0 && fa > 0 : !(fh > 0 && fa > 0))); break;
    case "ou1h": { const line = lineOf(code); p = halfSum((fh, fa) => (code.startsWith("O") ? fh + fa > line : fh + fa < line)); break; }
    case "first_goal": {
      if (model.half.firstGoal !== null) return { p: (code === "1" && model.half.firstGoal === 0) || (code === "2" && model.half.firstGoal === 1) ? 1 : 0, decided: "won" };
      const lam = model.half.remH + model.half.remA;
      const pNone = Math.exp(-lam);
      if (code === "NONE") p = pNone;
      else p = code === "1" ? (1 - pNone) * (lam ? model.half.remH / lam : 0.5) : (1 - pNone) * (lam ? model.half.remA / lam : 0.5);
      break;
    }
    case "corners1h": { const line = lineOf(code); p = 0; const lam = (model.cornRem[0] + model.cornRem[1]) * 0.45; for (let k = 0; k <= 30; k++) { const pr = poisson(k, lam); if (code.startsWith("O") ? k > line : k < line) p += pr; } break; }

    /* ---------------- second half ---------------- */
    case "sh": p = shSum((fh, fa) => (code === "1" ? fh > fa : code === "X" ? fh === fa : fa > fh)); break;
    case "sh_dc": p = shSum((fh, fa) => (code === "1X" ? fh >= fa : code === "X2" ? fa >= fh : fh !== fa)); break;
    case "btts2h": p = shSum((fh, fa) => (code === "GG" ? fh > 0 && fa > 0 : !(fh > 0 && fa > 0))); break;
    case "ou2h": { const line = lineOf(code); p = shSum((fh, fa) => (code.startsWith("O") ? fh + fa > line : fh + fa < line)); break; }
    case "cs2h": p = shSum((fh, fa) => csHit(code, CS1H_SCORES, fh, fa)); break;
    case "corners2h": { const line = lineOf(code); p = 0; const lam = (model.cornRem[0] + model.cornRem[1]) * 0.55; for (let k = 0; k <= 30; k++) { const pr = poisson(k, lam); if (code.startsWith("O") ? k > line : k < line) p += pr; } break; }
    case "htft": {
      const [wantHT, wantFT] = code.split("/");
      p = halfSum((fh, fa) => {
        const thisHT = fh > fa ? "1" : fh === fa ? "X" : "2";
        if (thisHT !== wantHT) return false;
        let second = 0;
        for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
          const pr = poisson(x, model.shRemH) * poisson(y, model.shRemA);
          const gh = fh + x;
          const ga = fa + y;
          const res = gh > ga ? "1" : gh === ga ? "X" : "2";
          if (res === wantFT) second += pr;
        }
        // fold the second-half probability into the first-half weight
        return second > 0;
      }) * (model.shRemH + model.shRemA >= 0 ? 1 : 1);
      // exact HT/FT probability = Σ P(HT score) × P(FT result | that HT score)
      p = 0;
      for (let x1 = 0; x1 <= 6; x1++) for (let y1 = 0; y1 <= 6; y1++) {
        const fh = half.h + x1;
        const fa = half.a + y1;
        const pHalf = poisson(x1, half.remH) * poisson(y1, half.remA);
        if ((fh > fa ? "1" : fh === fa ? "X" : "2") !== wantHT) continue;
        let second = 0;
        for (let x2 = 0; x2 <= 8; x2++) for (let y2 = 0; y2 <= 8; y2++) {
          const gh = fh + x2;
          const ga = fa + y2;
          const pr = poisson(x2, model.shRemH) * poisson(y2, model.shRemA);
          if ((gh > ga ? "1" : gh === ga ? "X" : "2") === wantFT) second += pr;
        }
        p += pHalf * second;
      }
      break;
    }
    case "last_goal": {
      const lam = model.remH + model.remA;
      const pNone = Math.exp(-lam);
      p = code === "NONE" ? pNone : code === "1" ? (1 - pNone) * (lam ? model.remH / lam : 0.5) : (1 - pNone) * (lam ? model.remA / lam : 0.5);
      break;
    }

    /* ---------------- corners ---------------- */
    case "corners": {
      const line = lineOf(code);
      p = 0;
      const lam = model.cornRem[0] + model.cornRem[1];
      for (let k = 0; k <= 40; k++) { const pr = poisson(k, lam); if (code.startsWith("O") ? k > line : k < line) p += pr; }
      break;
    }
    case "corners_home": case "corners_away": {
      const line = lineOf(code);
      const lam = market === "corners_home" ? model.cornRem[0] : model.cornRem[1];
      p = 0;
      for (let k = 0; k <= 30; k++) { const pr = poisson(k, lam); if (code.startsWith("O") ? k > line : k < line) p += pr; }
      break;
    }
    case "bookings": { const line = lineOf(code); const lam = 3.2; p = 0; for (let k = 0; k <= 30; k++) { const pr = poisson(k, lam); if (code.startsWith("O") ? k > line : k < line) p += pr; } break; }
    default: break;
  }
  p = pct(p);
  /* genuinely decided live outcomes */
  if (market === "btts" && h > 0 && a > 0) return code === "GG" ? { p: 1, decided: "won" } : { p: 0, decided: "lost" };
  if (market === "home_score" && h > 0) return code === "YES" ? { p: 1, decided: "won" } : { p: 0, decided: "lost" };
  if (market === "away_score" && a > 0) return code === "YES" ? { p: 1, decided: "won" } : { p: 0, decided: "lost" };
  if (market === "ou" || market === "ou_lines" || market === "ttg") {
    const line = /[OU]\d/.test(code) || code.startsWith("T") ? lineOf(code) : 2.5;
    if (total > line) return code.includes("O") ? { p: 1, decided: "won" } : { p: 0, decided: "lost" };
  }
  if (market === "neverdown" && code === "1") {
    const detail = fbDetail(sim);
    let hh = 0;
    let aa = 0;
    for (const g of detail.goals) {
      if (g.side === 0) hh++;
      else aa++;
      if (aa > hh) return { p: 0, decided: "lost" };
    }
  }
  if (market === "cs" && code !== "OTHER" && code !== "other") {
    const [th, ta] = code.split(":").map(Number);
    if (h > th || a > ta) return { p: 0, decided: "lost" };
  }
  if ((market === "cs1h" || market === "btts1h" || market === "ou1h" || market === "ht" || market === "ht_dc" || market === "first_goal" || market === "htft") && !half.open) {
    /* decided when the first half is over */
    const fh = half.h;
    const fa = half.a;
    const hit =
      market === "cs1h" ? csHit(code, CS1H_SCORES, fh, fa)
      : market === "btts1h" ? (code === "GG" ? fh > 0 && fa > 0 : !(fh > 0 && fa > 0))
      : market === "ou1h" ? (code.startsWith("O") ? fh + fa > lineOf(code) : fh + fa < lineOf(code))
      : market === "ht" ? (code === "1" ? fh > fa : code === "X" ? fh === fa : fa > fh)
      : market === "ht_dc" ? (code === "1X" ? fh >= fa : code === "X2" ? fa >= fh : fh !== fa)
      : market === "first_goal" ? (code === "NONE" ? half.firstGoal === null : code === "1" ? half.firstGoal === 0 : half.firstGoal === 1)
      : false;
    if (market !== "htft") return { p: hit ? 1 : 0, decided: hit ? "won" : "lost" };
  }
  return { p };
}

/** total-points line for basketball (kept out of the football path) */
function m0Tot(model: FbModel) { return (model as FbModel & { tot?: number }).tot ?? 0; }
function rangeHit(code: string, total: number) {
  if (code === "0-1") return total <= 1;
  if (code === "2-3") return total >= 2 && total <= 3;
  if (code === "4-6") return total >= 4 && total <= 6;
  if (code === "7+") return total >= 7;
  return false;
}

function quote(sim: SimInput, market: MarketKey, code: string, now: number): Price {
  const st = liveState(sim, now);
  const model = fbModel(sim, now);
  if (model) {
    const r = handProbability(sim, model, market, code);
    if (r.decided) return { odds: 1.01, locked: true, settled: r.decided };
    const halfLocked = HALF_MARKETS.includes(market) && !model.half.open;
    // "Other" covers many possible scores, so its fair price is naturally short – price it without the long-shot ceiling
    const price = toOdds(r.p, MARGIN[market] ?? 1.07);
    const maxPrice = MAX_PRICE[market] ?? 250;
    // in-play totals are only offered while they can still realistically change
    const lowLimit = (market === "ou_lines" || market === "ttg") && model.phase === "live" ? 1.02 : 1.01;
    const capped = price > maxPrice || price <= lowLimit;
    // the catch-all "Other" covers every unlisted score, so it is never treated as too unlikely
    const isOther = (market === "cs" || market === "cs1h" || market === "cs2h") && (code === "OTHER" || code === "other");
    // Long prices are simply capped at the bookmaker limit and stay clickable.
    // A padlock is reserved for a genuine suspension (or a finished market), never just a long price.
    return {
      odds: isOther ? Math.min(price, 40) : capped ? maxPrice : price,
      locked: st.suspended || st.phase === "ft" || halfLocked,
      capped,
    };
  }
  const p = probsAt(sim, now)[code] ?? 0;
  if (st.phase === "ft") return { odds: toOdds(p, MARGIN[market] ?? 1.05), locked: true, settled: p >= 0.5 ? "won" : "lost" };
  return { odds: toOdds(p, MARGIN[market] ?? 1.05), locked: st.suspended };
}

export function priceSim(sim: SimInput, market: MarketKey, code: string, now: number): Price {
  return quote(sim, market, code, now);
}

export function priceOf(o: Outcome, now: number): Price {
  const m = MATCH_BY_ID.get(o.matchId);
  if (!m) return { odds: 0, locked: true };
  return quote({ seed: m.seed, sport: m.sport, kickoff: m.kickoff, str: m.str }, o.market, o.code, now);
}

/** For cash-out / settlement: has this selection already been decided? */
export function legProbability(sim: SimInput, market: MarketKey, code: string, now: number): { p: number; locked: boolean; settled?: "won" | "lost" } {
  const st = liveState(sim, now);
  const model = fbModel(sim, now);
  if (model) {
    const r = handProbability(sim, model, market, code);
    if (r.decided) return { p: r.p, locked: true, settled: r.decided };
    const halfLocked = HALF_MARKETS.includes(market) && !model.half.open;
    return { p: r.p, locked: st.suspended || halfLocked };
  }
  const p = probsAt(sim, now)[code] ?? 0;
  if (st.phase === "ft") return { p: p >= 0.5 ? 1 : 0, locked: true, settled: p >= 0.5 ? "won" : "lost" };
  return { p, locked: st.suspended };
}

/* ------------------------------------------------------------------ */
/* list helpers                                                         */
/* ------------------------------------------------------------------ */

export function predictionFor(m: Match): { outcome: Outcome; confidence: number; odds: number } {
  const mk = marketFor(m.id, isFootballLike(m) ? "1x2" : "ml");
  const pre = m.kickoff - 60_000;
  const priced = mk.outcomes.map((o) => ({ o, ...priceOf(o, pre) }));
  const best = priced.reduce((a, b) => (b.odds < a.odds ? b : a));
  const confidence = Math.min(94, Math.round((1 / best.odds) * 100 * 1.05 + hash01(m.id + ":ai") * 8));
  return { outcome: best.o, confidence, odds: best.odds };
}

export function chipsFor(sport: SportKey): { key: MarketKey; label: string }[] {
  if (sport === "football" || sport === "v-football") {
    return [
      { key: "1x2", label: "1X2" },
      { key: "dc", label: "Double Chance" },
      { key: "ou", label: "Over/Under" },
      { key: "btts", label: "GG/NG" },
    ];
  }
  return [
    { key: "ml", label: "Winner" },
    { key: "hcp", label: "Handicap" },
    { key: "tot", label: "Total Points" },
  ];
}

const BOOST_TABLE = [0, 0, 3, 5, 8, 10, 12, 13, 15, 18, 20];
export const boostFor = (n: number) => (n >= BOOST_TABLE.length ? 0.2 : BOOST_TABLE[n] / 100);
export const MAX_SELECTIONS = 30;
export const minStake = () => sc(1);
export const maxStake = () => sc(50_000);
export const maxWin = () => sc(500_000);
