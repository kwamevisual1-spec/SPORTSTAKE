/**
 * Real-time match engine.
 *
 * Every fixture is described by a small `SimInput` (seed, sport, kickoff, strengths).
 * From that alone we can compute – for any timestamp – the clock, period, score,
 * suspensions and fair probabilities. Because it is a pure function of the input,
 * bets can be settled later from the data stored on the bet itself.
 *
 * NOTE: this replaces a real odds/results feed. When a backend + data provider is
 * connected, `liveState` and `probsAt` are the two functions to swap out.
 */

export type SportKind = "football" | "v-football" | "basketball" | "v-basketball";

export type SimInput = {
  seed: string;
  sport: SportKind;
  kickoff: number;
  /** football: expected goals (home, away) · basketball: expected points */
  str: [number, number];
};

export type LiveState = {
  phase: "pre" | "live" | "ft";
  /** H1 · HT · H2 · Q1–Q4 · Break · FT */
  period: string;
  /** running clock text, e.g. "61:23", "45+2'", "Q2 06:12" */
  clock: string;
  /** compact label for lists, e.g. "H2 61:23" */
  label: string;
  /** displayed game minute (football) / played minutes (basketball) */
  minute: number;
  /** share of the game still to play (1 = not started, 0 = finished) */
  remaining: number;
  score: [number, number];
  suspended: boolean;
  goalAt: number | null;
  goalSide: 0 | 1 | null;
  endsAt: number;
};

const MIN = 60_000;

/* ------------------------------------------------------------------ */
/* deterministic randomness                                            */
/* ------------------------------------------------------------------ */

export function hash01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

function rng(seed: string) {
  let a = Math.floor(hash01(seed) * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poissonSample(lambda: number, r: () => number) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 12);
  return k - 1;
}

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");
const mmss = (m: number) => `${pad(m)}:${pad((m % 1) * 60)}`;

/* ------------------------------------------------------------------ */
/* football timeline                                                   */
/* ------------------------------------------------------------------ */

export type FbGoal = { gt: number; side: 0 | 1 };
type FbDetail = { corners: { t: number; side: 0 | 1 }[]; bookings: { t: number; side: 0 | 1; pts: number }[] };
type FbTimeline = { s1: number; s2: number; ht: number; speed: number; goals: FbGoal[]; detail: FbDetail };
const fbCache = new Map<string, FbTimeline>();

/** Full match detail (goals, corners, bookings) from one seed – used to settle every market. */
export function fbDetail(sim: SimInput) {
  const tl = fbTimeline(sim);
  return {
    s1: tl.s1,
    s2: tl.s2,
    h1End: 45 + tl.s1,
    ht: tl.ht,
    end: 45 + tl.s1 + tl.ht + 45 + tl.s2,
    goals: tl.goals.map((g) => ({ ...g, half: (g.gt < 45 + tl.s1 ? 1 : 2) as 1 | 2, minute: g.gt < 45 + tl.s1 ? g.gt : 45 + (g.gt - (45 + tl.s1)) })),
    corners: tl.detail.corners.map((c) => ({ ...c, half: (c.t < 45 + tl.s1 ? 1 : 2) as 1 | 2 })),
    bookings: tl.detail.bookings.map((b) => ({ ...b, half: (b.t < 45 + tl.s1 ? 1 : 2) as 1 | 2 })),
  };
}

