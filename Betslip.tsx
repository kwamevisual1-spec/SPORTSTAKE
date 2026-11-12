import { useEffect, useMemo, useState } from "react";
import { MATCH_BY_ID, fixtureName, isFootballLike } from "../data";
import { maxWin, OUTCOME_BY_KEY, boostFor, priceOf } from "../lib/markets";
import { cur, sc } from "../lib/currency";
import { liveState } from "../lib/sim";
import { cleanAmount, ghs, money, openShare, parseAmount, round2 } from "../lib/format";
import { useClock, useDesktop } from "../lib/clock";
import { SCREENS, useStore, type Bet, type SlipInput } from "../store";
import { cn } from "../utils/cn";
import { CopyButton } from "./ui";
import {
  BasketIcon,
  ChevronDown,
  CloseIcon,
  CodeIcon,
  FacebookIcon,
  FootballIcon,
  InfoIcon,
  LockIcon,
  RobotIcon,
  TelegramIcon,
  TicketIcon,
  TrashIcon,
  WhatsAppIcon,
  XBrandIcon,
} from "./Icons";

const quick = () => [2, 5, 10, 20, 50, 100].map(sc);

/* ------------------------------------------------------------------ */
/* floating button (mobile & tablet)                                   */
/* ------------------------------------------------------------------ */

