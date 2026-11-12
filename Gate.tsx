import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "../components/Header";
import { staff, rpc, errText, goToSite, type Row } from "./client";
import { Btn, Input, ToastHost } from "./kit";

export type Portal = "admin" | "agent" | "site";

function Frame({ portal, title, sub, children }: { portal: Portal; title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(900px_500px_at_50%_-10%,#fff27a,#f4f6f8_60%)] p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-5 flex justify-center">
          <Logo onClick={() => goToSite()} />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_24px_60px_-30px_rgba(16,19,26,0.55)] ring-1 ring-black/[0.05]">
          <div className="mb-5 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-ink text-[22px] text-brand-yellow">{portal === "admin" ? "🛡" : portal === "agent" ? "🤝" : "🔑"}</span>
            <h1 className="text-[20px] font-black tracking-tight text-brand-ink">{title}</h1>
            {sub ? <p className="mt-1 text-[12.5px] font-semibold text-brand-ink/50">{sub}</p> : null}
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold text-brand-ink/40">{portal === "admin" ? "Authorised personnel only. All activity is logged." : portal === "agent" ? "SportStake Agent Programme" : "SportStake · 18+ · Play responsibly"}</p>
      </div>
      <ToastHost />
    </div>
  );
}

const Err = ({ msg }: { msg: string | null }) => (msg ? <p className="rounded-xl bg-[#fde8e7] px-3 py-2 text-[12.5px] font-bold text-brand-red">{msg}</p> : null);

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
function CodeInput({ onSubmit, busy, label }: { onSubmit: (c: string) => void; busy: boolean; label: string }) {
  const [c, setC] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (c.length === 6) onSubmit(c); }} className="space-y-3">
      <Input label={label} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={c} autoFocus onChange={(e) => setC(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="text-center text-[22px] tracking-[0.4em]" />
      <Btn type="submit" busy={busy} disabled={c.length !== 6} className="w-full">Verify</Btn>
    </form>
  );
}

