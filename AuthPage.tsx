import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "../lib/currency";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { Logo } from "./Header";
import { InfoSheet, SiteFooter, type InfoPage } from "./SiteFooter";
import { ChevronDown, CloseIcon, EyeIcon, EyeOffIcon } from "./Icons";
import { PrimaryButton } from "./ui";

type Mode = "login" | "register" | "reset" | "recover";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GhanaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="30" height="6.67" fill="#CE1126" />
      <rect y="6.67" width="30" height="6.66" fill="#FCD116" />
      <rect y="13.33" width="30" height="6.67" fill="#006B3F" />
      <path d="M15 6.4l1.1 3.3h3.4l-2.8 2 1.1 3.3-2.8-2-2.8 2 1.1-3.3-2.8-2h3.4z" fill="#000" />
    </svg>
  );
}

function NigeriaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="10" height="20" fill="#008751" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#008751" />
    </svg>
  );
}

const Flag = ({ code, className }: { code: CurrencyCode; className?: string }) => (code === "GHS" ? <GhanaFlag className={className} /> : <NigeriaFlag className={className} />);

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-bold text-brand-ink/70">{label}</label>
      {children}
      {error ? <p className="mt-1 text-[11.5px] font-bold text-brand-red">{error}</p> : hint ? <p className="mt-1 text-[11px] font-semibold text-brand-ink/45">{hint}</p> : null}
    </div>
  );
}

const box = (bad?: boolean) =>
  cn(
    "w-full rounded-xl border bg-white px-3.5 py-3 text-[14px] font-semibold text-brand-ink outline-none transition placeholder:font-medium placeholder:text-brand-ink/30 focus:ring-2",
    bad ? "border-brand-red focus:ring-brand-red/15" : "border-black/12 focus:border-brand-green focus:ring-brand-green/15",
  );

function PasswordInput({ value, onChange, placeholder, bad, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; bad?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className={cn(box(bad), "pr-11")} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-brand-ink/45">
        {show ? <EyeIcon className="h-5 w-5" /> : <EyeOffIcon className="h-5 w-5" />}
      </button>
    </div>
  );
}

