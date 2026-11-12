import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ALL_MATCHES, MATCH_BY_ID, SPORT_LABEL, fixtureName, isVirtual, phaseOf, simOf, type SportKey } from "./data";
import {
  MAX_SELECTIONS,
  maxStake,
  maxWin,
  minStake,
  OUTCOME_BY_KEY,
  boostFor,
  legProbability,
  predictionFor,
  priceOf,
  type MarketKey,
} from "./lib/markets";
import { liveState, type SimInput } from "./lib/sim";
import { decodeBooking, encodeBooking } from "./lib/booking";
import { round2 } from "./lib/format";
import { authMessage, loginProbe, roleOf, supabase } from "./lib/supabase";
import { staff } from "./staff/client";
import { cur, isCurrency, sc, num, setCurrency, type CurrencyCode } from "./lib/currency";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

export type BookTab = "live" | "next6h" | "today" | "upcoming";

export type BookScreen = {
  name: "book";
  title: string;
  sport: SportKey;
  tab: BookTab;
  tabs: BookTab[];
  showSports: boolean;
  preset?: "euro" | "sure";
};

export type Screen =
  | { name: "home" }
  | BookScreen
  | { name: "jackpot" }
  | { name: "pick12" }
  | { name: "affiliate" }
  | { name: "promotions" }
  | { name: "mybets" }
  | { name: "me" }
  | { name: "casino" };

export const SCREENS = {
  live: (sport: SportKey = "football"): BookScreen => ({ name: "book", title: "Live", sport, tab: "live", tabs: ["live", "next6h"], showSports: true }),
  today: (): BookScreen => ({ name: "book", title: "Today's Football", sport: "football", tab: "today", tabs: ["today", "live", "upcoming"], showSports: false }),
  sport: (sport: SportKey): BookScreen => ({ name: "book", title: SPORT_LABEL[sport], sport, tab: "today", tabs: ["today", "live", "upcoming"], showSports: true }),
  euro: (): BookScreen => ({ name: "book", title: "Euro Top 5 Leagues", sport: "football", tab: "today", tabs: ["today", "live", "upcoming"], showSports: false, preset: "euro" }),
  sure: (): BookScreen => ({ name: "book", title: "Sure Odds", sport: "football", tab: "today", tabs: ["today", "upcoming"], showSports: false, preset: "sure" }),
};

export type Overlay =
  | { type: "match"; matchId: string }
  | { type: "auth"; mode: "login" | "register" | "reset" | "recover" }
  | { type: "deposit"; method?: string }
  | { type: "withdraw" }
  | { type: "game"; gameId: string }
  | { type: "allSports" }
  | { type: "loadCode" }
  | { type: "promo"; id: string };

export type BetLeg = {
  key: string;
  fixture: string;
  league: string;
  market: string;
  pick: string;
  odds: number;
  live: boolean;
  matchId?: string;
  marketKey?: MarketKey;
  code?: string;
  virtual?: boolean;
  kickoff?: number;
  sim?: SimInput;
  result?: "won" | "lost";
  finalScore?: string;
};

export type Bet = {
  id: string;
  code: string;
  kind: "single" | "multiple" | "jackpot" | "pick12";
  placedAt: number;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  status: "open" | "won" | "lost" | "cashed";
  payout?: number;
  legs: BetLeg[];
  note?: string;
  settledAt?: number;
};

export type Tx = {
  id: string;
  at: number;
  type: "deposit" | "withdraw" | "bet" | "win" | "cashout" | "casino" | "bonus";
  amount: number;
  note: string;
};

export type Account = {
  phone: string;
  email: string;
  currency: CurrencyCode;
  name: string;
  balance: number;
  bets: Bet[];
  tx: Tx[];
  createdAt: number;
  referredBy?: string;
};

export type Toast = { id: number; msg: string; tone: "ok" | "err" | "info" };

export type SlipInput = { mode: "single" | "multiple"; stake: number; stakes: Record<string, number> };

export type PlaceResult =
  | { ok: true; bets: Bet[] }
  | { ok: false; error: string; reason: "auth" | "balance" | "stake" | "empty" | "suspended" | "odds" };