function fbTimeline(sim: SimInput): FbTimeline {
  const key = `${sim.seed}|${sim.sport}`;
  const hit = fbCache.get(key);
  if (hit) return hit;
  const virtual = sim.sport === "v-football";
  const r = rng(`${sim.seed}:timeline`);
  const s1 = virtual ? 0 : 1 + Math.floor(r() * 3);
  const s2 = virtual ? 0 : 2 + Math.floor(r() * 4);
  const total = 90 + s1 + s2;
  const goals: FbGoal[] = [];
  ([0, 1] as const).forEach((side) => {
    const n = poissonSample(sim.str[side], r);
    for (let i = 0; i < n; i++) goals.push({ gt: Math.max(0.6, r() * total), side });
  });
  goals.sort((a, b) => a.gt - b.gt);
  // corners & bookings, seeded so they are stable and settleable
  const rd = rng(`${sim.seed}:detail`);
  const cornerCount = 7 + Math.floor(rd() * 8);
  const corners = Array.from({ length: cornerCount }, () => ({ t: Math.max(0.4, rd() * total), side: (rd() < 0.53 ? 0 : 1) as 0 | 1 })).sort((a, b) => a.t - b.t);
  const bookingCount = 1 + Math.floor(rd() * 5);
  const bookings = Array.from({ length: bookingCount }, () => ({ t: Math.max(0.4, rd() * total), side: (rd() < 0.5 ? 0 : 1) as 0 | 1, pts: rd() < 0.12 ? 10 : 1 })).sort((a, b) => a.t - b.t);
  const tl: FbTimeline = { s1, s2, ht: virtual ? 0 : 15, speed: virtual ? 30 : 1, goals, detail: { corners, bookings } };
  fbCache.set(key, tl);
  return tl;
}

/** Kickoff timestamp so that the match shows `minute` (or half-time) at `now`. */
export function kickoffAt(sim: Omit<SimInput, "kickoff">, minute: number | "HT", now: number): number {
  if (sim.sport === "basketball" || sim.sport === "v-basketball") {
    const p = minute === "HT" ? 22 + 3 : minute;
    const t = p < 10 ? p : p < 20 ? p + 2 : p < 30 ? p + 12 : p + 14;
    return now - t * MIN;
  }
  const tl = fbTimeline({ ...sim, kickoff: 0 });
  const h1End = 45 + tl.s1;
  const t = minute === "HT" ? h1End + 6 : minute <= 45 ? minute : h1End + tl.ht + (minute - 45);
  return now - (t / tl.speed) * MIN;
}

function footballState(sim: SimInput, now: number): LiveState {
  const tl = fbTimeline(sim);
  const virtual = sim.sport === "v-football";
  const t = ((now - sim.kickoff) / MIN) * tl.speed;
  const h1End = 45 + tl.s1;
  const htEnd = h1End + tl.ht;
  const end = htEnd + 45 + tl.s2;
  const playTotal = 90 + tl.s1 + tl.s2;
  const endsAt = sim.kickoff + (end / tl.speed) * MIN;

  if (t < 0) {
    return { phase: "pre", period: "", clock: "", label: "", minute: 0, remaining: 1, score: [0, 0], suspended: false, goalAt: null, goalSide: null, endsAt };
  }

  let played: number;
  let period: string;
  if (t < h1End) {
    period = "H1";
    played = t;
  } else if (t < htEnd) {
    period = "HT";
    played = h1End;
  } else if (t < end) {
    period = "H2";
    played = h1End + (t - htEnd);
  } else {
    period = "FT";
    played = playTotal;
  }

  const score: [number, number] = [0, 0];
  let last: { gt: number; side: 0 | 1 } | null = null;
  for (const g of tl.goals) {
    if (g.gt > played) break;
    score[g.side]++;
    last = g;
  }

  const dm = period === "H1" ? played : period === "H2" ? 45 + (played - h1End) : period === "HT" ? 45 : 90;
  let clock: string;
  if (period === "FT") clock = "FT";
  else if (period === "HT") clock = "HT";
  else if (virtual) clock = `${Math.min(90, Math.floor(dm) + 1)}'`;
  else if (period === "H1") clock = played < 45 ? mmss(played) : `45+${Math.ceil(played - 45)}'`;
  else clock = dm < 90 ? mmss(dm) : `90+${Math.ceil(dm - 90)}'`;
  const label = period === "FT" ? "FT" : period === "HT" ? "Half time" : virtual ? clock : `${period} ${clock}`;

  const goalAt = last ? sim.kickoff + ((last.gt < h1End ? last.gt : last.gt + tl.ht) / tl.speed) * MIN : null;
  const goalLock = virtual ? 4_000 : 60_000;
  const sinceKick = now - sim.kickoff;
  const minuteIdx = Math.floor(sinceKick / MIN);
  const danger = !virtual && period !== "HT" && hash01(`${sim.seed}:danger:${minuteIdx}`) < 0.07 && sinceKick % MIN < 25_000;
  const suspended = period === "FT" || (goalAt !== null && now - goalAt < goalLock) || danger;

  return {
    phase: period === "FT" ? "ft" : "live",
    period,
    clock,
    label,
    minute: dm,
    remaining: Math.max(0, playTotal - played) / 90,
    score,
    suspended,
    goalAt,
    goalSide: last ? last.side : null,
    endsAt,
  };
}