/** Country / Region picker – choosing a country sets the phone code AND the wallet currency. */
function CountryPicker({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = CURRENCIES[value];
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <span className="mb-1.5 block text-[11.5px] font-black uppercase tracking-[0.08em] text-brand-ink/60">Country / Region</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country / Region: ${cur.country}`}
        className={cn("flex w-full items-center gap-3 rounded-2xl border bg-[#f7f8fa] px-4 py-3.5 text-left transition", open ? "border-brand-green ring-2 ring-brand-green/15" : "border-black/10 hover:border-black/20")}
      >
        <span className="w-6 text-[13px] font-black tracking-wide text-brand-ink/70">{cur.iso}</span>
        <span className="text-[15px] font-black text-brand-ink">{cur.country}</span>
        <span className="text-[13px] font-semibold text-brand-ink/45">({cur.dial})</span>
        <span className="ml-auto rounded-md bg-[#e6ebff] px-2 py-0.5 text-[11.5px] font-black text-[#3b4fd8]">{cur.code}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-brand-ink/50 transition", open && "rotate-180")} strokeWidth={2.6} />
      </button>
      {open ? (
        <ul role="listbox" aria-label="Country / Region" className="animate-pop absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-2xl bg-white py-1 shadow-2xl ring-1 ring-black/10">
          {CURRENCY_CODES.map((c) => {
            const x = CURRENCIES[c];
            const active = c === value;
            return (
              <li key={c} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.035]", active && "bg-[#eaf7ef]")}
                >
                  <span className="w-6 text-[13px] font-black tracking-wide text-brand-ink/70">{x.iso}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-black text-brand-ink">{x.country}</span>
                    <span className="block text-[11.5px] font-semibold text-brand-ink/45">{x.code} ({x.symbol})</span>
                  </span>
                  <span className="text-[13px] font-bold text-brand-ink/60">{x.dial}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

const TITLES: Record<Mode, [string, string]> = {
  register: ["Create Account", "Join us today and start your betting journey"],
  login: ["Welcome Back", "Log in to continue betting"],
  reset: ["Forgot Password?", "Enter your email and we will send you a link to reset it"],
  recover: ["Set New Password", "Choose a new password for your account"],
};

export function AuthSheet({ mode: initial, onClose }: { mode: Mode; onClose?: () => void }) {
  const { close: closeOverlay, login, register, forgotPassword, updatePassword, referrer } = useStore();
  const close = onClose ?? closeOverlay;
  const [mode, setMode] = useState<Mode>(initial);
  // the selected country decides BOTH the phone code and the wallet currency – they can never differ
  const [currency, setCurrencyChoice] = useState<CurrencyCode>("GHS");
  const dial = currency;
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [referral, setReferral] = useState(referrer ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [info, setInfo] = useState<InfoPage | null>(null);

  /** remove a field's red error as soon as the player edits it */
  const clear = (k: string) =>
    setErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });

  const go = (m: Mode) => {
    setMode(m);
    setErrors({});
    setFormError(null);
    setSent(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "register") {
      const national = phone.replace(/\D/g, "").replace(/^0+/, "");
      if (national.length !== CURRENCIES[dial].nationalLength) errs.phone = `Enter a valid ${CURRENCIES[dial].country} number, e.g. ${CURRENCIES[dial].example}`;
      if (!EMAIL_RE.test(cleanEmail)) errs.email = "Enter a valid email address";
      if (password.length < 8) errs.password = "Password must be at least 8 characters";
      if (confirm !== password) errs.confirm = "Passwords do not match";
      if (!agree) errs.agree = "You must agree to the Terms & Privacy Policy and confirm you are 18+";
      setErrors(errs);
      setFormError(null);
      if (Object.keys(errs).length) return;
      setBusy(true);
      const err = await register({ phone: `${CURRENCIES[dial].dial}${national}`, email: cleanEmail, currency, password, referral: referral.trim() || undefined });
      setBusy(false);
      if (err) return setFormError(err);
      close();
      return;
    }

    if (mode === "login") {
      const id = email.trim().toLowerCase();
      if (!id) errs.email = "Enter your email or username";
      else if (id.includes("@") && !EMAIL_RE.test(id)) errs.email = "Enter a valid email address";
      if (!password) errs.password = "Enter your password";
      setErrors(errs);
      if (Object.keys(errs).length) return;
      setBusy(true);
      const err = await login(id, password);
      setBusy(false);
      if (err) return setFormError(err);
      close();
      return;
    }

    if (mode === "reset") {
      if (!EMAIL_RE.test(cleanEmail)) errs.email = "Enter a valid email address";
      setErrors(errs);
      if (Object.keys(errs).length) return;
      setBusy(true);
      const err = await forgotPassword(cleanEmail);
      setBusy(false);
      if (err) return setFormError(err);
      setSent(true);
      return;
    }

    // recover
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (confirm !== password) errs.confirm = "Passwords do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const err = await updatePassword(password);
    setBusy(false);
    if (err) return setFormError(err);
    close();
  };

  const [title, subtitle] = TITLES[mode];
  const info2 = CURRENCIES[currency];

  return (
    <div className={cn("absolute inset-0 flex flex-col bg-[#f4f6f8]", onClose ? "z-[96]" : "z-[85]")}>
      <div className="flex h-14 shrink-0 items-center justify-between bg-brand-yellow px-3 shadow-[0_6px_18px_-8px_rgba(16,19,26,0.45)] lg:px-6">
        <Logo onClick={close} />
        <button onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-brand-ink active:bg-black/10">
          <CloseIcon className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[460px] px-4 pb-8 pt-6">
          <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl bg-white p-5 shadow-[0_14px_40px_-24px_rgba(16,19,26,0.5)] ring-1 ring-black/[0.05]">
            <div className="text-center">
              <h1 className="text-[22px] font-black tracking-tight text-brand-ink">{title}</h1>
              <p className="mt-1 text-[12.5px] font-semibold text-brand-ink/50">{subtitle}</p>
            </div>

            {sent ? (
              <div className="space-y-3 rounded-2xl bg-brand-green-soft p-4 text-center">
                <p className="text-[14px] font-black text-brand-green-deep">Check your email</p>
                <p className="text-[12.5px] font-semibold leading-relaxed text-brand-ink/65">If an account exists for {email.trim().toLowerCase()}, we have sent a link to reset your password. It may take a minute to arrive – check your spam folder too.</p>
                <button type="button" onClick={() => go("login")} className="text-[13px] font-black text-brand-green-deep">
                  Back to log in
                </button>
              </div>
            ) : (
              <>
                {mode === "register" ? (
                  <>
                    <div>
                      <CountryPicker value={currency} onChange={(c) => { setCurrencyChoice(c); clear("phone"); }} />
                      <p className="mt-1.5 text-[11px] font-semibold text-brand-ink/45">Your wallet will use {info2.name} ({info2.symbol}). It cannot be changed after registration.</p>
                    </div>

                    <Field label="Phone Number" error={errors.phone}>
                      <div className={cn("flex rounded-xl border bg-white focus-within:ring-2", errors.phone ? "border-brand-red focus-within:ring-brand-red/15" : "border-black/12 focus-within:border-brand-green focus-within:ring-brand-green/15")}>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-black/10 bg-black/[0.03] px-3">
                          <Flag code={dial} className="h-4 w-6 rounded-[3px] shadow-sm ring-1 ring-black/10" />
                          <span className="text-[14px] font-bold text-brand-ink/70">{CURRENCIES[dial].dial}</span>
                        </span>
                        <input
                          inputMode="numeric"
                          autoComplete="tel-national"
                          value={phone}
                          onChange={(e) => (setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 13)), clear("phone"))}
                          placeholder={CURRENCIES[dial].example}
                          className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-3 text-[14px] font-semibold text-brand-ink outline-none placeholder:font-medium placeholder:text-brand-ink/30"
                        />
                      </div>
                    </Field>
                  </>
                ) : null}

                {mode === "register" || mode === "login" || mode === "reset" ? (
                  <Field label={mode === "login" ? "Email or username" : "Email"} error={errors.email}>
                    <input type={mode === "login" ? "text" : "email"} inputMode="email" autoCapitalize="none" autoComplete={mode === "login" ? "username" : "email"} value={email} onChange={(e) => (setEmail(e.target.value), clear("email"))} placeholder={mode === "login" ? "Enter your email or username" : "Enter your email address"} className={box(!!errors.email)} />
                  </Field>
                ) : null}

                {mode === "register" ? (
                  <Field label="Referral Code (Optional)">
                    <input value={referral} onChange={(e) => setReferral(e.target.value.trim())} placeholder="Enter Referral Code" className={box()} />
                  </Field>
                ) : null}

                {mode !== "reset" ? (
                  <Field label={mode === "recover" ? "New Password" : "Password"} error={errors.password}>
                    <PasswordInput value={password} onChange={(v) => (setPassword(v), clear("password"))} placeholder={mode === "login" ? "Enter Password" : "Enter Password (min. 8 characters)"} bad={!!errors.password} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                  </Field>
                ) : null}

                {mode === "register" || mode === "recover" ? (
                  <Field label="Confirm Password" error={errors.confirm}>
                    <PasswordInput value={confirm} onChange={(v) => (setConfirm(v), clear("confirm"))} placeholder="Re-enter your password" bad={!!errors.confirm} autoComplete="new-password" />
                  </Field>
                ) : null}

                {mode === "register" ? (
                  <div>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input type="checkbox" checked={agree} onChange={(e) => (setAgree(e.target.checked), clear("agree"))} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#17a34a]" />
                      <span className="text-[12px] font-medium leading-snug text-brand-ink/65">
                        I agree to the{" "}
                        <button type="button" onClick={() => setInfo("terms")} className="font-bold text-[#2563eb] underline-offset-2 hover:underline">
                          Terms &amp; Privacy Policy
                        </button>{" "}
                        and confirm I am 18+.
                      </span>
                    </label>
                    {errors.agree ? <p className="mt-1 text-[11.5px] font-bold text-brand-red">{errors.agree}</p> : null}
                  </div>
                ) : null}

                {formError ? <p className="rounded-xl bg-[#fde8e7] px-3 py-2.5 text-[12px] font-bold text-brand-red">{formError}</p> : null}

                <PrimaryButton type="submit" disabled={busy}>
                  {busy ? "Please wait…" : mode === "register" ? "Create Account" : mode === "login" ? "Log in" : mode === "reset" ? "Send reset link" : "Update password"}
                </PrimaryButton>

                {mode === "register" ? (
                  <div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-brand-ink/60">
                    <span>
                      Already have an account?{" "}
                      <button type="button" onClick={() => go("login")} className="font-black text-[#2563eb]">
                        Sign in here
                      </button>
                    </span>
                    <button type="button" onClick={() => go("reset")} className="shrink-0 whitespace-nowrap font-black text-[#2563eb]">
                      Forgot Password?
                    </button>
                  </div>
                ) : null}
                {mode === "login" ? (
                  <div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold text-brand-ink/60">
                    <span>
                      New here?{" "}
                      <button type="button" onClick={() => go("register")} className="font-black text-[#2563eb]">
                        Create an account
                      </button>
                    </span>
                    <button type="button" onClick={() => go("reset")} className="shrink-0 whitespace-nowrap font-black text-[#2563eb]">
                      Forgot Password?
                    </button>
                  </div>
                ) : null}
                {mode === "reset" ? (
                  <button type="button" onClick={() => go("login")} className="w-full text-center text-[12.5px] font-black text-[#2563eb]">
                    Back to log in
                  </button>
                ) : null}
              </>
            )}
          </form>
        </div>

        <SiteFooter />
      </div>

      {info ? <InfoSheet page={info} onClose={() => setInfo(null)} /> : null}
    </div>
  );
}
