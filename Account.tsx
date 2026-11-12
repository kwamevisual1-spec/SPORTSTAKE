import { useState } from "react";
import { dateTime, ghs } from "../lib/format";
import { getPromos } from "../lib/promos";
import { cur, num, sc } from "../lib/currency";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import {
  ChevronDown,
  ChevronRight,
  CodeIcon,
  GiftIcon,
  HelpIcon,
  LogoutIcon,
  ShieldIcon,
  TicketIcon,
  AffiliateIcon,
  UserIcon,
  WalletIcon,
} from "../components/Icons";
import { PrimaryButton, ScreenHeader } from "../components/ui";

/* ------------------------------------------------------------------ */
/* Me                                                                  */
/* ------------------------------------------------------------------ */

const FAQ = [
  { q: "How do I use a booking code?", a: "Tap Booking Code on the home page (or Load Code in the betslip), enter the code and all selections are loaded. Set your stake and place the bet from your own account." },
  { q: "How do I share my bet?", a: "Open the betslip and tap Share Bet. You get a booking code and a link you can copy or send directly to WhatsApp, Telegram, Facebook or X." },
  { q: "How does Cash Out work?", a: "Open My Bets and tap Cash Out on any open sports bet to settle it immediately for the value shown." },
  { q: "What is Multiple Boost?", a: "Multiples with 3+ selections get a winnings boost from +3% up to +20% for 10 or more selections." },
];