/** Goals scored so far, for the match timeline. */
export function goalEvents(sim: SimInput, now: number): { minute: string; side: 0 | 1 }[] {
  if (sim.sport !== "football" && sim.sport !== "v-football") return [];
  const tl = fbTimeline(sim);
  const st = footballState(sim, now);
  if (st.phase === "pre") return [];
  const h1End = 45 + tl.s1;
  const played = st.period === "H1" ? ((now - sim.kickoff) / MIN) * tl.speed : st.period === "HT" ? h1End : st.period === "H2" ? h1End + (((now - sim.kickoff) / MIN) * tl.speed - h1End - tl.ht) : 999;
  return tl.goals
    .filter((g) => g.gt <= played)
    .map((g) => {
      const dm = g.gt < h1End ? g.gt : 45 + (g.gt - h1End);
      const half1 = g.gt < h1End;
      const label = half1 && dm > 45 ? `45+${Math.ceil(dm - 45)}'` : !half1 && dm > 90 ? `90+${Math.ceil(dm - 90)}'` : `${Math.ceil(dm)}'`;
      return { minute: label, side: g.side };
    });
}

/* ------------------------------------------------------------------ */
/* basketball timeline                                                 */
/* ------------------------------------------------------------------ */

type BbTimeline = { speed: number; cum: [number[], number[]]; otSide: 0 | 1 };
const bbCache = new Map<string, BbTimeline>();

function bbTimeline(sim: SimInput): BbTimeline {
  const key = `${sim.seed}|${sim.sport}`;
  const hit = bbCache.get(key);
  if (hit) return hit;
  const r = rng(`${sim.seed}:hoops`);
  const cum: [number[], number[]] = [[0], [0]];
  ([0, 1] as const).forEach((side) => {
    const f = Math.min(1, Math.max(0.5, sim.str[side] / 97.6));
    for (let b = 0; b < 80; b++) {
      const u = r();
      const v = r();
      const pts = v < f ? (u < 0.38 ? 0 : u < 0.52 ? 1 : u < 0.88 ? 2 : 3) : 0;
      cum[side].push(cum[side][b] + pts);
    }
  });
  const tl: BbTimeline = { speed: sim.sport === "v-basketball" ? 8 : 1, cum, otSide: r() < 0.5 ? 0 : 1 };
  bbCache.set(key, tl);
  return tl;
}

