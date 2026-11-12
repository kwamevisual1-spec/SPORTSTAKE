import { useState } from "react";
import { ALL_MATCHES, SPORTS, SPORT_LABEL, phaseOf } from "../data";
import { cleanAmount, ghs, parseAmount } from "../lib/format";
import { cur, num, sc } from "../lib/currency";
import { useClock } from "../lib/clock";
import { getPromos } from "../lib/promos";
import { SCREENS, useStore } from "../store";
import { cn } from "../utils/cn";
import { sportIcon } from "./SportsbookScreen";
import { CheckIcon, ChevronRight, ShieldIcon } from "./Icons";
import { Field, PrimaryButton, Sheet, inputCls } from "./ui";

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

const PHONE_RE = /^(?:0\d{9}|\+\d{10,14})$/;

export { MatchSheet } from "./MatchSheet";

export { AuthSheet } from "./AuthPage";

/* ------------------------------------------------------------------ */
/* Wallet                                                               */
/* ------------------------------------------------------------------ */

const METHODS = ["MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Visa / Mastercard"];

export function WalletSheet({ kind, method: initialMethod, onClose }: { kind: "deposit" | "withdraw"; method?: string; onClose?: () => void }) {
  const { close: closeOverlay, user, deposit, withdraw, notify } = useStore();
  const close = onClose ?? closeOverlay;
  const [method, setMethod] = useState(initialMethod && METHODS.includes(initialMethod) ? initialMethod : METHODS[0]);
  const [amount, setAmount] = useState(kind === "deposit" ? String(sc(100)) : "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [card, setCard] = useState({ number: "", exp: "", cvv: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isCard = method.startsWith("Visa");

  if (!user) return null;

  const submit = () => {
    setError(null);
    const value = parseAmount(amount);
    if (kind === "deposit" && (value < sc(100) || value > sc(10_000))) return setError(`Minimum deposit is ${cur()} ${num(sc(100))}. Enter ${cur()} ${num(sc(100))} or more.`);
    if (kind === "withdraw" && value < sc(5)) return setError(`Minimum withdrawal is ${cur()} ${num(sc(5))}`);
    if (kind === "withdraw" && value > user.balance) return setError("Amount exceeds your balance");
    if (isCard) {
      if (card.number.replace(/\s/g, "").length < 16) return setError("Enter a valid 16-digit card number");
      if (!/^\d{2}\/\d{2}$/.test(card.exp)) return setError("Enter expiry as MM/YY");
      if (card.cvv.length < 3) return setError("Enter the 3-digit CVV");
    } else if (!PHONE_RE.test(phone)) return setError("Enter a valid mobile money number");

    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (kind === "deposit") {
        const { bonus } = deposit(value, method);
        setDone(`${ghs(value)} deposited${bonus ? ` + ${ghs(bonus)} first deposit bonus` : ""}`);
        notify(`Deposit of ${ghs(value)} successful`);
      } else {
        const err = withdraw(value, method);
        if (err) return setError(err);
        setDone(`${ghs(value)} is on its way to your ${method} account`);
        notify(`Withdrawal of ${ghs(value)} submitted`);
      }
    }, 1400);
  };

  return (
    <Sheet z={onClose ? "z-[96]" : undefined} onClose={close} title={kind === "deposit" ? "Deposit" : "Withdraw"}>
      {done ? (
        <div className="flex flex-col items-center p-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-green text-white">
            <CheckIcon className="h-8 w-8" strokeWidth={3} />
          </span>
          <p className="mt-3 text-[16px] font-black text-brand-ink">{kind === "deposit" ? "Deposit successful" : "Withdrawal submitted"}</p>
          <p className="mt-1 text-[12.5px] font-semibold text-brand-ink/55">{done}</p>
          <p className="mt-3 text-[13px] font-black text-brand-ink">Balance: {ghs(user.balance)}</p>
          <PrimaryButton className="mt-5" onClick={close}>
            Done
          </PrimaryButton>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-brand-ink p-3.5 text-white">
            <p className="text-[11px] font-bold text-white/60">Available balance</p>
            <p className="text-[22px] font-black tracking-tight">{ghs(user.balance)}</p>
          </div>
          <p className="rounded-xl bg-[#fff7d6] px-3 py-2 text-[11.5px] font-bold leading-snug text-[#8a6100]">
            TEST MODE: {kind === "deposit" ? "deposits" : "withdrawals"} are simulated. No real money moves until a payment provider is connected.
          </p>
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold text-brand-ink/60">Payment method</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-[12px] font-black",
                    method === m ? "border-brand-green bg-brand-green-soft text-brand-green-deep" : "border-black/10 text-brand-ink/70",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Field label={`Amount (${cur()})`}>
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(cleanAmount(e.target.value))} placeholder="0.00" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {(kind === "deposit" ? [100, 200, 500, 1000].map(sc) : [...[10, 50, 100].map(sc), Math.floor(user.balance)]).map((q, i) => (
              <button key={`${q}-${i}`} onClick={() => setAmount(String(q))} className="rounded-full bg-black/[0.06] px-3 py-1.5 text-[11.5px] font-black text-brand-ink/70">
                {kind === "withdraw" && i === 3 ? "All" : q}
              </button>
            ))}
          </div>
          {isCard ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Field label="Card number">
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={card.number}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, number: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim() }))
                    }
                    placeholder="1234 5678 9012 3456"
                  />
                </Field>
              </div>
              <Field label="Expiry">
                <input
                  className={inputCls}
                  value={card.exp}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setCard((c) => ({ ...c, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                  }}
                  placeholder="MM/YY"
                />
              </Field>
              <Field label="CVV">
                <input className={inputCls} inputMode="numeric" value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))} placeholder="123" />
              </Field>
            </div>
          ) : (
            <Field label="Mobile money number">
              <input className={inputCls} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
            </Field>
          )}
          {error ? <p className="rounded-lg bg-[#fde8e7] px-3 py-2 text-[11.5px] font-bold text-brand-red">{error}</p> : null}
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? "Processing…" : kind === "deposit" ? `Deposit ${amount ? ghs(parseAmount(amount)) : ""}` : `Withdraw ${amount ? ghs(parseAmount(amount)) : ""}`}
          </PrimaryButton>
          <p className="flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-brand-ink/40">
            <ShieldIcon className="h-3.5 w-3.5" strokeWidth={2} /> {kind === "deposit" ? "You will receive a prompt to approve on your phone" : "Withdrawals are processed to the selected account"}
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* All sports / Load code / Promo                                       */
/* ------------------------------------------------------------------ */

