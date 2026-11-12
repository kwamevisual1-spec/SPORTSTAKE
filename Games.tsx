import { useEffect, useRef, useState } from "react";
import { ALL_MATCHES, fixtureName, phaseOf, teamName } from "../data";
import { cleanAmount, ghs, kickoffLabel, parseAmount, round2 } from "../lib/format";
import { getPromos } from "../lib/promos";
import { cur, num, sc } from "../lib/currency";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { Crest } from "../components/Crest";
import { ChevronRight, ShareIcon, TrophyIcon } from "../components/Icons";
import { CopyButton, PrimaryButton, ScreenHeader } from "../components/ui";

/* ------------------------------------------------------------------ */
/* Sports Jackpot                                                      */
/* ------------------------------------------------------------------ */

const JACKPOT_MATCHES = ALL_MATCHES.filter((m) => m.sport === "football" && phaseOf(m) === "upcoming").slice(0, 12);
const linePrice = () => sc(2);

export function JackpotScreen() {
  const { back, canBack, placeCustom, notify, user, open } = useStore();
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<string | null>(null);

  const lines = JACKPOT_MATCHES.reduce((a, m) => a * Math.max(1, picks[m.id]?.length ?? 0), 1);
  const complete = JACKPOT_MATCHES.every((m) => (picks[m.id]?.length ?? 0) > 0);
  const filled = JACKPOT_MATCHES.filter((m) => (picks[m.id]?.length ?? 0) > 0).length;
  const cost = complete ? lines * linePrice() : 0;

  const toggle = (id: string, p: string) =>
    setPicks((cur) => {
      const list = cur[id] ?? [];
      return { ...cur, [id]: list.includes(p) ? list.filter((x) => x !== p) : [...list, p] };
    });

  const autoPick = () => setPicks(Object.fromEntries(JACKPOT_MATCHES.map((m) => [m.id, [["1", "X", "2"][Math.floor(Math.random() * 3)]]])));

  const submit = () => {
    if (!complete) return notify(`Pick at least one outcome for all 12 matches (${filled}/12)`, "err");
    if (cost > sc(2000)) return notify(`Maximum ticket cost is ${cur()} ${num(sc(2000))} – reduce doubles/triples`, "err");
    const err = placeCustom({
      kind: "jackpot",
      stake: cost,
      totalOdds: 0,
      potentialWin: sc(8623),
      status: "open",
      note: `${lines} line${lines === 1 ? "" : "s"}`,
      legs: JACKPOT_MATCHES.map((m) => ({ key: m.id, fixture: fixtureName(m), league: m.league, market: "1X2", pick: (picks[m.id] ?? []).join(" / "), odds: 0, live: false })),
    });
    if (err) {
      notify(err, "err");
      if (user) open({ type: "deposit" });
      return;
    }
    setDone(`Ticket submitted · ${lines} line${lines === 1 ? "" : "s"} · ${ghs(cost)}`);
    setPicks({});
  };

  return (
    <div className="min-h-full bg-[#f3f4f6]">
      <ScreenHeader title="Sports Jackpot" onBack={canBack ? back : undefined} />
      <div className="m-3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#065f46] via-[#059669] to-[#34d399] p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Grand jackpot · 12 games</p>
            <p className="text-[30px] font-black leading-none tracking-tight">{cur()} {num(sc(8623))}</p>
            <p className="mt-1.5 text-[11.5px] font-semibold text-white/80">{cur()} {num(linePrice())} per line · 11/12 wins {cur()} {num(sc(500))} · 10/12 wins {cur()} {num(sc(50))}</p>
          </div>
          <TrophyIcon className="h-14 w-14 opacity-40" strokeWidth={1.5} />
        </div>
      </div>
      {done ? (
        <div className="mx-3 mb-3 rounded-2xl bg-brand-green-soft p-3 text-[12.5px] font-black text-brand-green-deep">✓ {done} – view it in My Bets.</div>
      ) : null}
      <div className="mx-3 mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold text-brand-ink/55">{filled}/12 matches picked</p>
        <div className="flex gap-2">
          <button onClick={autoPick} className="rounded-full bg-brand-ink px-3 py-1.5 text-[11px] font-black text-white">
            Auto pick
          </button>
          <button onClick={() => setPicks({})} className="rounded-full bg-black/[0.07] px-3 py-1.5 text-[11px] font-black text-brand-ink">
            Clear
          </button>
        </div>
      </div>
      <div className="mx-3 overflow-hidden rounded-2xl bg-white shadow-sm">
        {JACKPOT_MATCHES.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2 border-b border-black/[0.05] px-3 py-2.5 last:border-0">
            <span className="w-5 text-[11px] font-black text-brand-ink/35">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[12px] font-extrabold text-brand-ink">
                <Crest team={m.home} className="w-4" /> {teamName(m.home)}
              </p>
              <p className="flex items-center gap-1.5 truncate text-[12px] font-extrabold text-brand-ink">
                <Crest team={m.away} className="w-4" /> {teamName(m.away)}
              </p>
              <p className="text-[10px] font-semibold text-brand-ink/40">{kickoffLabel(m.kickoff)}</p>
            </div>
            <div className="grid w-[132px] shrink-0 grid-cols-3 gap-1.5">
              {["1", "X", "2"].map((p) => {
                const active = picks[m.id]?.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggle(m.id, p)}
                    className={cn("h-10 rounded-lg text-[13px] font-black transition active:scale-95", active ? "bg-brand-green text-white" : "bg-brand-green-soft text-brand-green-deep")}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 z-20 mt-3 border-t border-black/[0.06] bg-white px-3 py-2.5 shadow-[0_-10px_20px_-16px_rgba(0,0,0,0.5)]">
        <div className="mb-2 flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-brand-ink/60">
            {lines} line{lines === 1 ? "" : "s"} × {cur()} {num(linePrice())}
          </span>
          <span className="font-black text-brand-ink">Total {ghs(cost)}</span>
        </div>
        <PrimaryButton onClick={submit} disabled={!complete}>
          {complete ? `Submit ticket · ${ghs(cost)}` : `Pick all 12 matches (${filled}/12)`}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pick12 – pick up to 5 numbers from 1–12, 5 balls drawn               */
/* ------------------------------------------------------------------ */

const PICK_PAY = [0, 2.3, 6.3, 21, 95, 750];

export function Pick12Screen() {
  const { back, canBack, placeCustom, requireAuth, notify, user, open } = useStore();
  const [picked, setPicked] = useState<number[]>([]);
  const [stake, setStake] = useState(String(sc(2)));
  const [drawn, setDrawn] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [result, setResult] = useState<{ win: boolean; payout: number } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const drawing = drawn.length > 0 && revealed < 5;

  const toggle = (n: number) => {
    if (drawing) return;
    setResult(null);
    setDrawn([]);
    setRevealed(0);
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 5 ? (notify("You can pick up to 5 numbers", "info"), p) : [...p, n]));
  };

  const play = () => {
    if (!requireAuth()) return;
    if (!picked.length) return notify("Pick at least 1 number", "err");
    const amount = parseAmount(stake);
    if (amount < sc(1)) return notify(`Minimum stake is ${cur()} ${num(sc(1))}.00`, "err");
    const pool = Array.from({ length: 12 }, (_, i) => i + 1);
    const draw: number[] = [];
    while (draw.length < 5) draw.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const win = picked.every((n) => draw.includes(n));
    const payout = win ? round2(amount * PICK_PAY[picked.length]) : 0;
    const err = placeCustom({
      kind: "pick12",
      stake: amount,
      totalOdds: PICK_PAY[picked.length],
      potentialWin: round2(amount * PICK_PAY[picked.length]),
      status: win ? "won" : "lost",
      payout,
      legs: [{ key: "pick12", fixture: `Draw: ${draw.join(", ")}`, league: "Pick12", market: `Pick ${picked.length}`, pick: `Your numbers: ${[...picked].sort((a, b) => a - b).join(", ")}`, odds: PICK_PAY[picked.length], live: false }],
    });
    if (err) {
      notify(err, "err");
      if (user) open({ type: "deposit" });
      return;
    }
    setDrawn(draw);
    setRevealed(0);
    setResult(null);
    draw.forEach((_, i) => timers.current.push(window.setTimeout(() => setRevealed(i + 1), 450 * (i + 1))));
    timers.current.push(window.setTimeout(() => setResult({ win, payout }), 450 * 5 + 200));
  };

  return (
    <div className="min-h-full bg-[#f3f4f6] pb-28">
      <ScreenHeader title="Pick12" onBack={canBack ? back : undefined} />
      <div className="m-3 rounded-3xl bg-gradient-to-br from-[#1e1b4b] to-[#4338ca] p-4 text-white">
        <p className="text-[18px] font-black">Pick up to 5 lucky numbers</p>
        <p className="mt-1 text-[11.5px] font-semibold text-white/70">5 balls are drawn from 1–12. Win if all your numbers are drawn.</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
          {PICK_PAY.slice(1).map((p, i) => (
            <div key={i} className={cn("rounded-lg py-1.5", picked.length === i + 1 ? "bg-brand-yellow text-brand-ink" : "bg-white/10")}>
              <p className="text-[9.5px] font-bold opacity-70">Pick {i + 1}</p>
              <p className="text-[13px] font-black">×{p}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-3 grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 shadow-sm">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
          const isPicked = picked.includes(n);
          const isDrawn = drawn.slice(0, revealed).includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              className={cn(
                "grid aspect-square place-items-center rounded-2xl text-[20px] font-black transition active:scale-95",
                isPicked && isDrawn ? "bg-brand-green text-white ring-4 ring-brand-yellow" : isPicked ? "bg-brand-ink text-white" : isDrawn ? "bg-brand-yellow text-brand-ink" : "bg-black/[0.05] text-brand-ink",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="mx-3 mt-3 flex h-14 items-center justify-center gap-2 rounded-2xl bg-white shadow-sm">
        {drawn.length === 0 ? (
          <span className="text-[12px] font-semibold text-brand-ink/45">Drawn balls appear here</span>
        ) : (
          drawn.map((n, i) => (
            <span key={i} className={cn("grid h-10 w-10 place-items-center rounded-full text-[15px] font-black transition-all", i < revealed ? "animate-pop bg-brand-yellow text-brand-ink" : "bg-black/[0.06] text-transparent")}>
              {n}
            </span>
          ))
        )}
      </div>
      {result ? (
        <p className={cn("mx-3 mt-2 rounded-xl px-3 py-2 text-center text-[13px] font-black", result.win ? "bg-brand-green-soft text-brand-green-deep" : "bg-[#fde8e7] text-brand-red")}>
          {result.win ? `You won ${ghs(result.payout)}!` : "Not this time – try again"}
        </p>
      ) : null}

      <div className="mx-3 mt-3 space-y-2 rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-brand-ink/60">Stake ({cur()})</span>
          <input inputMode="decimal" value={stake} onChange={(e) => setStake(cleanAmount(e.target.value))} className="w-24 rounded-xl border border-black/10 px-3 py-2 text-right text-[15px] font-black outline-none focus:border-brand-green" />
        </div>
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-brand-ink/60">Potential win</span>
          <span className="font-black text-brand-green-deep">{ghs(round2(parseAmount(stake) * PICK_PAY[picked.length]))}</span>
        </div>
        <PrimaryButton onClick={play} disabled={drawing || picked.length === 0}>
          {drawing ? "Drawing…" : picked.length ? `Play Pick ${picked.length} · ${ghs(parseAmount(stake))}` : "Pick your numbers"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Affiliate                                                           */
/* ------------------------------------------------------------------ */

const TIERS = [
  { name: "Bronze", req: "1–10 active referrals", rate: "20%" },
  { name: "Silver", req: "11–50 active referrals", rate: "30%" },
  { name: "Gold", req: "51+ active referrals", rate: "40%" },
];

const AFF_FAQ = [
  { q: "Who counts as a referral?", a: "Any new customer who registers through your link and places at least one bet." },
  { q: "How is commission calculated?", a: "A percentage of the net gaming revenue generated by your referrals, based on your tier." },
  { q: "When am I paid?", a: "Commission is calculated weekly and paid directly into your SportStake wallet every Monday." },
];

export function AffiliateScreen() {
  const { back, canBack, user, open } = useStore();
  const [faq, setFaq] = useState<number | null>(null);
  const code = user ? `SS${user.phone.slice(-6)}` : "";
  const link = `${window.location.origin}${window.location.pathname}sportstake/partner/${code.toUpperCase()}`;

  return (
    <div className="min-h-full bg-[#f3f4f6] pb-28">
      <ScreenHeader title="Refer & Earn" onBack={canBack ? back : undefined} />
      <div className="m-3 rounded-3xl bg-gradient-to-br from-[#b45309] via-[#f59e0b] to-[#fde047] p-5 text-brand-ink">
        <p className="text-[22px] font-black leading-tight">Earn up to 40% commission</p>
        <p className="mt-1 text-[12px] font-semibold text-brand-ink/70">Invite friends to SportStake and earn every week they play.</p>
      </div>

      {user ? (
        <div className="mx-3 space-y-2 rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[11.5px] font-bold text-brand-ink/50">Your referral code</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[26px] font-black text-brand-ink">{code}</span>
            <CopyButton text={code} />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-black/[0.045] py-1.5 pl-3 pr-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-brand-ink/55">{link.replace(/^https?:\/\//, "")}</span>
            <CopyButton text={link} label="Copy link" />
          </div>
          <button
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on SportStake and get a 100% first deposit bonus! ${link}`)}`, "_blank", "noopener,noreferrer")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-[13px] font-black text-white"
          >
            <ShareIcon className="h-4 w-4" strokeWidth={2.2} /> Share on WhatsApp
          </button>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            {[
              ["Referrals", "0"],
              ["This week", `${cur()} 0.00`],
              ["Total earned", `${cur()} 0.00`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-[#f6f7f9] py-2">
                <p className="text-[13px] font-black text-brand-ink">{v}</p>
                <p className="text-[9.5px] font-bold text-brand-ink/45">{l}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-3 rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-[13px] font-semibold text-brand-ink/60">Log in to get your personal referral link.</p>
          <PrimaryButton className="mt-3" onClick={() => open({ type: "auth", mode: "register" })}>
            Join the programme
          </PrimaryButton>
        </div>
      )}

      <div className="mx-3 mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
        <p className="px-3 pt-3 text-[13px] font-black text-brand-ink">Commission tiers</p>
        {TIERS.map((t) => (
          <div key={t.name} className="flex items-center justify-between border-b border-black/[0.05] px-3 py-2.5 last:border-0">
            <div>
              <p className="text-[12.5px] font-black text-brand-ink">{t.name}</p>
              <p className="text-[10.5px] font-semibold text-brand-ink/45">{t.req}</p>
            </div>
            <span className="text-[16px] font-black text-brand-green-deep">{t.rate}</span>
          </div>
        ))}
      </div>

      <div className="mx-3 mt-3 overflow-hidden rounded-2xl bg-white px-3 shadow-sm">
        {AFF_FAQ.map((f, i) => (
          <div key={f.q} className="border-b border-black/[0.05] last:border-0">
            <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between py-3 text-left text-[12.5px] font-black text-brand-ink">
              {f.q}
              <ChevronRight className={cn("h-4 w-4 text-brand-ink/40 transition", faq === i && "rotate-90")} strokeWidth={2.4} />
            </button>
            {faq === i ? <p className="pb-3 text-[11.5px] font-semibold leading-relaxed text-brand-ink/60">{f.a}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

export function PromotionsScreen() {
  const { back, canBack, open } = useStore();
  return (
    <div className="min-h-full bg-[#f3f4f6] pb-28">
      <ScreenHeader title="Promotions" onBack={canBack ? back : undefined} />
      <div className="space-y-3 p-3">
        {getPromos().map((p) => (
          <button key={p.id} onClick={() => open({ type: "promo", id: p.id })} className={cn("relative w-full overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-md active:scale-[0.99]", p.gradient)}>
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[44px] opacity-90">{p.emoji}</span>
            <p className="relative max-w-[75%] text-[16px] font-black leading-tight">{p.title}</p>
            <p className="relative mt-1 max-w-[75%] text-[11.5px] font-semibold text-white/85">{p.sub}</p>
            <span className="relative mt-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-brand-ink">
              {p.cta} <ChevronRight className="h-3 w-3" strokeWidth={3} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