function basketballState(sim: SimInput, now: number): LiveState {
  const tl = bbTimeline(sim);
  const virtual = sim.sport === "v-basketball";
  const t = ((now - sim.kickoff) / MIN) * tl.speed;
  const endsAt = sim.kickoff + (54 / tl.speed) * MIN;
  if (t < 0) {
    return { phase: "pre", period: "", clock: "", label: "", minute: 0, remaining: 1, score: [0, 0], suspended: false, goalAt: null, goalSide: null, endsAt };
  }
  let p: number;
  let period: string;
  if (t < 10) [p, period] = [t, "Q1"];
  else if (t < 12) [p, period] = [10, "Break"];
  else if (t < 22) [p, period] = [10 + (t - 12), "Q2"];
  else if (t < 32) [p, period] = [20, "HT"];
  else if (t < 42) [p, period] = [20 + (t - 32), "Q3"];
  else if (t < 44) [p, period] = [30, "Break"];
  else if (t < 54) [p, period] = [30 + (t - 44), "Q4"];
  else [p, period] = [40, "FT"];

  const bucket = Math.min(80, Math.floor(p * 2));
  const score: [number, number] = [tl.cum[0][bucket], tl.cum[1][bucket]];
  if (period === "FT" && score[0] === score[1]) score[tl.otSide] += 2; // overtime winner

  let clock: string;
  if (period.startsWith("Q")) {
    const rem = 10 - (p - Math.floor(p / 10) * 10);
    clock = virtual ? `${period} ${Math.max(1, Math.ceil(rem))}'` : `${period} ${mmss(rem)}`;
  } else clock = period === "HT" ? "Half time" : period;

  const sinceKick = now - sim.kickoff;
  const danger = !virtual && period.startsWith("Q") && hash01(`${sim.seed}:danger:${Math.floor(sinceKick / MIN)}`) < 0.05 && sinceKick % MIN < 15_000;

  return {
    phase: period === "FT" ? "ft" : "live",
    period,
    clock,
    label: clock,
    minute: p,
    remaining: (40 - p) / 40,
    score,
    suspended: period === "FT" || danger,
    goalAt: null,
    goalSide: null,
    endsAt,
  };
}

/* ------------------------------------------------------------------ */
/* public state + probabilities                                         */
/* ------------------------------------------------------------------ */

const stateCache = new Map<string, LiveState>();

export function liveState(sim: SimInput, now: number): LiveState {
  const sec = Math.floor(now / 1000);
  const key = `${sim.seed}|${sim.kickoff}|${sec}`;
  const hit = stateCache.get(key);
  if (hit) return hit;
  if (stateCache.size > 4000) stateCache.clear();
  const st = sim.sport === "football" || sim.sport === "v-football" ? footballState(sim, sec * 1000) : basketballState(sim, sec * 1000);
  stateCache.set(key, st);
  return st;
}

export const isBasketball = (sport: SportKind) => sport === "basketball" || sport === "v-basketball";

/** Pre-match handicap (home) and total points lines for basketball. */
export function bbLines(sim: Pick<SimInput, "str">) {
  const [h, a] = sim.str;
  return { hcp: Math.round(a - h) + 0.5, tot: Math.round(h + a) + 0.5 };
}

function erf(x: number) {
  const s = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

function pmf(lambda: number, n = 11) {
  const out: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k < n; k++) {
    out.push(p);
    p = (p * lambda) / (k + 1);
  }
  const s = out.reduce((a, b) => a + b, 0);
  return out.map((v) => v / s);
}

export type Probs = Record<string, number>;
const probCache = new Map<string, Probs>();