export function AllSportsSheet() {
  const { close, push } = useStore();
  const now = useClock();
  return (
    <Sheet onClose={close} title="All Sports">
      <div className="p-3">
        {SPORTS.map((s) => {
          const all = ALL_MATCHES.filter((m) => m.sport === s && phaseOf(m, now) !== "ft");
          const live = all.filter((m) => phaseOf(m, now) === "live").length;
          const today = all.filter((m) => phaseOf(m, now) === "today").length;
          return (
            <button
              key={s}
              onClick={() => {
                close();
                push(SCREENS.sport(s));
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 text-left active:bg-black/[0.02]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-green-soft text-brand-green">{sportIcon(s)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-black text-brand-ink">{SPORT_LABEL[s]}</span>
                <span className="block text-[11px] font-semibold text-brand-ink/45">
                  {live} live · {today} today · {all.length} events
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-brand-ink/40" strokeWidth={2.4} />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function LoadCodeSheet() {
  const { close, loadCode } = useStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet onClose={close} title="Load Booking Code">
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const err = loadCode(code);
          if (err) setError(err);
          else close();
        }}
      >
        <p className="text-[12px] font-semibold leading-relaxed text-brand-ink/55">
          Got a code from a friend or tipster? Enter it below to load all the selections into your betslip, then stake from your own account.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value.trim());
            setError(null);
          }}
          placeholder="e.g. Mx26ku"
          className={cn(inputCls, "py-3.5 text-center font-mono text-[20px] font-black tracking-[0.15em]")}
        />
        {error ? <p className="rounded-lg bg-[#fde8e7] px-3 py-2 text-[11.5px] font-bold text-brand-red">{error}</p> : null}
        <PrimaryButton type="submit" disabled={code.length < 4}>
          Load selections
        </PrimaryButton>
        <p className="text-center text-[10.5px] font-semibold text-brand-ink/40">Booking codes are case-sensitive.</p>
      </form>
    </Sheet>
  );
}

export function PromoSheet({ id }: { id: string }) {
  const { close, open, go, push, aiSelect, user } = useStore();
  const promo = getPromos().find((p) => p.id === id) ?? getPromos()[0];
  const act = () => {
    switch (promo.action) {
      case "deposit":
        if (user) open({ type: "deposit" });
        else open({ type: "auth", mode: "register" });
        return;
      case "today":
        close();
        push(SCREENS.today());
        return;
      case "mybets":
        close();
        go({ name: "mybets" });
        return;
      case "affiliate":
        close();
        push({ name: "affiliate" });
        return;
      case "jackpot":
        close();
        push({ name: "jackpot" });
        return;
      case "casino":
        close();
        go({ name: "casino" });
        return;
      case "aiselect":
        close();
        aiSelect();
        return;
      case "aviator":
        open({ type: "game", gameId: "aviator" });
        return;
    }
  };
  return (
    <Sheet onClose={close} title={promo.title} footer={<div className="p-3"><PrimaryButton onClick={act}>{promo.action === "deposit" && !user ? "Register & deposit" : promo.cta}</PrimaryButton></div>}>
      <div className={cn("m-3 rounded-2xl bg-gradient-to-br p-5 text-white", promo.gradient)}>
        <span className="text-[38px]">{promo.emoji}</span>
        <p className="mt-1 text-[20px] font-black leading-tight">{promo.title}</p>
        <p className="mt-1 text-[12.5px] font-semibold text-white/85">{promo.sub}</p>
      </div>
      <div className="px-4 pb-4">
        <p className="mb-2 text-[13px] font-black text-brand-ink">How it works</p>
        <ol className="space-y-2">
          {promo.steps.map((s, i) => (
            <li key={s} className="flex gap-2.5 text-[12.5px] font-semibold text-brand-ink/70">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-green text-[10px] font-black text-white">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mb-2 mt-4 text-[13px] font-black text-brand-ink">Terms</p>
        <ul className="space-y-1.5">
          {promo.terms.map((t) => (
            <li key={t} className="text-[11.5px] font-semibold text-brand-ink/50">• {t}</li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