function MfaVerify({ portal, onDone, signOut }: { portal: Portal; onDone: () => void; signOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const verify = async (code: string) => {
    setBusy(true);
    setErr(null);
    try {
      const { data: f } = await staff.auth.mfa.listFactors();
      const factor = f?.totp?.[0];
      if (!factor) throw new Error("No authenticator is set up for this account.");
      const { error } = await staff.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      onDone();
    } catch (x) {
      setErr(/invalid|expired|code/i.test((x as Error).message) ? "That code is not correct. Wait for a new code and try again." : errText(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame portal={portal} title="Two-factor verification" sub="Open your authenticator app and enter the 6-digit code.">
      <div className="space-y-3">
        <CodeInput onSubmit={verify} busy={busy} label="Authentication code" />
        <Err msg={err} />
        <button onClick={signOut} className="w-full text-center text-[12.5px] font-black text-brand-ink/50">Cancel and sign out</button>
      </div>
    </Frame>
  );
}

function MfaEnroll({ portal, onDone, signOut }: { portal: Portal; onDone: () => void; signOut: () => void }) {
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data: f } = await staff.auth.mfa.listFactors();
        for (const x of f?.all ?? []) if (x.status === "unverified") await staff.auth.mfa.unenroll({ factorId: x.id });
        const { data, error } = await staff.auth.mfa.enroll({ factorType: "totp", friendlyName: `SportStake ${new Date().toISOString().slice(0, 10)}` });
        if (error) throw error;
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (x) {
        setErr(errText(x));
      }
    })();
  }, []);

  const verify = async (code: string) => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await staff.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      onDone();
    } catch (x) {
      setErr(/invalid|expired|code/i.test((x as Error).message) ? "That code is not correct. Wait for a new code and try again." : errText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame portal={portal} title="Set up two-factor authentication" sub="Required for every administrator. This takes one minute.">
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-[12.5px] font-semibold text-brand-ink/65">
        <li>Install <b>Google Authenticator</b>, Microsoft Authenticator or Authy on your phone.</li>
        <li>Scan this QR code (or type the key below).</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {qr ? (
        <div className="mb-4 flex flex-col items-center gap-2">
          <img src={qr} alt="2FA QR code" className="h-44 w-44 rounded-xl border border-black/10 bg-white p-2" />
          <code className="select-all break-all rounded-lg bg-black/[0.05] px-2 py-1 text-center text-[11.5px] font-bold tracking-wider text-brand-ink/70">{secret}</code>
        </div>
      ) : !err ? (
        <div className="grid place-items-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-[3px] border-brand-green/25 border-t-brand-green" /></div>
      ) : null}
      {qr ? <CodeInput onSubmit={verify} busy={busy} label="Code from your app" /> : null}
      <div className="mt-3 space-y-2">
        <Err msg={err} />
        <p className="text-[11px] font-semibold leading-relaxed text-brand-ink/40">Keep your phone safe. If you lose the authenticator, the account owner must remove the factor in Supabase (Authentication → Users) before you can enrol again.</p>
        <button onClick={signOut} className="w-full text-center text-[12.5px] font-black text-brand-ink/50">Cancel and sign out</button>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
function PasswordForm({ portal, title, sub, onDone }: { portal: Portal; title: string; sub: string; onDone: () => Promise<void> }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (a.length < 10) return setErr("Use at least 10 characters.");
    if (!/[a-z]/i.test(a) || !/\d/.test(a)) return setErr("Use letters and numbers.");
    if (a !== b) return setErr("The two passwords do not match.");
    setBusy(true);
    setErr(null);
    try {
      const { error } = await staff.auth.updateUser({ password: a });
      if (error) throw error;
      await onDone();
    } catch (x) {
      setErr(/aal2/i.test((x as Error).message) ? "Please verify with your authenticator code first." : errText(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame portal={portal} title={title} sub={sub}>
      <form onSubmit={submit} className="space-y-3.5">
        <Input label="New password" type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" autoFocus />
        <Input label="Confirm new password" type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
        <Err msg={err} />
        <Btn type="submit" busy={busy} className="w-full">Save password</Btn>
      </form>
    </Frame>
  );
}

export function Recover({ portal, finished }: { portal: Portal; finished: () => void }) {
  const [step, setStep] = useState<"init" | "mfa" | "form" | "bad">("init");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const at = p.get("access_token");
      const rt = p.get("refresh_token");
      window.history.replaceState(null, "", portal === "site" ? window.location.pathname : `${window.location.pathname}#/${portal}`);
      if (!at || !rt) return setStep("bad");
      const { error } = await staff.auth.setSession({ access_token: at, refresh_token: rt });
      if (error) return setStep("bad");
      const a = await staff.auth.mfa.getAuthenticatorAssuranceLevel();
      setStep(a.data?.nextLevel === "aal2" && a.data.currentLevel !== "aal2" ? "mfa" : "form");
    })();
  }, [portal]);
  if (step === "init") return <Frame portal={portal} title="Checking your link…"><div className="grid place-items-center py-8"><span className="h-6 w-6 animate-spin rounded-full border-[3px] border-brand-green/25 border-t-brand-green" /></div></Frame>;
  if (step === "bad") return <Frame portal={portal} title="Link expired"><p className="text-center text-[13px] font-semibold text-brand-ink/60">This reset link is invalid or has expired. Request a new one from the sign-in page.</p><Btn className="mt-5 w-full" variant="dark" onClick={finished}>Back to sign in</Btn></Frame>;
  if (step === "mfa") return <MfaVerify portal={portal} onDone={() => setStep("form")} signOut={finished} />;
  return <PasswordForm portal={portal} title="Choose a new password" sub="Use a long, unique password." onDone={async () => { await staff.auth.signOut(); finished(); }} />;
}