/** Fair outcome probabilities at `now` (odds refresh every 15s live, 2s virtual). */
export function probsAt(sim: SimInput, now: number): Probs {
  const virtual = sim.sport === "v-football" || sim.sport === "v-basketball";
  const step = virtual ? 2_000 : 15_000;
  const st = liveState(sim, now);
  const q = st.phase === "pre" ? 0 : st.phase === "ft" ? -1 : Math.floor(now / step);
  const key = `${sim.seed}|${sim.kickoff}|${q}|${st.score[0]}-${st.score[1]}`;
  const hit = probCache.get(key);
  if (hit) return hit;
  if (probCache.size > 4000) probCache.clear();

  const rs = st.phase === "pre" ? liveState(sim, sim.kickoff - 1) : st.phase === "ft" ? st : liveState(sim, q * step);
  const rem = st.phase === "pre" ? 1 : st.phase === "ft" ? 0 : rs.remaining;
  const [sh, sa] = st.score;
  let probs: Probs;

  if (!isBasketball(sim.sport)) {
    const ph = pmf(sim.str[0] * rem);
    const pa = pmf(sim.str[1] * rem);
    let p1 = 0;
    let px = 0;
    let p2 = 0;
    let pO = 0;
    let pGG = 0;
    for (let x = 0; x < ph.length; x++) {
      for (let y = 0; y < pa.length; y++) {
        const p = ph[x] * pa[y];
        const fh = sh + x;
        const fa = sa + y;
        if (fh > fa) p1 += p;
        else if (fh === fa) px += p;
        else p2 += p;
        if (fh + fa > 2.5) pO += p;
        if (fh > 0 && fa > 0) pGG += p;
      }
    }
    probs = { "1": p1, X: px, "2": p2, "1X": p1 + px, "12": p1 + p2, X2: px + p2, O: pO, U: 1 - pO, GG: pGG, NG: 1 - pGG };
  } else {
    const { hcp, tot } = bbLines(sim);
    const eh = sim.str[0] * rem;
    const ea = sim.str[1] * rem;
    const marginMean = sh - sa + (eh - ea);
    const sdM = 12 * Math.sqrt(rem) + 0.35;
    const totalMean = sh + sa + eh + ea;
    const sdT = 15 * Math.sqrt(rem) + 0.35;
    const p1 = phi(marginMean / sdM);
    const pH1 = phi((marginMean + hcp) / sdM);
    const pO = phi((totalMean - tot) / sdT);
    probs = { "1": p1, "2": 1 - p1, H1: pH1, H2: 1 - pH1, O: pO, U: 1 - pO };
  }
  probCache.set(key, probs);
  return probs;
}

export function toOdds(p: number, margin: number) {
  const raw = 1 / (Math.max(0.0001, p) * margin);
  const v = raw >= 20 ? Math.round(raw * 100) / 100 : raw >= 10 ? Math.round(raw * 4) / 4 : raw >= 3 ? Math.round(raw * 20) / 20 : Math.round(raw * 100) / 100;
  return Math.min(250, Math.max(1.01, v));
}

/* ------------------------------------------------------------------ */
/* Full football market model (used by the match Markets screen)        */
/* ------------------------------------------------------------------ */

export function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p = (p * lambda) / i;
  return p;
}

export type FbModel = {
  phase: "pre" | "live" | "ft";
  period: string;
  score: [number, number];
  /** expected goals left in the whole match */
  remH: number;
  remA: number;
  /** expected goals left in the second half */
  shRemH: number;
  shRemA: number;
  h1End: number;
  /** corners so far and expected corners remaining (home, away) */
  corners: [number, number];
  cornRem: [number, number];
  bookings: [number, number];
  half: {
    open: boolean;
    known: boolean;
    h: number;
    a: number;
    remH: number;
    remA: number;
    firstGoal: 0 | 1 | null;
  };
};

const MAX_REMAINING_GOALS = 12;

