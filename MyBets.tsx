import { useEffect, useState } from "react";
import { MATCH_BY_ID } from "../data";
import { boostFor } from "../lib/markets";
import { liveState } from "../lib/sim";
import { money } from "../lib/format";
import { cur } from "../lib/currency";
import { useClock } from "../lib/clock";
import { SCREENS, cashOutQuote, legInfo, useStore, type Bet, type BetLeg } from "../store";
import { cn } from "../utils/cn";
import { ShareSheet } from "../components/Betslip";
import { CalendarIcon, ChevronDown, HelpIcon, ShareIcon, TicketIcon } from "../components/Icons";
import { CopyButton, EmptyState } from "../components/ui";

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const kindLabel = (b: Bet) => (b.kind === "single" ? "Singles" : b.kind === "multiple" ? "Multiple" : b.kind === "jackpot" ? "Jackpot" : "Pick12");
const isSports = (b: Bet) => b.kind === "single" || b.kind === "multiple";
const isVirtualLeg = (l: BetLeg) => Boolean(l.virtual) || /^v[fb]\d/.test(l.key);

function legStatus(l: BetLeg, now: number): { text: string; tone: string; live?: { score: string; clock: string } } {
  if (l.result === "won") return { text: "Won", tone: "text-brand-green-deep" };
  if (l.result === "lost") return { text: "Lost", tone: "text-brand-red" };
  const info = legInfo(l);
  if (!info) return { text: "Pending", tone: "text-brand-ink" };
  const st = liveState(info.sim, now);
  if (st.phase === "live") return { text: "Live", tone: "text-brand-red", live: { score: `${st.score[0]} - ${st.score[1]}`, clock: st.label } };
  if (st.phase === "ft") return { text: "Settling…", tone: "text-brand-ink/60" };
  return { text: "Pending", tone: "text-brand-ink" };
}

const legsOpen = (b: Bet, now: number) =>
  b.legs.filter((l) => {
    const info = legInfo(l);
    return info && liveState(info.sim, now).phase !== "ft";
  });

/* ------------------------------------------------------------------ */
/* open bet card                                                        */
/* ------------------------------------------------------------------ */