/* ------------------------------------------------------------------ */
export function StaffGate({ portal, recovering, children }: { portal: Portal; recovering: boolean; children: (c: { me: Row; signOut: () => Promise<void> }) => ReactNode }) {
  const [phase, setPhase] = useState<"boot" | "login" | "denied" | "enroll" | "verify" | "recover" | "forcepw" | "ok">(recovering ? "recover" : "boot");
  const [me, setMe] = useState<Row | null>(null);
  const [msg, setMsg] = useState("");

  const evaluate = useCallback(async () => {
    const { data } = await staff.auth.getSession();
    if (!data.session) return setPhase("login");
    try {
      if (portal === "admin") {
        const m = await rpc<Row>("admin_me");
        if (!m.is_admin) {
          setMsg(m.status === "suspended" ? "This administrator account has been suspended." : "This account is not authorised to use the admin portal.");
          return setPhase("denied");
        }
        const a = await staff.auth.mfa.getAuthenticatorAssuranceLevel();
        if (a.data?.currentLevel !== "aal2") return setPhase(a.data?.nextLevel === "aal2" ? "verify" : "enroll");
        setMe(m);
      } else {
        const m = await rpc<Row>("agent_me");
        if (!m.is_agent) {
          setMsg("This account is not an agent account.");
          return setPhase("denied");
        }
        if (m.status !== "active") {
          setMsg(`Your agent account is ${m.status}. Please contact SportStake support.`);
          return setPhase("denied");
        }
        setMe(m);
        if (m.must_change_password) return setPhase("forcepw");
      }
      const k = `ss-logged-${data.session.user.id}`;
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, "1");
        void rpc("staff_login_ok", { p_portal: portal }).catch(() => undefined);
      }
      setPhase("ok");
    } catch (e) {
      setMsg(errText(e));
      setPhase("denied");
    }
  }, [portal]);

  useEffect(() => {
    if (!recovering) void evaluate();
    const { data } = staff.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") window.setTimeout(() => goToSite("login"), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate, recovering]);

  // signing out of a dashboard returns to the normal betting website
  const signOut = useCallback(async () => {
    sessionStorage.setItem("ss-after-staff", "signedout");
    await staff.auth.signOut();
    setMe(null);
    goToSite("signedout");
  }, []);

  // no staff session → there is no separate staff login page: open the website's normal login form
  useEffect(() => {
    if (phase === "login") goToSite("login");
  }, [phase]);

  if (phase === "boot") return <div className="grid min-h-dvh place-items-center bg-brand-yellow"><span className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-ink/20 border-t-brand-ink" /></div>;
  if (phase === "recover") return <Recover portal={portal} finished={() => goToSite("reset-done")} />;
  if (phase === "login") return <div className="grid min-h-dvh place-items-center bg-brand-yellow"><span className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-ink/20 border-t-brand-ink" /></div>;
  if (phase === "verify") return <MfaVerify portal={portal} onDone={() => void evaluate()} signOut={() => void signOut()} />;
  if (phase === "enroll") return <MfaEnroll portal={portal} onDone={() => void evaluate()} signOut={() => void signOut()} />;
  if (phase === "forcepw")
    return (
      <PasswordForm portal={portal} title="Create your own password" sub="For your security, replace the temporary password you were given." onDone={async () => { await rpc("agent_clear_must_change"); await evaluate(); }} />
    );
  if (phase === "denied")
    return (
      <Frame portal={portal} title="Access denied">
        <p className="text-center text-[13px] font-semibold leading-relaxed text-brand-ink/60">{msg}</p>
        <Btn className="mt-5 w-full" variant="dark" onClick={() => void signOut()}>Sign out</Btn>
        <button onClick={() => void signOut()} className="mt-3 block w-full text-center text-[12.5px] font-black text-[#2563eb]">Go to the betting site</button>
      </Frame>
    );
  return <>{me ? children({ me, signOut }) : null}</>;
}