export function BetslipButton() {
  const { slip, setSlipOpen, overlay, screen } = useStore();
  const desktop = useDesktop();
  if (desktop || overlay?.type === "game" || overlay?.type === "match") return null;
  if (screen.name === "jackpot" || screen.name === "pick12" || (screen.name === "casino" && slip.length === 0)) return null;
  return (
    <button
      onClick={() => setSlipOpen(true)}
      aria-label={`Open betslip (${slip.length} selections)`}
      className="absolute bottom-[82px] right-0 z-30 flex h-[70px] w-[66px] flex-col items-center justify-center rounded-l-2xl bg-brand-yellow text-brand-ink shadow-[0_12px_26px_-8px_rgba(16,19,26,0.65)] transition active:scale-95"
    >
      <span key={slip.length} className="animate-pop grid h-8 min-w-8 place-items-center rounded-full bg-brand-ink px-1.5 text-[16px] font-black text-white">
        {slip.length}
      </span>
      <span className="mt-1 text-[10px] font-extrabold tracking-tight">Betslip</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* share sheet                                                          */
/* ------------------------------------------------------------------ */

export function ShareSheet({ code, count, odds, onClose }: { code: string; count: number; odds: number; onClose: () => void }) {
  const link = `${window.location.origin}${window.location.pathname}?code=${code}`;
  const text = `Bet with me on SportStake 🔥 ${count} selection${count === 1 ? "" : "s"} @ ${odds.toFixed(2)} odds. Booking code: ${code}`;
  const targets = [
    { label: "WhatsApp", Icon: WhatsAppIcon, url: `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}` },
    { label: "Telegram", Icon: TelegramIcon, url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
    { label: "Facebook", Icon: FacebookIcon, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
    { label: "X", Icon: XBrandIcon, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}` },
  ];

  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end">
      <button aria-label="Close share" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="animate-sheet relative rounded-t-[1.75rem] bg-white px-5 pb-6 pt-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[19px] font-black tracking-tight text-brand-ink">Share Bet</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-brand-ink/50 active:bg-black/5">
            <CloseIcon className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
        <p className="mt-1 text-center text-[13px] font-semibold text-brand-ink/55">Booking Code:</p>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span className="select-all text-[38px] font-black tracking-tight text-brand-ink">{code}</span>
          <CopyButton text={code} />
        </div>
        <p className="text-center text-[11px] font-semibold text-brand-ink/40">
          {count} selection{count === 1 ? "" : "s"} · Total odds {odds.toFixed(2)} · anyone can load this code and stake from their own account
        </p>
        <div className="my-5 h-px bg-black/[0.08]" />
        <div className="flex items-start justify-around">
          {targets.map(({ label, Icon, url }) => (
            <button key={label} onClick={() => openShare(url)} className="flex flex-col items-center gap-1.5 active:scale-95">
              <Icon className="h-12 w-12" />
              <span className="text-[10.5px] font-bold text-brand-ink/55">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-full bg-black/[0.045] py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-brand-ink/55">{link.replace(/^https?:\/\//, "")}</span>
          <CopyButton text={link} label="Copy Link" className="py-2" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* bet successful                                                       */
/* ------------------------------------------------------------------ */

function MoneyFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 124" className={className}>
      <defs>
        <radialGradient id="faceG" cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff09a" />
          <stop offset="0.55" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#f0a500" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="117" rx="30" ry="5" fill="#000" opacity="0.08" />
      <circle cx="60" cy="58" r="50" fill="url(#faceG)" />
      <path d="M26 64 Q60 112 94 64 Z" fill="#2b2b33" />
      <path d="M29 65.5 Q60 77 91 65.5 L89.5 71 Q60 82 30.5 71 Z" fill="#fff" />
      <path d="M43 88 Q60 78 77 88 Q60 101 43 88 Z" fill="#ff4d6a" />
      {[40, 80].map((x) => (
        <text key={x} x={x} y="54" textAnchor="middle" fontSize="40" fontWeight="900" fill="#43c443" stroke="#1d8a1d" strokeWidth="1.6" fontFamily="Inter, sans-serif">
          $
        </text>
      ))}
    </svg>
  );
}

type Success = { bets: Bet[]; code: string; stake: number; win: number };

function SuccessSheet({ s, onRebet, onOk }: { s: Success; onRebet: () => void; onOk: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/45" />
      <div className="animate-sheet relative overflow-hidden rounded-t-[1.6rem] bg-white shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#fbf5c4] to-white" />
        <div className="relative flex flex-col items-center px-6 pt-6">
          <MoneyFace className="animate-pop h-[104px] w-[104px]" />
          <h3 className="mt-2 text-[24px] font-black tracking-tight text-brand-ink">Bet Successful</h3>
          <p className="mt-1 text-[14px] font-semibold text-brand-ink/75">Hope Today Brings You a Big Win!</p>
        </div>
        <div className="relative space-y-3 px-7 pb-5 pt-5 text-[14px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-ink/55">Total Stake</span>
            <span className="font-bold text-brand-ink">{money(s.stake)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-ink/55">Possible Win</span>
            <span className="font-bold text-brand-ink">{money(s.win)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-ink/55">Booking Code</span>
            <span className="flex items-center gap-2">
              <span className="text-[16px] font-black tracking-wide text-brand-ink">{s.code}</span>
              <CopyButton text={s.code} className="border border-brand-green bg-white px-3 py-1 text-brand-green-deep [&>svg]:hidden" />
            </span>
          </div>
          {s.bets.length > 1 ? <p className="text-center text-[11px] font-semibold text-brand-ink/40">{s.bets.length} single bets placed</p> : null}
        </div>
        <div className="relative grid grid-cols-[40%_60%]">
          <button onClick={onRebet} className="bg-[#e3f5dc] py-4 text-[17px] font-black text-brand-green-deep active:bg-[#d4efca]">
            Rebet
          </button>
          <button onClick={onOk} className="bg-brand-green py-4 text-[17px] font-black text-white active:bg-brand-green-deep">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* betslip panel (used as mobile sheet and desktop side column)         */
/* ------------------------------------------------------------------ */

export function BetslipPanel({ variant, onClose }: { variant: "sheet" | "side"; onClose?: () => void }) {
  const store = useStore();
  const { slip, seenOdds, ackOdds, removeFromSlip, clearSlip, acceptOdds, setAcceptOdds, aiSelect, open, notify, precheckSlip, placeSlip, makeCode, loadCode, push, user } = store;
  const now = useClock();
  const [mode, setMode] = useState<"single" | "multiple">("multiple");
  const [stake, setStake] = useState(String(sc(2)));
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [submitInput, setSubmitInput] = useState<SlipInput | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const legs = useMemo(
    () =>
      slip
        .map((k) => {
          const o = OUTCOME_BY_KEY.get(k);
          const m = o ? MATCH_BY_ID.get(o.matchId) : undefined;
          return o && m ? { o, m } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [slip],
  );
  const priced = legs.map((l) => ({ ...l, price: priceOf(l.o, now), st: liveState(l.m, now) }));
  const openLegs = priced.filter((l) => !l.price.locked);
  const lockedCount = priced.length - openLegs.length;
  const changedCount = priced.filter((l) => !l.price.locked && seenOdds[l.o.key] !== undefined && seenOdds[l.o.key] !== l.price.odds).length;
  const effectiveMode = priced.length < 2 ? "single" : mode;
  const totalOdds = round2(priced.reduce((a, l) => a * (l.price.odds || 1), 1));
  const boost = boostFor(priced.length);
  const nStake = parseAmount(stake);
  const singleStake = (key: string) => parseAmount(stakes[key] ?? stake);
  const totalStake = effectiveMode === "multiple" ? nStake : round2(priced.reduce((a, l) => a + singleStake(l.o.key), 0));
  const possibleWin =
    effectiveMode === "multiple" ? Math.min(maxWin(), round2(nStake * totalOdds * (1 + boost))) : round2(priced.reduce((a, l) => a + singleStake(l.o.key) * l.price.odds, 0));
  const boostAmount = effectiveMode === "multiple" ? round2(nStake * totalOdds * boost) : 0;
  const boostHint = priced.length < 2 ? "Add 1 more for Multiple Boost" : priced.length < 10 ? `Add 1 more for +${Math.round(boostFor(priced.length + 1) * 100)}%` : "Max boost +20% unlocked";

  const input = (): SlipInput => ({ mode: effectiveMode, stake: nStake, stakes: Object.fromEntries(priced.map((l) => [l.o.key, singleStake(l.o.key)])) });

  /* ---- 3-second submission countdown ---- */
  useEffect(() => {
    if (submitting === null || !submitInput) return;
    if (submitting > 0) {
      const t = window.setTimeout(() => setSubmitting(submitting - 1), 1000);
      return () => window.clearTimeout(t);
    }
    const res = placeSlip(submitInput);
    setSubmitting(null);
    if (!res.ok) {
      if (res.reason === "odds") ackOdds();
      if (res.reason === "balance") open({ type: "deposit" });
      notify(res.error, res.reason === "odds" ? "info" : "err");
      return;
    }
    const s = { bets: res.bets, code: makeCode(slip), stake: round2(res.bets.reduce((a, b) => a + b.stake, 0)), win: round2(res.bets.reduce((a, b) => a + b.potentialWin, 0)) };
    setSuccess(s);
  }, [submitting, submitInput, placeSlip, ackOdds, open, notify, makeCode, slip]);

  const place = () => {
    if (submitting !== null) return;
    if (lockedCount) {
      notify(`${lockedCount} selection${lockedCount === 1 ? " is" : "s are"} suspended or finished. Remove ${lockedCount === 1 ? "it" : "them"} to continue.`, "err");
      return;
    }
    const inp = input();
    const pre = precheckSlip(inp);
    if (pre && !pre.ok) {
      if (pre.reason === "balance") {
        notify(pre.error, "err");
        open({ type: "deposit" });
      } else if (pre.reason === "auth") notify(pre.error, "info");
      else notify(pre.error, "err");
      return;
    }
    setSubmitInput(inp);
    setSubmitting(3);
  };

  const finish = (keep: boolean) => {
    setSuccess(null);
    if (!keep) {
      clearSlip();
      onClose?.();
    } else notify("Selections kept – adjust your stake and place again", "info");
  };

  const applyQuick = (q: number) => {
    if (effectiveMode === "multiple") setStake(String(q));
    else setStakes(Object.fromEntries(priced.map((l) => [l.o.key, String(q)])));
  };

  const busy = submitting !== null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
      {/* ---------- header ---------- */}
      <div className="shrink-0 bg-brand-yellow px-4 pt-1.5">
        {variant === "sheet" ? (
          <button onClick={onClose} aria-label="Collapse betslip" className="mx-auto flex h-6 w-16 items-center justify-center text-brand-ink/70">
            <ChevronDown className="h-6 w-6" strokeWidth={2.6} />
          </button>
        ) : (
          <div className="h-2.5" />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[19px] font-black tracking-tight text-brand-ink">Betslip</h3>
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand-ink px-2 text-[14px] font-black text-white">{slip.length}</span>
          </div>
          <button onClick={aiSelect} className="flex items-center gap-1.5 rounded-full bg-[#3f6df6] py-1 pl-2.5 pr-1 text-[11.5px] font-black text-white active:scale-95">
            AI-Select
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#3f6df6]">
              <RobotIcon className="h-4 w-4" strokeWidth={2.2} />
            </span>
          </button>
        </div>
        <div className={cn("mt-3 flex items-center justify-between gap-2 whitespace-nowrap font-bold text-brand-ink/75", variant === "side" ? "text-[11.5px]" : "text-[12px]")}>
          <button disabled={!slip.length} onClick={() => (clearSlip(), notify("Betslip cleared", "info"))} className="flex items-center gap-1 disabled:opacity-40">
            <TrashIcon className="h-4 w-4" strokeWidth={2} /> Remove All
          </button>
          <button onClick={() => open({ type: "loadCode" })} className="flex items-center gap-1">
            <CodeIcon className="h-4 w-4" strokeWidth={2} /> Load Code
          </button>
          <button onClick={() => setAcceptOdds(!acceptOdds)} className="flex items-center gap-2">
            {variant === "side" ? (
              <span>Accept odds</span>
            ) : (
              <>
                <span className="hidden min-[380px]:inline">Accept odds changes</span>
                <span className="min-[380px]:hidden">Accept odds</span>
              </>
            )}
            <span className={cn("relative h-6 w-11 rounded-full transition", acceptOdds ? "bg-brand-green" : "bg-black/20")}>
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", acceptOdds ? "left-[22px]" : "left-0.5")} />
            </span>
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["single", "multiple"] as const).map((m) => {
            const active = effectiveMode === m;
            const disabled = m === "multiple" && priced.length < 2;
            return (
              <button
                key={m}
                onClick={() => (disabled ? notify("Add at least 2 selections for a Multiple", "info") : setMode(m))}
                className={cn("rounded-t-2xl py-2.5 text-[16px] font-black tracking-tight transition", active ? "bg-white text-brand-ink" : "bg-white/45 text-brand-ink/70", disabled && "line-through opacity-60")}
              >
                {m === "single" ? "Singles" : "Multiple"}
              </button>
            );
          })}
        </div>
      </div>

      {slip.length === 0 ? (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-green-soft text-brand-green">
              <TicketIcon className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="mt-3 text-[15px] font-black text-brand-ink">Your betslip is empty</p>
            <p className="mt-1 text-[12px] font-semibold text-brand-ink/45">Tap any odds to add selections, or load a booking code.</p>
          </div>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const err = loadCode(codeInput);
              setCodeError(err);
              if (!err) setCodeInput("");
            }}
          >
            <input
              value={codeInput}
              onChange={(e) => (setCodeInput(e.target.value.trim()), setCodeError(null))}
              placeholder="Enter booking code"
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-3 text-[15px] font-bold tracking-wide text-brand-ink outline-none focus:border-brand-green"
            />
            <button type="submit" disabled={!codeInput} className="rounded-xl bg-brand-green px-5 text-[13px] font-black text-white disabled:opacity-40">
              Load
            </button>
          </form>
          {codeError ? <p className="mt-2 text-[11.5px] font-bold text-brand-red">{codeError}</p> : null}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => push(SCREENS.today())} className="rounded-xl bg-black/[0.05] py-3 text-[12.5px] font-black text-brand-ink">
              Today's football
            </button>
            <button onClick={aiSelect} className="rounded-xl bg-[#eaf0ff] py-3 text-[12.5px] font-black text-[#3f6df6]">
              AI-Select picks
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* selections */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
              {changedCount && !acceptOdds ? (
                <div className="flex items-center justify-between gap-2 bg-[#fff7d6] px-4 py-2 text-[11.5px] font-bold text-[#8a6100]">
                  <span>Odds changed on {changedCount} selection{changedCount === 1 ? "" : "s"}</span>
                  <button onClick={ackOdds} className="rounded-full bg-[#8a6100] px-3 py-1 text-[11px] font-black text-white">
                    Accept
                  </button>
                </div>
              ) : null}
              {priced.map(({ o, m, price, st }) => {
                const seen = seenOdds[o.key];
                const up = !price.locked && seen !== undefined && price.odds > seen;
                const down = !price.locked && seen !== undefined && price.odds < seen;
                return (
                  <div key={o.key} className={cn("flex gap-2 border-b border-black/[0.06] py-3 pl-2 pr-4", price.locked && "bg-[#f7f7f8]")}>
                    <button onClick={() => removeFromSlip(o.key)} aria-label="Remove selection" className="grid h-9 w-9 shrink-0 place-items-center self-center text-brand-ink/40 active:text-brand-red">
                      <CloseIcon className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-1.5 text-[14.5px] font-black tracking-tight text-brand-ink">
                          {isFootballLike(m) ? <FootballIcon className="h-4 w-4 shrink-0" strokeWidth={2} /> : <BasketIcon className="h-4 w-4 shrink-0" strokeWidth={2} />}
                          <span className="truncate">{o.code === "1" ? "home" : o.code === "2" ? "away" : o.code === "X" ? "draw" : o.label}</span>
                        </p>
                        {price.locked ? (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-black text-brand-ink/40">
                            <LockIcon className="h-3.5 w-3.5" /> {st.phase === "ft" ? "Ended" : "Suspended"}
                          </span>
                        ) : (
                          <span className={cn("shrink-0 rounded px-1 text-[16px] font-black tabular-nums", up ? "bg-[#e7f8ec] text-brand-green-deep" : down ? "bg-[#fdecec] text-brand-red" : "text-brand-ink")}>
                            {up ? "▲ " : down ? "▼ " : ""}
                            {price.odds.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5">
                        {st.phase === "live" ? (
                          <span className="shrink-0 rounded bg-[#ff5a4e] px-1.5 py-[1px] text-[9.5px] font-black text-white">
                            Live {st.score[0]}-{st.score[1]} · {st.clock}
                          </span>
                        ) : null}
                        <span className="truncate text-[12px] font-semibold text-brand-ink/70">{fixtureName(m)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand-ink/45">
                          {o.marketTitle}
                          {o.market === "1x2" ? (
                            <>
                              <span className="rounded-full bg-black/[0.06] px-2 py-0.5 italic">1Up</span>
                              <span className="rounded-full bg-black/[0.06] px-2 py-0.5 italic">2Up</span>
                            </>
                          ) : null}
                        </span>
                        {effectiveMode === "single" && !price.locked ? (
                          <input
                            inputMode="decimal"
                            value={stakes[o.key] ?? stake}
                            onChange={(e) => setStakes((s) => ({ ...s, [o.key]: cleanAmount(e.target.value) }))}
                            className="w-20 rounded-lg border border-black/15 px-2 py-1.5 text-right text-[14px] font-black text-brand-ink outline-none focus:border-brand-green"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {lockedCount ? (
                <button onClick={() => priced.filter((l) => l.price.locked).forEach((l) => removeFromSlip(l.o.key))} className="w-full py-2.5 text-[11.5px] font-black text-brand-red">
                  Remove {lockedCount} suspended / ended selection{lockedCount === 1 ? "" : "s"}
                </button>
              ) : null}
            </div>

            {/* summary */}
            <div className="shrink-0 border-t border-black/[0.08] bg-[#fbfbfc] px-4 pb-2 pt-2.5 text-[13.5px]">
              <div className="flex items-center justify-between py-0.5">
                <span className="font-semibold text-brand-ink/80">Total Odds</span>
                <span className="font-bold text-brand-ink">{totalOdds.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-brand-ink/80">{effectiveMode === "multiple" ? "Stake" : "Stake per bet"}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold text-brand-ink/70">{cur()}</span>
                  <input
                    inputMode="decimal"
                    value={stake}
                    onChange={(e) => {
                      setStake(cleanAmount(e.target.value));
                      if (effectiveMode === "single") setStakes({});
                    }}
                    className="w-24 rounded-xl border border-black/15 bg-white px-3 py-1.5 text-right text-[15px] font-black text-brand-ink outline-none focus:border-brand-green"
                  />
                </span>
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1">
                {quick().map((q) => (
                  <button key={q} onClick={() => applyQuick(q)} className="shrink-0 rounded-full bg-black/[0.06] px-3 py-1 text-[11.5px] font-extrabold text-brand-ink/70 active:scale-95">
                    {q}
                  </button>
                ))}
                {user ? (
                  <button
                    onClick={() => applyQuick(Math.floor(effectiveMode === "multiple" ? user.balance : user.balance / Math.max(1, priced.length)))}
                    className="shrink-0 rounded-full bg-black/[0.06] px-3 py-1 text-[11.5px] font-extrabold text-brand-ink/70"
                  >
                    Max
                  </button>
                ) : null}
              </div>
              <button onClick={() => setShowDiscount((v) => !v)} className="flex w-full items-center justify-between py-0.5">
                <span className="font-semibold text-brand-ink/80">Discount</span>
                <span className="font-semibold text-brand-ink/50">None ›</span>
              </button>
              {showDiscount ? (
                <p className="mb-1 rounded-lg bg-black/[0.04] px-2.5 py-2 text-[11px] font-semibold text-brand-ink/55">You have no active discount vouchers. Vouchers earned from promotions appear here automatically.</p>
              ) : null}
              {effectiveMode === "multiple" || priced.length < 2 ? (
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-brand-ink/80">
                    Boost
                    <span className="truncate rounded-full bg-[#f3f9b0] px-2 py-0.5 text-[10.5px] font-bold text-brand-green-deep">{boostHint}</span>
                  </span>
                  <span className="font-bold text-brand-ink">{boostAmount ? money(boostAmount) : "0"}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-1 font-semibold text-brand-ink/80">
                  Possible Win
                  <button onClick={() => notify(`Possible win includes your stake${boost ? ` and the +${Math.round(boost * 100)}% Multiple Boost` : ""}. Max payout ${cur()} ${maxWin().toLocaleString()}.`, "info")} aria-label="About possible win">
                    <InfoIcon className="h-4 w-4 text-brand-ink/40" strokeWidth={2} />
                  </button>
                </span>
                <span className="text-[16px] font-black text-brand-ink">{money(possibleWin)}</span>
              </div>
              {user ? <p className="text-right text-[10.5px] font-bold text-brand-ink/40">Balance {ghs(user.balance)}</p> : null}
            </div>
            {busy ? <div className="absolute inset-0 z-10 bg-black/35" /> : null}
          </div>

          <div className="grid h-[64px] shrink-0 grid-cols-[38%_62%]">
            <button
              disabled={busy}
              onClick={() => (openLegs.length ? setShareCode(makeCode(openLegs.map((l) => l.o.key))) : notify("All selections are suspended", "err"))}
              className="bg-[#eef0f3] text-[16px] font-black text-brand-ink active:bg-[#e3e6ea] disabled:opacity-60"
            >
              Share Bet
            </button>
            <button onClick={place} disabled={busy} className="flex flex-col items-center justify-center bg-brand-green px-2 text-white active:bg-brand-green-deep">
              {busy ? (
                <>
                  <span className="flex items-center gap-2 text-[16px] font-black">
                    <span className="h-4 w-4 animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" />
                    Submitting
                  </span>
                  <span className="text-[11.5px] font-semibold text-white/90">
                    Hang tight! Just {submitting} more second{submitting === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span className="text-[16px] font-black">{user ? `Place Bet ${money(totalStake)}` : "Login to Place Bet"}</span>
              )}
            </button>
          </div>
          {busy ? <div className="absolute inset-x-0 top-0 z-10 h-[150px] bg-black/35" /> : null}
        </>
      )}

      {success ? <SuccessSheet s={success} onRebet={() => finish(true)} onOk={() => finish(false)} /> : null}
      {shareCode ? <ShareSheet code={shareCode} count={openLegs.length} odds={round2(openLegs.reduce((a, l) => a * l.price.odds, 1))} onClose={() => setShareCode(null)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* mobile / tablet modal                                                */
/* ------------------------------------------------------------------ */

export function BetslipSheet() {
  const { slipOpen, setSlipOpen } = useStore();
  const desktop = useDesktop();
  if (desktop || !slipOpen) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-end">
      <button aria-label="Close betslip" className="absolute inset-0 bg-brand-ink/55 backdrop-blur-[2px]" onClick={() => setSlipOpen(false)} />
      <div className="animate-sheet relative flex h-[90%] w-full flex-col overflow-hidden rounded-t-[1.6rem] shadow-2xl md:max-w-[560px]">
        <BetslipPanel variant="sheet" onClose={() => setSlipOpen(false)} />
      </div>
    </div>
  );
}