function Row({ icon, label, sub, onClick, danger }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-black/[0.05] px-3 py-3 text-left last:border-0 active:bg-black/[0.02]">
      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", danger ? "bg-[#fde8e7] text-brand-red" : "bg-brand-green-soft text-brand-green")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13.5px] font-black", danger ? "text-brand-red" : "text-brand-ink")}>{label}</span>
        {sub ? <span className="block truncate text-[11px] font-semibold text-brand-ink/45">{sub}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 text-brand-ink/30" strokeWidth={2.4} />
    </button>
  );
}

export { MyBetsScreen } from "./MyBets";

export function MeScreen() {
  const { user, open, go, push, logout, back, canBack } = useStore();
  const [panel, setPanel] = useState<"tx" | "rg" | "help" | null>(null);
  const [faq, setFaq] = useState<number | null>(0);

  const toggle = (p: "tx" | "rg" | "help") => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="min-h-full bg-[#f3f4f6] pb-28">
      <ScreenHeader title="My Account" onBack={canBack ? back : undefined} />

      {user ? (
        <div className="m-3 rounded-3xl bg-gradient-to-br from-brand-ink to-[#1f2937] p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-yellow text-[18px] font-black text-brand-ink">
              {user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-black">{user.name}</p>
              <p className="text-[11.5px] font-semibold text-white/55">
                {user.email || `${user.phone.slice(0, 4)} ••• ${user.phone.slice(-3)}`} · {cur()} wallet
              </p>
            </div>
          </div>
          <p className="mt-4 text-[11px] font-bold text-white/55">Balance</p>
          <p className="text-[28px] font-black tracking-tight">{ghs(user.balance)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => open({ type: "deposit" })} className="rounded-xl bg-brand-green py-2.5 text-[13px] font-black">
              Deposit
            </button>
            <button onClick={() => open({ type: "withdraw" })} className="rounded-xl bg-white/15 py-2.5 text-[13px] font-black">
              Withdraw
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.07] py-2">
              <p className="text-[16px] font-black">{user.bets.filter((b) => b.status === "open").length}</p>
              <p className="text-[9.5px] font-bold text-white/50">Open bets</p>
            </div>
            <div className="rounded-xl bg-white/[0.07] py-2">
              <p className="text-[16px] font-black">{user.bets.length}</p>
              <p className="text-[9.5px] font-bold text-white/50">Total bets</p>
            </div>
            <div className="rounded-xl bg-white/[0.07] py-2">
              <p className="text-[16px] font-black">{user.tx.filter((t) => t.type === "deposit").length}</p>
              <p className="text-[9.5px] font-bold text-white/50">Deposits</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="m-3 rounded-3xl bg-brand-yellow p-5 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-brand-ink">
            <UserIcon className="h-7 w-7" strokeWidth={2} />
          </span>
          <p className="mt-3 text-[17px] font-black text-brand-ink">Join SportStake</p>
          <p className="mt-1 text-[12px] font-semibold text-brand-ink/65">Register in seconds and get a 100% first deposit bonus up to {cur()} {num(sc(200))}.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => open({ type: "auth", mode: "login" })} className="rounded-xl bg-white py-3 text-[13px] font-black text-brand-ink">
              Log in
            </button>
            <button onClick={() => open({ type: "auth", mode: "register" })} className="rounded-xl bg-brand-ink py-3 text-[13px] font-black text-white">
              Register
            </button>
          </div>
        </div>
      )}

      <div className="mx-3 overflow-hidden rounded-2xl bg-white shadow-sm">
        <Row icon={<TicketIcon className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={2} />} label="My Bets" sub="Open & settled bets, cash out" onClick={() => go({ name: "mybets" })} />
        {user ? <Row icon={<WalletIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Transactions" sub={`${user.tx.length} records`} onClick={() => toggle("tx")} /> : null}
        {panel === "tx" && user ? (
          <div className="max-h-72 overflow-y-auto bg-[#fafbfc] px-3 py-2">
            {user.tx.length === 0 ? (
              <p className="py-4 text-center text-[12px] font-semibold text-brand-ink/45">No transactions yet.</p>
            ) : (
              user.tx.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-black/[0.05] py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold capitalize text-brand-ink">{t.note}</p>
                    <p className="text-[10px] font-semibold text-brand-ink/40">{dateTime(t.at)}</p>
                  </div>
                  <span className={cn("shrink-0 text-[12.5px] font-black", t.amount >= 0 ? "text-brand-green-deep" : "text-brand-ink")}>
                    {t.amount >= 0 ? "+" : "−"}
                    {ghs(Math.abs(t.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
        <Row icon={<CodeIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Load booking code" sub="Stake on a friend's or tipster's code" onClick={() => open({ type: "loadCode" })} />
        <Row icon={<AffiliateIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Refer & Earn" sub="Up to 40% commission" onClick={() => push({ name: "affiliate" })} />
        <Row icon={<GiftIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Promotions" sub={`${getPromos().length} active offers`} onClick={() => push({ name: "promotions" })} />
        <Row icon={<ShieldIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Responsible gaming" sub="Tips & self-control tools" onClick={() => toggle("rg")} />
        {panel === "rg" ? (
          <div className="space-y-2 bg-[#fafbfc] px-4 py-3 text-[11.5px] font-semibold leading-relaxed text-brand-ink/60">
            <p>• Only bet what you can afford to lose and never chase losses.</p>
            <p>• Set a budget before you play and take regular breaks.</p>
            <p>• Betting is for adults 18+ only.</p>
            <p>• If betting stops being fun, talk to someone you trust or a professional counsellor.</p>
          </div>
        ) : null}
        <Row icon={<HelpIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Customer service" sub="Chat with StakeBot and save support requests" onClick={() => window.dispatchEvent(new Event("ss-support"))} />
        <Row icon={<HelpIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Help & FAQ" sub="Booking codes, cash out, boosts" onClick={() => toggle("help")} />
        {panel === "help" ? (
          <div className="bg-[#fafbfc] px-3 py-2">
            {FAQ.map((f, i) => (
              <div key={f.q} className="border-b border-black/[0.05] last:border-0">
                <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between py-2.5 text-left text-[12.5px] font-black text-brand-ink">
                  {f.q}
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-brand-ink/40 transition", faq === i && "rotate-180")} strokeWidth={2.4} />
                </button>
                {faq === i ? <p className="pb-3 text-[11.5px] font-semibold leading-relaxed text-brand-ink/60">{f.a}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        {user ? <Row danger icon={<LogoutIcon className="h-[18px] w-[18px]" strokeWidth={2} />} label="Log out" onClick={logout} /> : null}
      </div>

      {!user ? (
        <div className="mx-3 mt-3">
          <PrimaryButton onClick={() => open({ type: "auth", mode: "register" })}>Create a free account</PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