export function fbModel(sim: SimInput, now: number): FbModel | null {
  if (sim.sport !== "football" && sim.sport !== "v-football") return null;
  const st = liveState(sim, now);
  const tl = fbTimeline(sim);
  const h1End = 45 + tl.s1;
  const h1Goals = tl.goals.filter((g) => g.gt < h1End);
  const ht: [number, number] = [h1Goals.filter((g) => g.side === 0).length, h1Goals.filter((g) => g.side === 1).length];
  const firstGoal = h1Goals.length ? h1Goals[0].side : null;
  const remH = sim.str[0] * st.remaining;
  const remA = sim.str[1] * st.remaining;

  const detail = fbDetail(sim);
  const playedT = ((now - sim.kickoff) / MIN) * tl.speed;
  const playedGoals = detail.goals.filter((g) => g.gt <= (st.phase === "pre" ? 0 : playedT));
  const cH = detail.corners.filter((c) => c.side === 0 && c.t <= (st.phase === "pre" ? 0 : playedT)).length;
  const cA = detail.corners.filter((c) => c.side === 1 && c.t <= (st.phase === "pre" ? 0 : playedT)).length;
  const bH = detail.bookings.filter((b) => b.side === 0 && b.t <= (st.phase === "pre" ? 0 : playedT)).reduce((a, b) => a + b.pts, 0);
  const bA = detail.bookings.filter((b) => b.side === 1 && b.t <= (st.phase === "pre" ? 0 : playedT)).reduce((a, b) => a + b.pts, 0);
  const totalCorners = detail.corners.length;
  const remFraction = st.phase === "pre" ? 1 : st.phase === "ft" ? 0 : st.remaining;
  const homeShare = totalCorners ? detail.corners.filter((c) => c.side === 0).length / totalCorners : 0.53;
  const cornTotalRem = totalCorners * remFraction;
  const base = {
    shRemH: sim.str[0] * 0.55 * remFraction,
    shRemA: sim.str[1] * 0.55 * remFraction,
    h1End: detail.h1End,
    corners: [cH, cA] as [number, number],
    cornRem: [cornTotalRem * homeShare, cornTotalRem * (1 - homeShare)] as [number, number],
    bookings: [bH, bA] as [number, number],
  };
  if (st.phase === "pre") return { ...base, phase: "pre", period: "", score: [0, 0], remH: sim.str[0], remA: sim.str[1], half: { open: true, known: false, h: 0, a: 0, remH: sim.str[0] * 0.45, remA: sim.str[1] * 0.45, firstGoal: null } };
  if (st.period === "H1") return { ...base, phase: "live", period: st.period, score: st.score, remH, remA, half: { open: true, known: false, h: st.score[0], a: st.score[1], remH: (sim.str[0] * Math.max(0, 45 - st.minute)) / 90, remA: (sim.str[1] * Math.max(0, 45 - st.minute)) / 90, firstGoal } };
  void playedGoals;
  return { ...base, phase: st.phase === "ft" ? "ft" : "live", period: st.period, score: st.score, remH, remA, half: { open: false, known: true, h: ht[0], a: ht[1], remH: 0, remA: 0, firstGoal } };
}

/** Probability matrix of remaining goals: grid[x][y] = P(home scores x more, away scores y more). */
export function goalGrid(model: FbModel, addHome = 0, addAway = 0): { grid: number[][]; max: number } {
  const ph = Array.from({ length: MAX_REMAINING_GOALS + 1 }, (_, i) => poisson(i, model.remH));
  const pa = Array.from({ length: MAX_REMAINING_GOALS + 1 }, (_, i) => poisson(i, model.remA));
  const grid: number[][] = [];
  for (let x = 0; x <= MAX_REMAINING_GOALS; x++) {
    grid[x] = [];
    for (let y = 0; y <= MAX_REMAINING_GOALS; y++) grid[x][y] = ph[x] * pa[y];
  }
  return { grid, max: MAX_REMAINING_GOALS + addHome + addAway };
}

export function halfGrid(model: FbModel): { grid: number[][] } {
  const ph = Array.from({ length: 7 }, (_, i) => poisson(i, model.half.remH));
  const pa = Array.from({ length: 7 }, (_, i) => poisson(i, model.half.remA));
  return { grid: ph.map((x) => pa.map((y) => x * y)) };
}

export const htScore = (model: FbModel): [number, number] => (model.half.known ? [model.half.h, model.half.a] : [model.half.h, model.half.a]);

/* ------------------------------------------------------------------ */
/* Live match statistics (derived from the same seeded match data)      */
/* ------------------------------------------------------------------ */

export type MatchStats = {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  bigChances: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellow: [number, number];
  red: [number, number];
  offsides: [number, number];
  saves: [number, number];
  passes: [number, number];
  passAccuracy: [number, number];
  dangerous: [number, number];
  xg: [number, number];
  /** per 15-minute band, home and away attacks (for the momentum chart) */
  momentum: { label: string; home: number; away: number }[];
};