type Store = {
  screen: Screen;
  canBack: boolean;
  push: (s: Screen) => void;
  go: (s: Screen) => void;
  back: () => void;

  overlay: Overlay | null;
  open: (o: Overlay) => void;
  close: () => void;

  slip: string[];
  seenOdds: Record<string, number>;
  ackOdds: () => void;
  toggle: (key: string) => void;
  removeFromSlip: (key: string) => void;
  clearSlip: () => void;
  setSlip: (keys: string[]) => void;
  slipOpen: boolean;
  setSlipOpen: (v: boolean) => void;
  acceptOdds: boolean;
  setAcceptOdds: (v: boolean) => void;
  aiSelect: () => void;
  makeCode: (keys: string[]) => string;
  loadCode: (code: string) => string | null;

  toast: Toast | null;
  notify: (msg: string, tone?: Toast["tone"]) => void;
  /** bet that has just been won – drives the "You won" celebration */
  lastWin: Bet | null;
  dismissWin: () => void;

  user: Account | null;
  referrer: string | null;
  authReady: boolean;
  register: (input: { phone: string; email: string; currency: CurrencyCode; password: string; referral?: string }) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  forgotPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  requireAuth: () => boolean;

  deposit: (amount: number, method: string) => { bonus: number };
  withdraw: (amount: number, method: string) => string | null;
  debit: (amount: number, note: string, demo: boolean) => boolean;
  credit: (amount: number, note: string, demo: boolean) => void;
  demoBalance: number;
  resetDemo: () => void;

  precheckSlip: (input: SlipInput) => PlaceResult | null;
  placeSlip: (input: SlipInput) => PlaceResult;
  placeCustom: (bet: Omit<Bet, "id" | "placedAt" | "code"> & { code?: string }) => string | null;
  cashOut: (betId: string) => number;
  refreshBets: () => void;

  favourites: string[];
  toggleFav: (matchId: string) => void;
  reminders: string[];
  toggleReminder: (matchId: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* persistence helpers                                                 */
/* ------------------------------------------------------------------ */

const LS = {
  accounts: "ss.accounts.v1",
  slip: "ss.slip.v2",
  fav: "ss.fav.v1",
  demo: "ss.demo.v2",
  ref: "ss.ref.v1",
  odds: "ss.acceptOdds.v1",
  reminders: "ss.reminders.v1",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode */
  }
}

export const uid = (prefix = "") =>
  prefix + Math.random().toString(36).slice(2, 7).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();

/* ------------------------------------------------------------------ */
/* bet maths (pure)                                                    */
/* ------------------------------------------------------------------ */

/** Resolve the data needed to price/settle a leg (also works for legacy legs). */
export function legInfo(l: BetLeg): { sim: SimInput; marketKey: MarketKey; code: string } | null {
  const parts = l.key.split("|");
  if (parts.length !== 3) return null;
  const matchId = l.matchId ?? parts[0];
  const marketKey = (l.marketKey ?? parts[1]) as MarketKey;
  const code = l.code ?? parts[2];
  const m = MATCH_BY_ID.get(matchId);
  const sim = l.sim ?? (m ? simOf(m) : null);
  return sim ? { sim, marketKey, code } : null;
}

export function legsFor(keys: string[], now: number): BetLeg[] {
  const legs: BetLeg[] = [];
  for (const key of keys) {
    const o = OUTCOME_BY_KEY.get(key);
    const m = o ? MATCH_BY_ID.get(o.matchId) : undefined;
    if (!o || !m) continue;
    legs.push({
      key,
      matchId: m.id,
      fixture: fixtureName(m),
      league: m.league,
      market: o.marketTitle,
      marketKey: o.market,
      code: o.code,
      pick: o.label,
      odds: priceOf(o, now).odds,
      live: liveState(m, now).phase === "live",
      virtual: isVirtual(m),
      kickoff: m.kickoff,
      sim: simOf(m),
    });
  }
  return legs;
}

export type CashOutQuote = { available: boolean; value: number; reason?: string };

export function cashOutQuote(bet: Bet, now: number): CashOutQuote {
  if (bet.status !== "open") return { available: false, value: 0, reason: "This bet has been settled." };
  if (bet.kind !== "single" && bet.kind !== "multiple") return { available: false, value: 0, reason: "Cash out is not offered on this bet type." };
  let p = 1;
  for (const l of bet.legs) {
    if (l.result === "won") continue;
    if (l.result === "lost") return { available: false, value: 0, reason: "A selection on this bet has lost." };
    if (l.virtual) return { available: false, value: 0, reason: "Cash out is not available on virtual sports." };
    const info = legInfo(l);
    if (!info) return { available: false, value: 0, reason: "Cash out is not available for this bet." };
    const lp = legProbability(info.sim, info.marketKey, info.code, now);
    if (lp.settled === "lost") return { available: false, value: 0, reason: "A selection on this bet has lost." };
    if (lp.settled === "won") continue;
    if (lp.locked) return { available: false, value: 0, reason: "A market on this bet is suspended. Cash out will be back in a moment." };
    p *= lp.p;
  }
  const value = round2(bet.potentialWin * p * 0.9);
  if (value < 0.1) return { available: false, value: 0, reason: "The cash out value is too low right now." };
  return { available: true, value };
}

/** Settle finished legs. Returns a new bet object when something changed. */
function settleBet(b: Bet, now: number): Bet | null {
  if (b.status !== "open" || (b.kind !== "single" && b.kind !== "multiple")) return null;
  let changed = false;
  let lost = false;
  let pending = false;
  const legs = b.legs.map((l) => {
    if (l.result) {
      if (l.result === "lost") lost = true;
      return l;
    }
    const info = legInfo(l);
    if (!info) {
      pending = true;
      return l;
    }
    const st = liveState(info.sim, now);
    const lp = legProbability(info.sim, info.marketKey, info.code, now);
    if (!lp.settled) {
      pending = true;
      return l;
    }
    if (st.phase !== "ft" && lp.settled === "won") {
      // early-won (e.g. Over 2.5 already landed) – mark won but keep match running
      changed = true;
      return { ...l, result: "won" as const };
    }
    changed = true;
    if (lp.settled === "lost") lost = true;
    return { ...l, result: lp.settled, finalScore: `${st.score[0]}-${st.score[1]}` };
  });
  if (lost) return { ...b, legs, status: "lost", payout: 0, settledAt: now };
  if (!pending && legs.every((l) => l.result === "won")) return { ...b, legs, status: "won", payout: b.potentialWin, settledAt: now };
  return changed ? { ...b, legs } : null;
}

function withTx(a: Account, type: Tx["type"], amount: number, note: string): Account {
  return {
    ...a,
    balance: round2(a.balance + amount),
    tx: [{ id: uid("T"), at: Date.now(), type, amount: round2(amount), note }, ...a.tx].slice(0, 300),
  };
}

/* ------------------------------------------------------------------ */
/* provider                                                            */
/* ------------------------------------------------------------------ */

const DEMO_START: Record<CurrencyCode, number> = { GHS: 1000, NGN: 100_000 };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [slip, setSlipState] = useState<string[]>(() => load<string[]>(LS.slip, []).filter((k) => OUTCOME_BY_KEY.has(k)));
  const [seenOdds, setSeenOdds] = useState<Record<string, number>>({});
  const [slipOpen, setSlipOpen] = useState(false);
  const [acceptOdds, setAcceptOdds] = useState<boolean>(() => load(LS.odds, true));
  const [accounts, setAccounts] = useState<Record<string, Account>>(() => load(LS.accounts, {}));
  const [session, setSession] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [favourites, setFavourites] = useState<string[]>(() => load(LS.fav, []));
  const [reminders, setReminders] = useState<string[]>(() => load(LS.reminders, []));
  const [demoAll, setDemoAll] = useState<Record<CurrencyCode, number>>(() => ({ ...DEMO_START, ...load<Partial<Record<CurrencyCode, number>>>(LS.demo, {}) }));
  const [referrer, setReferrer] = useState<string | null>(() => load<string | null>(LS.ref, null));
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastWin, setLastWin] = useState<Bet | null>(null);

  const accountsRef = useRef(accounts);
  const sessionRef = useRef(session);
  const demoRef = useRef(demoAll);
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;

  useEffect(() => save(LS.accounts, accounts), [accounts]);
  useEffect(() => save(LS.slip, slip), [slip]);
  useEffect(() => save(LS.fav, favourites), [favourites]);
  useEffect(() => save(LS.reminders, reminders), [reminders]);
  useEffect(() => save(LS.demo, demoAll), [demoAll]);
  useEffect(() => save(LS.odds, acceptOdds), [acceptOdds]);

  const user = session ? (accounts[session] ?? null) : null;
  // every amount rendered below this point uses the account currency
  setCurrency(user?.currency ?? "GHS");
  const demoBalance = demoAll[cur()];

  const notify = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToast({ id, msg, tone });
    window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2800);
  }, []);

  const commit = useCallback((next: Record<string, Account>) => {
    accountsRef.current = next;
    setAccounts(next);
  }, []);

  const mutateUser = useCallback(
    (fn: (a: Account) => Account | null): boolean => {
      const phone = sessionRef.current;
      const cur = accountsRef.current;
      if (!phone || !cur[phone]) return false;
      const next = fn(cur[phone]);
      if (!next) return false;
      commit({ ...cur, [phone]: next });
      return true;
    },
    [commit],
  );

  const setSessionSafe = useCallback((phone: string | null) => {
    sessionRef.current = phone;
    setSession(phone);
  }, []);

  /* ---------------- navigation ---------------- */

  const push = useCallback((s: Screen) => {
    setStack((st) => [...st, s].slice(-15));
    setSlipOpen(false);
  }, []);
  const go = useCallback((s: Screen) => {
    setStack(s.name === "home" ? [s] : [{ name: "home" }, s]);
    setSlipOpen(false);
  }, []);
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);

  const open = useCallback((o: Overlay) => setOverlay(o), []);
  const close = useCallback(() => setOverlay(null), []);

  /* ---------------- betslip ---------------- */

  const toggle = useCallback(
    (key: string) => {
      const o = OUTCOME_BY_KEY.get(key);
      if (!o) return;
      if (slip.includes(key)) {
        setSlipState(slip.filter((k) => k !== key));
        return;
      }
      const price = priceOf(o, Date.now());
      if (price.locked) {
        notify("This market is suspended", "err");
        return;
      }
      const withoutSameMatch = slip.filter((k) => OUTCOME_BY_KEY.get(k)?.matchId !== o.matchId);
      if (withoutSameMatch.length >= MAX_SELECTIONS) {
        notify(`Maximum ${MAX_SELECTIONS} selections per betslip`, "err");
        return;
      }
      if (withoutSameMatch.length < slip.length) notify("Selection replaced – one pick per match");
      setSeenOdds((s) => ({ ...s, [key]: price.odds }));
      setSlipState([...withoutSameMatch, key]);
    },
    [slip, notify],
  );

  const ackOdds = useCallback(() => {
    const now = Date.now();
    setSeenOdds(Object.fromEntries(slip.map((k) => [k, priceOf(OUTCOME_BY_KEY.get(k)!, now).odds])));
  }, [slip]);

  const removeFromSlip = useCallback((key: string) => setSlipState((s) => s.filter((k) => k !== key)), []);
  const clearSlip = useCallback(() => setSlipState([]), []);
  const setSlip = useCallback((keys: string[]) => {
    const now = Date.now();
    const valid = keys.filter((k) => OUTCOME_BY_KEY.has(k)).slice(0, MAX_SELECTIONS);
    setSeenOdds(Object.fromEntries(valid.map((k) => [k, priceOf(OUTCOME_BY_KEY.get(k)!, now).odds])));
    setSlipState(valid);
  }, []);

  const makeCode = useCallback((keys: string[]) => encodeBooking(keys), []);

  const loadCode = useCallback(
    (code: string) => {
      const res = decodeBooking(code);
      if (!res.ok) return res.error;
      const now = Date.now();
      const open = res.keys.filter((k) => {
        const o = OUTCOME_BY_KEY.get(k)!;
        const m = MATCH_BY_ID.get(o.matchId)!;
        return liveState(m, now).phase !== "ft";
      });
      if (!open.length) return "All matches on this booking code have already finished.";
      setSlip(open);
      setSlipOpen(true);
      const dropped = res.keys.length - open.length;
      notify(`Booking code ${code.trim()} loaded · ${open.length} selection${open.length === 1 ? "" : "s"}${dropped ? ` (${dropped} finished removed)` : ""}`);
      return null;
    },
    [notify, setSlip],
  );

  const aiSelect = useCallback(() => {
    const now = Date.now();
    const candidates = ALL_MATCHES.filter((m) => m.sport === "football" && phaseOf(m, now) === "today")
      .map((m) => ({ m, p: predictionFor(m) }))
      .sort((a, b) => b.p.confidence - a.p.confidence)
      .slice(0, 4);
    const ids = new Set(candidates.map((c) => c.m.id));
    const kept = slip.filter((k) => !ids.has(OUTCOME_BY_KEY.get(k)?.matchId ?? ""));
    setSlip([...kept, ...candidates.map((c) => c.p.outcome.key)]);
    setSlipOpen(true);
    notify(`AI-Select added ${candidates.length} high-confidence picks`);
  }, [slip, notify, setSlip]);

  /* ---------------- auth ---------------- */

  /**
   * Mirror the Supabase user into the local (test-mode) wallet record.
   * The currency always comes from the database profile (locked at registration),
   * never from anything the player can edit afterwards.
   */
  const applyAuthUser = useCallback(
    async (u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!u) {
        setSessionSafe(null);
        return;
      }
      const meta = u.user_metadata ?? {};
      const email = u.email ?? "";
      if (accountsRef.current[u.id]) setSessionSafe(u.id); // returning player: show instantly, refresh below

      let phone = String(meta.phone ?? "");
      let name = String(meta.full_name ?? "") || email.split("@")[0] || "Player";
      let currency: CurrencyCode | null = null;
      try {
        const { data: prof, error } = await supabase.from("profiles").select("currency, phone, full_name, status").eq("id", u.id).maybeSingle();
        if (!error && prof && prof.status === "suspended") {
          await supabase.auth.signOut();
          setSessionSafe(null);
          notify("Your account has been suspended. Please contact SportStake support.", "err");
          return;
        }
        if (!error && prof) {
          if (isCurrency(prof.currency)) currency = prof.currency;
          phone = prof.phone || phone;
          name = prof.full_name || name;
        }
      } catch {
        /* profile not readable yet – fall back to sign-up data */
      }
      const cached = accountsRef.current[u.id];
      if (!currency) currency = isCurrency(meta.currency) ? meta.currency : (cached?.currency ?? "GHS");

      const keep = cached && cached.currency === currency; // never carry a balance across currencies
      const acc: Account = keep
        ? { ...cached, email, phone, name }
        : { phone, email, name, currency, balance: 0, bets: [], tx: [], createdAt: Date.now(), referredBy: (meta.referred_by as string) || undefined };
      commit({ ...accountsRef.current, [u.id]: acc });
      setSessionSafe(u.id);
    },
    [commit, setSessionSafe],
  );

  useEffect(() => {
    let alive = true;
    const fallback = window.setTimeout(() => alive && setAuthReady(true), 4000);
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s && (await roleOf(supabase)) !== "customer") {
        // an old staff session in the customer area: sign it out and ask to log in again
        await supabase.auth.signOut();
        await applyAuthUser(null);
        setOverlay({ type: "auth", mode: "login" });
      } else {
        await applyAuthUser(s?.user ?? null);
      }
      if (alive) setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // never await supabase calls directly inside this callback
      window.setTimeout(() => {
        if (event === "PASSWORD_RECOVERY") setOverlay({ type: "auth", mode: "recover" });
        void applyAuthUser(sess?.user ?? null);
      }, 0);
    });
    return () => {
      alive = false;
      window.clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, [applyAuthUser]);

  const register = useCallback(
    async ({ phone, email, currency, password, referral }: { phone: string; email: string; currency: CurrencyCode; password: string; referral?: string }) => {
      try {
        const { data: free, error: rpcErr } = await supabase.rpc("phone_available", { p_phone: phone });
        if (!rpcErr && free === false) return "This phone number is already registered. Log in instead.";
      } catch {
        /* function not installed yet – the database still rejects duplicates */
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { phone, currency, referred_by: (referral || referrer) ?? null } },
      });
      if (error) return authMessage(error);
      // an existing email returns a user with no identities instead of an error
      if (data.user && data.user.identities && data.user.identities.length === 0) return "An account with this email already exists. Log in instead.";
      if (!data.session) return "Account created. We sent a confirmation link to your email – open it, then log in.";
      await applyAuthUser(data.user);
      notify(`Welcome to SportStake! Your wallet currency is ${currency}.`);
      return null;
    },
    [applyAuthUser, notify, referrer],
  );

  /**
   * ONE login form for everybody. After the password is checked we look up the account's privileges
   * on the server and send the person to the right interface:
   *   administrator → admin dashboard (2FA code is then required)
   *   agent         → agent dashboard
   *   customer      → stays on the betting website
   */
  const login = useCallback(
    async (identifier: string, password: string) => {
      let email = identifier.trim().toLowerCase();
      if (!email.includes("@")) {
        // agents may sign in with their username
        const { data: found } = await supabase.rpc("agent_login_email", { p_username: email });
        if (!found) return "Incorrect email/username or password.";
        email = String(found);
      }
      try {
        const { data: locked } = await supabase.rpc("staff_login_locked", { p_email: email });
        if (locked) return "Too many failed attempts. For your security this account is locked for 15 minutes.";
      } catch {
        /* lockout check unavailable – continue */
      }

      const probe = loginProbe();
      const { data, error } = await probe.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        if (error && /invalid/i.test(error.message)) {
          // supabase queries only run when awaited – record the failed attempt for the lockout
          await supabase.rpc("staff_login_failed", { p_email: email, p_portal: "site" }).then(() => undefined, () => undefined);
        }
        return authMessage(error);
      }
      const tokens = { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
      const role = await roleOf(probe);

      if (role !== "customer") {
        const { error: e2 } = await staff.auth.setSession(tokens);
        if (e2) return authMessage(e2);
        window.location.hash = role === "admin" ? "/admin" : "/agent";
        return null;
      }

      const { data: s2, error: e3 } = await supabase.auth.setSession(tokens);
      if (e3) return authMessage(e3);
      await applyAuthUser(s2.user ?? data.user);
      notify("Welcome back!");
      return null;
    },
    [applyAuthUser, notify],
  );

  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}?staff=reset` });
    return error ? authMessage(error) : null;
  }, []);

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return authMessage(error);
      notify("Password updated.");
      return null;
    },
    [notify],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSessionSafe(null);
    setStack([{ name: "home" }]);
    notify("You have been logged out", "info");
  }, [notify, setSessionSafe]);

  const requireAuth = useCallback(() => {
    if (sessionRef.current) return true;
    setOverlay({ type: "auth", mode: "login" });
    notify("Log in or register to continue", "info");
    return false;
  }, [notify]);

  /* ---------------- wallet ---------------- */

  const deposit = useCallback(
    (amount: number, method: string) => {
      let bonus = 0;
      mutateUser((a) => {
        const first = !a.tx.some((t) => t.type === "deposit");
        let next = withTx(a, "deposit", amount, `Deposit via ${method}`);
        if (first) {
          bonus = round2(Math.min(sc(200), amount));
          next = withTx(next, "bonus", bonus, "100% first deposit bonus");
        }
        return next;
      });
      return { bonus };
    },
    [mutateUser],
  );

  const withdraw = useCallback(
    (amount: number, method: string) => {
      const ok = mutateUser((a) => (a.balance + 1e-9 < amount ? null : withTx(a, "withdraw", -amount, `Withdrawal to ${method}`)));
      return ok ? null : "Insufficient balance for this withdrawal.";
    },
    [mutateUser],
  );

  const debit = useCallback(
    (amount: number, note: string, demo: boolean) => {
      if (demo) {
        const c = cur();
        if (demoRef.current[c] + 1e-9 < amount) return false;
        demoRef.current = { ...demoRef.current, [c]: round2(demoRef.current[c] - amount) };
        setDemoAll(demoRef.current);
        return true;
      }
      return mutateUser((a) => (a.balance + 1e-9 < amount ? null : withTx(a, "casino", -amount, note)));
    },
    [mutateUser],
  );

  const credit = useCallback(
    (amount: number, note: string, demo: boolean) => {
      if (amount <= 0) return;
      if (demo) {
        const c = cur();
        demoRef.current = { ...demoRef.current, [c]: round2(demoRef.current[c] + amount) };
        setDemoAll(demoRef.current);
        return;
      }
      mutateUser((a) => withTx(a, "casino", amount, note));
    },
    [mutateUser],
  );

  const resetDemo = useCallback(() => {
    const c = cur();
    demoRef.current = { ...demoRef.current, [c]: DEMO_START[c] };
    setDemoAll(demoRef.current);
    notify(`Demo balance reset to ${c} ${num(DEMO_START[c])}.00`, "info");
  }, [notify]);

  /* ---------------- bets ---------------- */

  const buildBets = useCallback((keys: string[], { mode, stake, stakes }: SlipInput, now: number): Bet[] => {
    if (mode === "multiple" && keys.length > 1) {
      const legs = legsFor(keys, now);
      const totalOdds = round2(legs.reduce((a, l) => a * l.odds, 1));
      const boost = boostFor(legs.length);
      return [
        {
          id: uid("B"),
          code: encodeBooking(keys),
          kind: "multiple",
          placedAt: now,
          stake: round2(stake),
          totalOdds,
          potentialWin: Math.min(maxWin(), round2(stake * totalOdds * (1 + boost))),
          status: "open",
          legs,
          note: boost ? `Multiple Boost +${Math.round(boost * 100)}%` : undefined,
        },
      ];
    }
    return keys
      .map((k): Bet => {
        const st = round2(keys.length === 1 && mode === "multiple" ? stake : (stakes[k] ?? 0));
        const legs = legsFor([k], now);
        return { id: uid("B"), code: encodeBooking([k]), kind: "single", placedAt: now, stake: st, totalOdds: legs[0].odds, potentialWin: Math.min(maxWin(), round2(st * legs[0].odds)), status: "open", legs };
      })
      .filter((b) => b.stake > 0);
  }, []);

  /** Instant validation before the submit countdown starts. */
  const precheckSlip = useCallback(
    (input: SlipInput): PlaceResult | null => {
      if (!sessionRef.current) {
        setOverlay({ type: "auth", mode: "login" });
        return { ok: false, error: "Log in or register to place your bet", reason: "auth" };
      }
      if (!slip.length) return { ok: false, error: "Add at least one selection", reason: "empty" };
      const bets = buildBets(slip, input, Date.now());
      if (!bets.length) return { ok: false, error: `Enter a stake of at least ${cur()} ${minStake().toFixed(2)}`, reason: "stake" };
      if (bets.some((b) => b.stake < minStake())) return { ok: false, error: `Minimum stake is ${cur()} ${minStake().toFixed(2)} per bet`, reason: "stake" };
      const total = round2(bets.reduce((a, b) => a + b.stake, 0));
      if (total > maxStake()) return { ok: false, error: `Maximum total stake is ${cur()} ${maxStake().toLocaleString()}`, reason: "stake" };
      const acc = accountsRef.current[sessionRef.current];
      if (!acc || acc.balance + 1e-9 < total) return { ok: false, error: "Insufficient balance. Deposit to place this bet.", reason: "balance" };
      return null;
    },
    [slip, buildBets],
  );

  /** Final placement after the submit countdown: re-checks suspensions and odds. */
  const placeSlip = useCallback(
    (input: SlipInput): PlaceResult => {
      const pre = precheckSlip(input);
      if (pre) return pre;
      const now = Date.now();
      const suspended = slip.filter((k) => priceOf(OUTCOME_BY_KEY.get(k)!, now).locked);
      if (suspended.length) {
        return { ok: false, reason: "suspended", error: `${suspended.length} selection${suspended.length === 1 ? " is" : "s are"} suspended. Remove ${suspended.length === 1 ? "it" : "them"} or try again shortly.` };
      }
      if (!acceptOdds) {
        const changed = slip.some((k) => {
          const cur = priceOf(OUTCOME_BY_KEY.get(k)!, now).odds;
          return seenOdds[k] !== undefined && Math.abs(seenOdds[k] - cur) > 1e-9;
        });
        if (changed) return { ok: false, reason: "odds", error: "Odds have changed. Review the new odds and place again." };
      }
      const bets = buildBets(slip, input, now);
      const total = round2(bets.reduce((a, b) => a + b.stake, 0));
      const ok = mutateUser((a) =>
        a.balance + 1e-9 < total ? null : withTx({ ...a, bets: [...bets, ...a.bets] }, "bet", -total, bets.length > 1 ? `${bets.length} single bets` : `Bet ${bets[0].id}`),
      );
      if (!ok) return { ok: false, error: "Insufficient balance. Deposit to place this bet.", reason: "balance" };
      return { ok: true, bets };
    },
    [precheckSlip, slip, acceptOdds, seenOdds, buildBets, mutateUser],
  );

  const placeCustom = useCallback(
    (bet: Omit<Bet, "id" | "placedAt" | "code"> & { code?: string }) => {
      if (!sessionRef.current) {
        setOverlay({ type: "auth", mode: "login" });
        return "Log in or register to continue";
      }
      const full: Bet = { ...bet, id: uid("B"), placedAt: Date.now(), code: bet.code ?? uid(""), settledAt: bet.status !== "open" ? Date.now() : undefined };
      const ok = mutateUser((a) => {
        if (a.balance + 1e-9 < bet.stake) return null;
        let next = withTx({ ...a, bets: [full, ...a.bets] }, "bet", -bet.stake, `${bet.kind === "jackpot" ? "Jackpot ticket" : "Pick12"} ${full.id}`);
        if (bet.status === "won" && bet.payout) next = withTx(next, "win", bet.payout, `Pick12 win ${full.id}`);
        return next;
      });
      return ok ? null : "Insufficient balance. Please deposit to continue.";
    },
    [mutateUser],
  );

  const cashOut = useCallback(
    (betId: string) => {
      let value = 0;
      mutateUser((a) => {
        const bet = a.bets.find((b) => b.id === betId);
        if (!bet) return null;
        const q = cashOutQuote(bet, Date.now());
        if (!q.available) return null;
        value = q.value;
        const bets = a.bets.map((b) => (b.id === betId ? { ...b, status: "cashed" as const, payout: value, settledAt: Date.now() } : b));
        return withTx({ ...a, bets }, "cashout", value, `Cash out ${betId}`);
      });
      if (value) notify(`Cashed out ${cur()} ${value.toFixed(2)}`);
      else notify("Cash out is not available right now", "err");
      return value;
    },
    [mutateUser, notify],
  );

  /* ---------------- settlement engine ---------------- */

  const settleAll = useCallback(() => {
    const now = Date.now();
    const prevAccs = accountsRef.current;
    let changed = false;
    const next: Record<string, Account> = { ...prevAccs };
    const wins: number[] = [];
    const wonBets: Bet[] = [];
    let lostCount = 0;
    for (const phone of Object.keys(prevAccs)) {
      let acc = prevAccs[phone];
      let accChanged = false;
      const bets = acc.bets.map((b) => {
        const s = settleBet(b, now);
        if (!s) return b;
        accChanged = true;
        if (s.status === "won" && phone === sessionRef.current) { wins.push(s.payout ?? 0); wonBets.push(s); }
        if (s.status === "lost" && b.status === "open" && phone === sessionRef.current) lostCount++;
        return s;
      });
      if (!accChanged) continue;
      acc = { ...acc, bets };
      for (const b of bets) {
        const before = prevAccs[phone].bets.find((x) => x.id === b.id);
        if (b.status === "won" && before?.status === "open" && b.payout) acc = withTx(acc, "win", b.payout, `Bet won ${b.id}`);
      }
      next[phone] = acc;
      changed = true;
    }
    if (!changed) return false;
    commit(next);
    if (wins.length) {
      // show the celebration for the biggest win of the batch
      const winner = wonBets.sort((x, y) => (y.payout ?? 0) - (x.payout ?? 0))[0];
      setLastWin(winner);
      notify(`🎉 Bet won! ${cur()} ${wins.reduce((a, b) => a + b, 0).toFixed(2)} credited`);
    } else if (lostCount) notify(`${lostCount} bet${lostCount === 1 ? "" : "s"} settled`, "info");
    return true;
  }, [commit, notify]);

  useEffect(() => {
    settleAll();
    const id = window.setInterval(settleAll, 3000);
    return () => window.clearInterval(id);
  }, [settleAll]);

  const dismissWin = useCallback(() => setLastWin(null), []);

  const refreshBets = useCallback(() => {
    const updated = settleAll();
    notify(updated ? "Bets updated" : "Your bets are up to date", "info");
  }, [settleAll, notify]);

  /* ---------------- favourites & reminders ---------------- */

  const toggleFav = useCallback((matchId: string) => {
    setFavourites((f) => (f.includes(matchId) ? f.filter((x) => x !== matchId) : [...f, matchId]));
  }, []);

  const toggleReminder = useCallback(
    (matchId: string) => {
      const m = MATCH_BY_ID.get(matchId);
      if (!m) return;
      if (remindersRef.current.includes(matchId)) {
        setReminders((r) => r.filter((x) => x !== matchId));
        notify("Reminder removed", "info");
        return;
      }
      if (liveState(m, Date.now()).phase !== "pre") {
        notify("This match has already started", "info");
        return;
      }
      setReminders((r) => [...r, matchId]);
      notify(`We'll remind you when ${fixtureName(m)} kicks off`);
    },
    [notify],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const due = remindersRef.current.filter((mid) => {
        const m = MATCH_BY_ID.get(mid);
        return !m || m.kickoff <= now;
      });
      if (!due.length) return;
      const m = MATCH_BY_ID.get(due[0]);
      if (m) notify(`⏰ Kick-off! ${fixtureName(m)} is now live`, "info");
      setReminders((r) => r.filter((x) => !due.includes(x)));
    }, 5000);
    return () => window.clearInterval(id);
  }, [notify]);

  /* ---------------- deep links: ?code=XXXX & ?ref=XXXX ---------------- */

  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const after = sessionStorage.getItem("ss-after-staff");
    if (after) {
      sessionStorage.removeItem("ss-after-staff");
      if (after === "login") setOverlay({ type: "auth", mode: "login" });
      if (after === "signedout") notify("You have been signed out", "info");
      if (after === "reset-done") {
        setOverlay({ type: "auth", mode: "login" });
        notify("Password updated. Please log in with your new password.");
      }
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const ref = params.get("ref");
    if (ref) {
      // supports ?ref=AGENT001, /sportstake/partner/AGENT001 and ?staff=reset links
      const fromPath = window.location.pathname.match(/\/sportstake\/partner\/([A-Za-z0-9]{1,20})\/?$/);
      const clean = String(fromPath ? fromPath[1] : ref).trim().toUpperCase().slice(0, 20);
      setReferrer(clean);
      save(LS.ref, clean);
      if (!sessionRef.current) setOverlay({ type: "auth", mode: "register" });
    }
    if (code) {
      const err = loadCode(code);
      if (err) notify(err, "err");
    }
    if (code || ref) {
      params.delete("code");
      params.delete("ref");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    }
  }, [notify, loadCode]);

  const value = useMemo<Store>(
    () => ({
      screen: stack[stack.length - 1],
      canBack: stack.length > 1,
      push,
      go,
      back,
      overlay,
      open,
      close,
      slip,
      seenOdds,
      ackOdds,
      toggle,
      removeFromSlip,
      clearSlip,
      setSlip,
      slipOpen,
      setSlipOpen,
      acceptOdds,
      setAcceptOdds,
      aiSelect,
      makeCode,
      loadCode,
      toast,
      notify,
      lastWin,
      dismissWin,
      user,
      referrer,
      authReady,
      register,
      login,
      forgotPassword,
      updatePassword,
      logout,
      requireAuth,
      deposit,
      withdraw,
      debit,
      credit,
      demoBalance,
      resetDemo,
      precheckSlip,
      placeSlip,
      placeCustom,
      cashOut,
      refreshBets,
      favourites,
      toggleFav,
      reminders,
      toggleReminder,
    }),
    [
      stack, push, go, back, overlay, open, close, slip, seenOdds, ackOdds, toggle, removeFromSlip, clearSlip, setSlip, slipOpen, acceptOdds,
      aiSelect, makeCode, loadCode, toast, notify, lastWin, dismissWin, user, referrer, authReady, register, login, forgotPassword, updatePassword, logout, requireAuth, deposit, withdraw,
      debit, credit, demoBalance, resetDemo, precheckSlip, placeSlip, placeCustom, cashOut, refreshBets, favourites, toggleFav, reminders,
      toggleReminder,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