function OpenBetCard({ bet, now, onShare }: { bet: Bet; now: number; onShare: (b: Bet) => void }) {
  const { open, cashOut, setSlip, setSlipOpen, push, notify, reminders, toggleReminder, refreshBets } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const quote = cashOutQuote(bet, now);
  const pct = Math.round(boostFor(bet.legs.length + 3) * 100);

  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const rebet = () => {
    const keys = legsOpen(bet, now).map((l) => l.key);
    if (!keys.length) return notify("All matches on this bet have finished", "info");
    setSlip(keys);
    setSlipOpen(true);
    notify(`${keys.length} selection${keys.length === 1 ? "" : "s"} added to your betslip`);
  };

  const boostMore = () => {
    const keys = legsOpen(bet, now).map((l) => l.key);
    setSlip(keys);
    push(SCREENS.today());
    notify(`Add ${3} more selections and win ${pct}% more with Multiple Boost`, "info");
  };

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_18px_-14px_rgba(16,19,26,0.5)]">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 text-left">
        <span className="text-[15px] font-black text-brand-ink">{kindLabel(bet)}</span>
        <span className="text-[13.5px] font-semibold text-brand-ink/45">{stamp(bet.placedAt)}</span>
        {bet.legs.length > 1 ? <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px] font-bold text-brand-ink/55">{bet.legs.length} legs</span> : null}
        <span className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-black/[0.05]">
          <ChevronDown className={cn("h-5 w-5 text-brand-ink transition", expanded && "rotate-180")} strokeWidth={2.4} />
        </span>
      </button>

      {expanded ? (
        <div className="divide-y divide-black/[0.06] border-b border-black/[0.06]">
          {bet.legs.map((l) => {
            const s = legStatus(l, now);
            const info = legInfo(l);
            const matchId = l.matchId ?? l.key.split("|")[0];
            const m = MATCH_BY_ID.get(matchId);
            const reminded = reminders.includes(matchId);
            const pre = info ? liveState(info.sim, now).phase === "pre" : false;
            return (
              <div key={l.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[14.5px] font-semibold text-brand-ink">
                    <span className="mr-2 font-semibold text-brand-ink/40">{l.marketKey === "1x2" ? "1x2" : l.market}</span>
                    {l.pick}
                  </p>
                  <span className="shrink-0 text-[15px] font-black text-brand-ink">{l.odds ? +l.odds.toFixed(2) : ""}</span>
                </div>
                <button onClick={() => m && open({ type: "match", matchId })} className="mt-1 block max-w-full truncate text-left text-[14.5px] font-semibold text-[#4f6fad]">
                  {l.fixture.replace(" vs ", " vs. ")}
                </button>
                <div className="mt-1.5 flex items-center justify-between">
                  {s.live ? (
                    <span className="flex items-center gap-1.5 text-[12.5px] font-black tabular-nums text-brand-red">
                      <span className="h-1.5 w-1.5 animate-live rounded-full bg-brand-red" />
                      {s.live.score} · {s.live.clock}
                    </span>
                  ) : (
                    <span className="text-[13px] font-semibold text-brand-ink/45">
                      {l.kickoff ? stamp(l.kickoff) : ""}
                      {l.finalScore ? ` · FT ${l.finalScore}` : ""}
                    </span>
                  )}
                  <span className={cn("text-[15px] font-black", s.tone)}>{s.text}</span>
                </div>
                {isSports(bet) ? (
                  <div className="mt-2.5 grid grid-cols-2 overflow-hidden rounded-full bg-black/[0.05] text-[13px] font-bold text-brand-ink/65">
                    <button
                      disabled={!pre}
                      onClick={() => toggleReminder(matchId)}
                      className={cn("flex items-center justify-center gap-1.5 py-2.5 disabled:opacity-40", reminded && "bg-brand-yellow/60 text-brand-ink")}
                    >
                      <CalendarIcon className="h-4 w-4" strokeWidth={2} />
                      {reminded ? "Reminder set" : "Reminder"}
                    </button>
                    <button onClick={refreshBets} className="flex items-center justify-center gap-1.5 py-2.5">
                      <span className="text-[15px] leading-none">↻</span> Refresh
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-3 px-4 pt-3">
        <div>
          <p className="text-[17px] font-black text-brand-ink">{money(bet.stake)}</p>
          <p className="text-[12.5px] font-semibold text-brand-ink/60">Stake</p>
        </div>
        <div className="text-center">
          <p className="text-[17px] font-black text-brand-ink">{bet.kind === "jackpot" ? bet.note : bet.totalOdds.toFixed(2)}</p>
          <p className="text-[12.5px] font-semibold text-brand-ink/60">{bet.kind === "jackpot" ? "Lines" : "Odds"}</p>
        </div>
        <div className="text-right">
          <p className="text-[17px] font-black text-brand-ink">{money(bet.potentialWin)}</p>
          <p className="text-[12.5px] font-semibold text-brand-ink/60">Pos.Win</p>
        </div>
      </div>
      {bet.note && bet.kind === "multiple" ? <p className="px-4 pt-1 text-[11px] font-bold text-brand-green-deep">{bet.note}</p> : null}

      {isSports(bet) ? (
        <div className="flex items-center gap-2 px-3 pb-4 pt-3.5">
          <button onClick={() => onShare(bet)} className="flex w-12 shrink-0 flex-col items-center text-[#4f6fad]">
            <ShareIcon className="h-5 w-5" strokeWidth={2} />
            <span className="text-[12px] font-semibold">Share</span>
          </button>
          {quote.available ? (
            <button
              onClick={() => (confirm ? (cashOut(bet.id), setConfirm(false)) : setConfirm(true))}
              className={cn(
                "min-w-0 flex-[1.3] rounded-full border-2 px-2 py-2 text-[12.5px] font-black leading-tight transition",
                confirm ? "border-[#ea8a00] bg-[#ea8a00] text-white" : "border-brand-green text-brand-green-deep",
              )}
            >
              {confirm ? `Confirm ${money(quote.value)}` : `Cash Out ${money(quote.value)}`}
            </button>
          ) : (
            <button onClick={() => notify(quote.reason ?? "Cash out unavailable", "info")} className="flex min-w-0 flex-[1.3] items-center justify-center gap-1 rounded-full border-2 border-brand-green/25 px-2 py-1.5 text-[12px] font-bold leading-tight text-brand-green/45">
              <span>
                Cash Out
                <br />
                Unavailable
              </span>
              <HelpIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
            </button>
          )}
          <button onClick={rebet} className="flex-1 rounded-full border-2 border-brand-green py-2.5 text-[13.5px] font-black text-brand-green-deep">
            Rebet
          </button>
          <button onClick={boostMore} className="flex-[1.5] rounded-full bg-brand-green px-2 py-3 text-[13.5px] font-black text-white">
            Win {pct}% More!
          </button>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* history row                                                          */
/* ------------------------------------------------------------------ */

function HistoryRow({ bet, now }: { bet: Bet; now: number }) {
  const { setSlip, setSlipOpen, notify } = useStore();
  const [open, setOpen] = useState(false);
  const status = bet.status === "open" ? "Unsettled" : bet.status === "won" ? "Won" : bet.status === "lost" ? "Lost" : "Cashed Out";
  const tone = bet.status === "won" || bet.status === "cashed" ? "text-brand-green-deep" : bet.status === "lost" ? "text-brand-red" : "text-brand-ink";

  return (
    <div className="border-b border-black/[0.07]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 py-4 text-left">
        <div>
          <p className="text-[16px] font-black text-brand-ink">{kindLabel(bet)}</p>
          <p className="mt-1 text-[14px] font-semibold text-brand-ink/45">{stamp(bet.placedAt)}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-[18px] font-black", tone)}>{status}</p>
          <p className="mt-1 text-[13.5px] font-semibold text-brand-ink/50">
            Total Stake ({cur()}) <b className="ml-1 text-brand-ink">{money(bet.stake)}</b>
          </p>
          {bet.payout ? (
            <p className="text-[13px] font-semibold text-brand-ink/50">
              Return ({cur()}) <b className="ml-1 text-brand-green-deep">{money(bet.payout)}</b>
            </p>
          ) : null}
        </div>
      </button>
      {open ? (
        <div className="mb-4 space-y-2 rounded-2xl bg-[#f6f7f9] p-3">
          {bet.legs.map((l) => {
            const s = legStatus(l, now);
            return (
              <div key={l.key} className="flex items-start justify-between gap-2 border-b border-black/[0.05] pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-black text-brand-ink">{l.pick}</p>
                  <p className="truncate text-[11px] font-semibold text-brand-ink/50">
                    {l.fixture} · {l.market}
                    {l.finalScore ? ` · FT ${l.finalScore}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {l.odds ? <p className="text-[12px] font-black text-brand-ink">{l.odds.toFixed(2)}</p> : null}
                  <p className={cn("text-[11px] font-black", s.tone)}>{s.text}</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1 text-[11.5px] font-semibold text-brand-ink/55">
            <span>
              Odds <b className="text-brand-ink">{bet.totalOdds ? bet.totalOdds.toFixed(2) : "—"}</b> · Pos.Win <b className="text-brand-ink">{money(bet.potentialWin)}</b>
            </span>
            <span className="text-brand-ink/40">ID {bet.id}</span>
          </div>
          {isSports(bet) ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11.5px] font-bold text-brand-ink/55">
                Code <b className="ml-1 text-[14px] text-brand-ink">{bet.code}</b>
              </span>
              <CopyButton text={bet.code} className="px-3 py-1 text-[11px]" />
              <button
                onClick={() => {
                  const keys = legsOpen(bet, now).map((l) => l.key);
                  if (!keys.length) return notify("All matches on this bet have finished", "info");
                  setSlip(keys);
                  setSlipOpen(true);
                }}
                className="ml-auto rounded-full border-2 border-brand-green px-3 py-1 text-[11.5px] font-black text-brand-green-deep"
              >
                Rebet
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* screen                                                               */
/* ------------------------------------------------------------------ */

export function MyBetsScreen() {
  const { user, open, push } = useStore();
  const now = useClock();
  const [top, setTop] = useState<"open" | "history">("open");
  const [sub, setSub] = useState<"all" | "cashout" | "live" | "virtual">("all");
  const [range, setRange] = useState<"all" | "today" | "week" | "month">("all");
  const [winners, setWinners] = useState(false);
  const [share, setShare] = useState<Bet | null>(null);

  if (!user) {
    return (
      <div className="min-h-full bg-[#f0f1f4] pt-6">
        <EmptyState
          icon={<TicketIcon className="h-7 w-7" strokeWidth={1.8} />}
          title="Log in to see your bets"
          text="Your open bets, bet history, cash out and booking codes appear here."
          action={
            <button onClick={() => open({ type: "auth", mode: "login" })} className="rounded-full bg-brand-green px-5 py-2.5 text-[13px] font-black text-white">
              Log in / Register
            </button>
          }
        />
      </div>
    );
  }

  const openBets = user.bets.filter((b) => b.status === "open");
  const filteredOpen = openBets.filter((b) => {
    if (sub === "cashout") return cashOutQuote(b, now).available;
    if (sub === "live") return b.legs.some((l) => legStatus(l, now).text === "Live");
    if (sub === "virtual") return b.legs.some(isVirtualLeg);
    return true;
  });

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = range === "today" ? start.getTime() : range === "week" ? now - 7 * 86_400_000 : range === "month" ? now - 30 * 86_400_000 : 0;
  const history = user.bets.filter((b) => b.placedAt >= from && (!winners || b.status === "won" || (b.status === "cashed" && (b.payout ?? 0) > 0)));

  return (
    <div className="min-h-full bg-[#f0f1f4] pb-28 lg:pb-8">
      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        {(["open", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTop(t)}
            className={cn("flex items-center justify-center gap-2 rounded-full py-3 text-[16px] transition", top === t ? "bg-white font-black text-brand-ink shadow-sm" : "bg-[#dfe1e6] font-semibold text-brand-ink/75")}
          >
            {t === "open" ? "Open Bets" : "Bet History"}
            {t === "open" ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-ink px-1.5 text-[12px] font-black text-white">{openBets.length}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-t-3xl bg-gradient-to-b from-white to-[#f7f8fa] pt-1 md:mx-3 md:rounded-3xl">
        {top === "open" ? (
          <>
            <div className="no-scrollbar flex justify-between gap-4 overflow-x-auto px-4">
              {(
                [
                  ["all", "All"],
                  ["cashout", "Cashout Available"],
                  ["live", "Live"],
                  ["virtual", "Virtual"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} onClick={() => setSub(k)} className={cn("relative shrink-0 py-3.5 text-[15px] tracking-tight", sub === k ? "font-black text-brand-green-deep" : "font-semibold text-brand-ink/55")}>
                  {l}
                  {sub === k ? <span className="absolute bottom-1.5 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-brand-green" /> : null}
                </button>
              ))}
            </div>
            <div className="space-y-3 bg-[#f0f1f4] px-0 pt-2 md:rounded-b-3xl md:px-3 md:pb-3">
              {filteredOpen.length === 0 ? (
                <div className="bg-white md:rounded-2xl">
                  <EmptyState
                    icon={<TicketIcon className="h-7 w-7" strokeWidth={1.8} />}
                    title={sub === "all" ? "No open bets" : "No bets in this filter"}
                    text={sub === "all" ? "Bets you place appear here until they are settled." : "Try another filter or place a new bet."}
                    action={
                      <button onClick={() => push(SCREENS.today())} className="rounded-full bg-brand-green px-5 py-2.5 text-[13px] font-black text-white">
                        Bet on today's football
                      </button>
                    }
                  />
                </div>
              ) : (
                filteredOpen.map((b) => <OpenBetCard key={b.id} bet={b} now={now} onShare={setShare} />)
              )}
            </div>
          </>
        ) : (
          <div className="px-4 pb-4">
            <div className="flex justify-between">
              {(["all", "today", "week", "month"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={cn("relative px-2 py-3.5 text-[16px] font-black capitalize tracking-tight", range === r ? "text-brand-ink" : "text-brand-ink/50")}>
                  {r}
                  {range === r ? <span className="absolute bottom-1.5 left-1/2 h-[4px] w-6 -translate-x-1/2 rounded-full bg-brand-green" /> : null}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2.5 border-b border-black/[0.07] pb-3 pt-1">
              <span className="text-[13.5px] font-semibold text-brand-ink/60">Show the winners</span>
              <button onClick={() => setWinners((v) => !v)} className={cn("relative h-7 w-12 rounded-full transition", winners ? "bg-brand-green" : "bg-black/15")} aria-pressed={winners}>
                <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", winners ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
            {history.length === 0 ? (
              <p className="py-12 text-center text-[13px] font-semibold text-brand-ink/45">{winners ? "No winning bets in this period yet." : "No bets in this period."}</p>
            ) : (
              history.map((b) => <HistoryRow key={b.id} bet={b} now={now} />)
            )}
          </div>
        )}
      </div>

      {share ? (
        <div className="fixed inset-0 z-[90] md:flex md:justify-center">
          <div className="relative h-full w-full md:max-w-[560px]">
            <ShareSheet code={share.code} count={share.legs.length} odds={share.totalOdds} onClose={() => setShare(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