export function matchStats(sim: SimInput, now: number): MatchStats | null {
  if (sim.sport !== "football" && sim.sport !== "v-football") return null;
  const model = fbModel(sim, now);
  const st = liveState(sim, now);
  if (!model) return null;
  const progress = st.phase === "pre" ? 1 : st.phase === "ft" ? 1 : Math.min(1, Math.max(0.06, 1 - st.remaining / 1.05));
  const pre = st.phase === "pre";
  const h = hash01(`${sim.seed}:stats`);
  const rh = hash01(`${sim.seed}:stats:h`);
  const ra = hash01(`${sim.seed}:stats:a`);
  const bias = (sim.str[0] + 0.15) / (sim.str[0] + sim.str[1] + 0.3); // stronger team dominates the ball
  const posH = Math.round(Math.min(68, Math.max(32, 50 + (bias - 0.5) * 46 + (rh - 0.5) * 6)));
  const pos = [posH, 100 - posH] as [number, number];
  const scale = (base: number, r: number) => Math.round((base * (0.7 + r * 0.7)) * progress);
  const shots = [Math.max(model.score[0], scale(9 + sim.str[0] * 3, rh)), Math.max(model.score[1], scale(7 + sim.str[1] * 3, ra))] as [number, number];
  const onTarget = [Math.min(shots[0], model.score[0] + Math.round(scale(3.4, rh))), Math.min(shots[1], model.score[1] + Math.round(scale(2.8, ra)))] as [number, number];
  const detail = fbDetail(sim);
  const played = progress;
  const corners = [detail.corners.filter((c) => c.side === 0 && c.t / detail.end <= played * 1.02).length, detail.corners.filter((c) => c.side === 1 && c.t / detail.end <= played * 1.02).length] as [number, number];
  const cards = detail.bookings;
  const yel = [cards.filter((b) => b.side === 0 && b.pts === 1 && b.t / detail.end <= played * 1.02).length, cards.filter((b) => b.side === 1 && b.pts === 1 && b.t / detail.end <= played * 1.02).length] as [number, number];
  const red = [cards.filter((b) => b.side === 0 && b.pts === 10 && b.t / detail.end <= played * 1.02).length, cards.filter((b) => b.side === 1 && b.pts === 10 && b.t / detail.end <= played * 1.02).length] as [number, number];
  const momentum = Array.from({ length: 6 }, (_, i) => {
    const r1 = hash01(`${sim.seed}:mom:${i}:h`);
    const r2 = hash01(`${sim.seed}:mom:${i}:a`);
    const active = progress >= (i + 1) / 6 ? 1 : progress > i / 6 ? (progress * 6 - i) : 0;
    return { label: `${i * 15}'-${(i + 1) * 15}'`, home: Math.round(active * (18 + r1 * 72) * (0.6 + bias * 0.8)), away: Math.round(active * (18 + r2 * 72) * (1.2 - bias * 0.8)) };
  });
  return {
    possession: pos,
    shots: [Math.round(shots[0]), Math.round(shots[1])],
    shotsOnTarget: [Math.round(onTarget[0]), Math.round(onTarget[1])],
    bigChances: [Math.max(model.score[0], Math.round(scale(1.8, rh))), Math.max(model.score[1], Math.round(scale(1.4, ra)))],
    corners,
    fouls: [Math.round(scale(8, rh)), Math.round(scale(9, ra))],
    yellow: [Math.max(yel[0], 0), Math.max(yel[1], 0)],
    red,
    offsides: [Math.round(scale(1.8, rh)), Math.round(scale(2.1, ra))],
    saves: [Math.round(scale(1.9, ra)), Math.round(scale(2.4, rh))],
    passes: [Math.round(scale(310 + h * 40, rh)), Math.round(scale(280 + h * 40, ra))],
    passAccuracy: [Math.round(74 + rh * 12), Math.round(72 + ra * 12)],
    dangerous: [Math.round(scale(24, rh)), Math.round(scale(21, ra))],
    xg: [Math.round(((pre ? 0.35 : 0.12) + sim.str[0] * progress * 0.55) * 100) / 100, Math.round(((pre ? 0.3 : 0.1) + sim.str[1] * progress * 0.55) * 100) / 100],
    momentum,
  };
}
