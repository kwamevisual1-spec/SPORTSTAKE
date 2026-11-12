import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { Logo } from "../components/Header";
import { StaffGate } from "./Gate";
import { siteLink } from "./client";
import {
  ActionForm,
  Badge,
  Btn,
  Card,
  Loading,
  Pager,
  Table,
  ToastHost,
  act,
  dday,
  dt,
  fmt,
  money,
  statusTone,
  useRpc,
  type Row,
} from "./kit";
import { staff } from "./client";

/* ------------------------------------------------------------------ */
/* Referrals table                                                     */
/* ------------------------------------------------------------------ */
function Referrals() {
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data, error, loading } = useRpc<Row>("agent_referrals", { p_limit: 25, p_offset: offset, p_search: search || null });

  return (
    <Card pad={false}>
      <div className="border-b border-black/[0.06] p-3.5">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#3b5bfd] px-3 py-3">
            <p className="flex items-center gap-2 text-[13px] font-black text-white">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-white/20">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.6 20c0-2.4-.7-4-1.9-5" /></svg>
              </span>
              Referred Players ({Number(data?.total ?? 0)})
            </p>
          </div>
          <button className="rounded-xl bg-black/[0.04] px-3 py-3 text-left text-[13px] font-black text-brand-ink/60">
            Daily Commission
            <br />
            History
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-ink/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone..." className="w-full bg-transparent text-[13px] font-semibold text-brand-ink outline-none placeholder:text-brand-ink/35" />
        </div>
      </div>
      <Loading error={error} loading={loading && !data}>
        {Number(data?.total ?? 0) === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-semibold text-brand-ink/45">No referred players registered yet</p>
        ) : (
          <>
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-2 border-b border-black/[0.06] bg-black/[0.02] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-brand-ink/45">
              <span>Player details</span>
              <span>Email</span>
              <span>Phone</span>
              <span className="text-right">Wallet</span>
            </div>
            {(data?.rows as Row[]).map((r) => (
              <div key={r.customer} className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center gap-2 border-b border-black/[0.05] px-3 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-brand-ink">{r.customer}</p>
                  <p className="truncate text-[11px] font-semibold text-brand-ink/45">{r.email}</p>
                </div>
                <p className="truncate text-[11.5px] font-semibold text-brand-ink/65">{r.phone || "—"}</p>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-black text-brand-ink">{money(r.deposits, r.currency)}</p>
                  <p className="text-[10px] font-semibold text-brand-ink/45">deposited</p>
                </div>
                <div className="text-right">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </div>
              </div>
            ))}
            <Pager total={Number(data?.total ?? 0)} limit={25} offset={offset} onChange={setOffset} />
          </>
        )}
      </Loading>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */
function Account({ d, reload }: { d: Row; reload: () => void }) {
  const a = d.agent as Row;
  const [form, setForm] = useState<null | "payout" | "pw">(null);
  return (
    <div className="space-y-4">
      <Card title="Payment details" actions={<Badge tone={a.payout_status === "approved" ? "green" : a.payout_status === "pending" ? "yellow" : a.payout_status === "rejected" ? "red" : "gray"}>{a.payout_status === "none" ? "not submitted" : a.payout_status}</Badge>}>
        <p className="mb-3 text-[12.5px] font-semibold leading-relaxed text-brand-ink/55">Commission is paid to these details after our team approves them. Changing them requires approval again.</p>
        {a.payout_method ? (
          <dl className="mb-4 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><dt className="font-bold text-brand-ink/50">Method</dt><dd className="font-black">{a.payout_method}</dd></div>
            <div className="flex justify-between"><dt className="font-bold text-brand-ink/50">Account</dt><dd className="font-black">{a.payout_account}</dd></div>
            <div className="flex justify-between"><dt className="font-bold text-brand-ink/50">Account name</dt><dd className="font-black">{a.payout_name}</dd></div>
          </dl>
        ) : null}
        <Btn variant="dark" onClick={() => setForm("payout")}>{a.payout_method ? "Update payment details" : "Add payment details"}</Btn>
      </Card>
      <Card title="Account & security">
        <dl className="mb-4 space-y-1.5 text-[13px]">
          {(
            [
              ["Username", a.username],
              ["Name", a.full_name],
              ["Email", a.email],
              ["Commission model", a.model === "cpa" ? "CPA" : a.model === "revshare" ? "Revenue share" : "Hybrid"],
              ["Commission rate", a.model === "cpa" ? "CPA only" : `${a.rev_share_pct}%`],
              ["CPA per customer", a.model === "revshare" ? "—" : `GH₵${a.cpa_amount?.GHS ?? 0} / ₦${a.cpa_amount?.NGN ?? 0}`],
              ["Commission period", a.period],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="font-bold text-brand-ink/50">{k}</dt>
              <dd className="text-right font-black capitalize">{v}</dd>
            </div>
          ))}
        </dl>
        <Btn variant="ghost" onClick={() => setForm("pw")}>Change password</Btn>
      </Card>
      {form === "payout" ? (
        <ActionForm
          title="Payment details"
          intro="Enter the account where you want to receive your commission."
          fields={[
            { name: "method", label: "Payment method", type: "select", def: String(a.payout_method ?? "MTN MoMo"), options: [["MTN MoMo", "MTN Mobile Money"], ["Telecel Cash", "Telecel Cash"], ["AirtelTigo Money", "AirtelTigo Money"], ["Bank transfer", "Bank transfer"]] },
            { name: "account", label: "Mobile number / account number", required: true, minLength: 5, def: String(a.payout_account ?? "") },
            { name: "name", label: "Name on the account", required: true, minLength: 2, def: String(a.payout_name ?? "") },
          ]}
          onSubmit={async (v) => {
            const ok = await act("agent_update_payout", { p_method: v.method, p_account: v.account, p_name: v.name }, "Submitted – waiting for approval");
            if (ok) reload();
            return ok;
          }}
          onClose={() => setForm(null)}
        />
      ) : null}
      {form === "pw" ? (
        <ActionForm
          title="Change password"
          fields={[{ name: "a", label: "New password (min. 10 characters)", type: "password", required: true, minLength: 10 }, { name: "b", label: "Confirm new password", type: "password", required: true }]}
          onSubmit={async (v) => {
            if (v.a !== v.b) throw new Error("The two passwords do not match.");
            const { error } = await staff.auth.updateUser({ password: String(v.a) });
            if (error) throw error;
            await act("agent_clear_must_change", {}, "Password changed");
          }}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */
function Shell({ signOut }: { signOut: () => Promise<void> }) {
  const { data, error, loading, reload } = useRpc<Row>("agent_dashboard", {}, 60_000);
  const [tab, setTab] = useState<"dashboard" | "players" | "commissions" | "account">("dashboard");
  const [cur] = useState("GHS");
  const [wd, setWd] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.title = "SportStake Agent Portal";
  }, []);

  const a = (data?.agent as Row) ?? {};
  const link = a.referral_code ? siteLink(String(a.referral_code)) : "";
  const c = (data?.commissions as Row)?.[cur] ?? {};
  const counts = (data?.counts as Row) ?? {};
  const money2 = (n: unknown) => money(n, cur);

  const goToSite = () => {
    window.location.hash = "";
    window.location.reload();
  };

  const menu = [
    { key: "dashboard", label: "Agent Dashboard", icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></svg> },
    { key: "players", label: "My Players", icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.6 20c0-2.4-.7-4-1.9-5" /></svg> },
    { key: "commissions", label: "My Commissions", icon: <span className="text-[19px] font-black">$</span> },
  ];

  return (
    <div className="min-h-dvh bg-[#f3f5f8]">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-brand-yellow">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
          <Logo onClick={() => setTab("dashboard")} />
          <span className="hidden shrink-0 rounded-md bg-[#3b5bfd] px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-white sm:block">AGENT</span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-[#e7f7ec] px-2.5 py-1.5 text-[11.5px] font-black whitespace-nowrap text-brand-green-deep sm:text-[12.5px]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="2.8" y="6" width="18.4" height="13" rx="2.4" /><path d="M2.8 10.4h18.4" /></svg>
              {hidden ? "GH₵••••••" : money2(c.available)}
            </div>
            <Btn size="sm" variant="dark" className="shrink-0" onClick={() => void signOut()}>Sign out</Btn>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-4 p-4">
        <Loading error={error} loading={loading && !data}>
          {data ? (
            <>
              {/* HERO — Agent Command Center */}
              <div className="rounded-2xl bg-[#3b5bfd] p-4 text-white shadow-[0_14px_30px_-16px_rgba(59,91,253,0.7)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/70">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3.2l7.4 2.9v5.6c0 4.4-3.1 7.9-7.4 9.1-4.3-1.2-7.4-4.7-7.4-9.1V6.1z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.4" /></svg>
                      Agent Command Center
                    </p>
                    <p className="mt-1 max-w-[440px] text-[13px] font-medium leading-relaxed text-white/80">
                      Live overview of your referred players, verified accounts, daily commission earnings, and withdrawable balance.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-black">Partner ({Number(a.rev_share_pct ?? 60)}% Cut)</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setWd(true)} className="flex items-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2.5 text-[13px] font-black shadow-lg active:scale-95">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="2.8" y="6" width="18.4" height="13" rx="2.4" /><path d="M2.8 10.4h18.4" /></svg>
                    Withdraw Balance
                  </button>
                  <button onClick={reload} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-black text-[#3b5bfd] active:scale-95">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 11a8 8 0 1 0-2.6 5.9" /><path d="M20 4.5V11h-6.2" /></svg>
                    Refresh Stats
                  </button>
                </div>
              </div>

              {/* Referral link card */}
              <div className="rounded-2xl bg-gradient-to-br from-[#eef2ff] to-white p-4 ring-1 ring-[#3b5bfd]/20">
                <p className="text-[13px] font-black uppercase tracking-wider text-[#3b5bfd]">Your exclusive agent referral link</p>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug text-brand-ink">
                  Share this link to onboard players and earn <b>{Number(a.rev_share_pct ?? 60)}% commission</b> on all player deposits!
                </p>
                <p className="mt-3 text-[13px] font-semibold text-brand-ink/55">
                  Referral Code: <b className="text-[#3b5bfd]">{String(a.referral_code)}</b> · Commission Rate: <b>{Number(a.rev_share_pct ?? 60)}%</b>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-[12.5px] font-bold text-brand-ink ring-1 ring-black/10">{link}</code>
                  <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on SportStake: ${link}`)}`, "_blank", "noopener")} className="flex items-center gap-1.5 rounded-xl bg-[#3b5bfd] px-4 py-2.5 text-[12.5px] font-black text-white active:scale-95">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2.2" /><path d="M15.5 8.5V6.2A2.2 2.2 0 0 0 13.3 4H6.2A2.2 2.2 0 0 0 4 6.2v7.1a2.2 2.2 0 0 0 2.2 2.2h2.3" /></svg>
                    Copy Link
                  </button>
                </div>
              </div>

              {/* Commission balance */}
              <div className="rounded-2xl bg-gradient-to-br from-[#e7f7ec] to-white p-4 ring-1 ring-[#22c55e]/25">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-brand-green-deep">Commission Balance</p>
                    <p className="mt-1 text-[38px] font-black leading-none tracking-tight text-brand-green-deep">
                      {hidden ? "••••••" : money2(c.available)}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-brand-ink/50">Withdrawable Wallet</p>
                  </div>
                  <button onClick={() => setHidden((h) => !h)} aria-label="Toggle balance" className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand-green-deep shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M2.4 12S6 5.8 12 5.8 21.6 12 21.6 12 18 18.2 12 18.2 2.4 12 2.4 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
                <button onClick={() => setWd(true)} className="mt-3 text-[13px] font-black text-brand-green-deep">Withdraw →</button>
              </div>

              {/* Stats cards */}
              <Card title="Total earned (lifetime)">
                <p className="text-[32px] font-black leading-none tracking-tight text-brand-ink">{hidden ? "••••••" : money2(Number(c.approved ?? 0))}</p>
                <p className="mt-1 text-[12px] font-semibold text-brand-ink/45">{Number(a.rev_share_pct ?? 60)}% of player deposits</p>
              </Card>

              <Card title="Pending commission">
                <p className="text-[32px] font-black leading-none tracking-tight text-[#f59e0b]">{hidden ? "••••••" : money2(c.pending)}</p>
                <p className="mt-1 text-[12px] font-semibold text-brand-ink/45">Today's live accrual: {money2(c.pending)}</p>
              </Card>

              <Card title="Referred players">
                <p className="text-[32px] font-black leading-none tracking-tight text-brand-ink">{fmt(counts.referrals, 0)}</p>
                <p className="mt-1 text-[12px] font-semibold text-brand-ink/45">Registered partner accounts</p>
              </Card>

              <Card title="Player deposits">
                <p className="text-[32px] font-black leading-none tracking-tight text-brand-ink">{hidden ? "••••••" : money2((data.eligible_revenue as Row)?.[cur])}</p>
                <p className="mt-1 text-[12px] font-semibold text-brand-ink/45">Eligible net gaming revenue from qualified players</p>
              </Card>

              {/* Quick links */}
              <div className="space-y-2.5">
                {menu.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setTab(m.key as typeof tab)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-black/[0.05] active:scale-[0.99]"
                  >
                    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", m.key === "players" ? "bg-[#eef2ff] text-[#3b5bfd]" : m.key === "commissions" ? "bg-[#f5edff] text-[#9333ea]" : "bg-brand-green-soft text-brand-green")}>
                      {m.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-black text-brand-ink">{m.label}</span>
                      <span className="block text-[12px] font-semibold text-brand-ink/45">
                        {m.key === "players" ? "Full user directory & balances" : "Full daily payouts history"}
                      </span>
                    </span>
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand-ink/30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9.5 5.5l6.5 6.5-6.5 6.5" /></svg>
                  </button>
                ))}
                <button
                  onClick={goToSite}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-black/[0.05] active:scale-[0.99]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e7f7ec] text-brand-green">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2.8" y="6" width="18.4" height="13" rx="2.4" /><path d="M2.8 10.4h18.4" /></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-black text-brand-ink">Wallet & Withdrawals</span>
                    <span className="block text-[12px] font-semibold text-brand-ink/45">Withdraw commission earnings</span>
                  </span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand-ink/30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9.5 5.5l6.5 6.5-6.5 6.5" /></svg>
                </button>
              </div>

              {tab === "players" ? <Referrals /> : null}

              {tab === "commissions" ? (
                <Card pad={false} title="Commissions ledger">
                  <Table rows={((data.recent_commissions as Row[]) ?? []).filter((r) => r.currency === cur)} empty={`No ${cur} commissions yet.`} cols={[
                    { head: "Date", render: (r) => dt(r.created_at) },
                    { head: "Type", render: (r) => (r.kind === "cpa" ? "Per qualified customer" : "Revenue share") },
                    { head: "Period", render: (r) => (r.period_start ? `${dday(r.period_start)} → ${dday(r.period_end)}` : "—") },
                    { head: "Revenue base", align: "right", render: (r) => (r.kind === "revshare" ? money(r.base_amount, r.currency) : "—") },
                    { head: "Rate", align: "right", render: (r) => (r.rate ? `${r.rate}%` : "—") },
                    { head: "Commission", align: "right", render: (r) => <b>{money(r.amount, r.currency)}</b> },
                    { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status === "void" ? "nothing due" : r.status}</Badge> },
                  ]} />
                </Card>
              ) : null}

              {tab === "account" ? <Account d={data} reload={reload} /> : null}

              {/* Withdrawal form */}
              {wd ? (
                <ActionForm
                  title="Request withdrawal"
                  intro={`Available ${cur} balance: ${money2(c.available)}. Paid to ${a.payout_method} ${a.payout_account}.`}
                  fields={[
                    { name: "amount", label: `Amount (${cur})`, type: "number", step: "0.01", required: true },
                  ]}
                  submitLabel="Request"
                  onSubmit={async (v) => {
                    const ok = await act("agent_request_withdrawal", { p_amount: Number(v.amount), p_currency: cur }, "Withdrawal requested");
                    if (ok) reload();
                    return ok;
                  }}
                  onClose={() => setWd(false)}
                />
              ) : null}
            </>
          ) : null}
        </Loading>
      </main>
      <ToastHost />
      <p className="pb-6 text-center text-[11px] font-semibold text-brand-ink/35">SportStake Agent Programme · 18+ · Gamble responsibly</p>
    </div>
  );
}

export default function AgentApp({ recovering }: { recovering: boolean }) {
  useEffect(() => {
    if (!window.location.hash.startsWith("#/agent")) window.location.hash = "/agent";
  }, []);
  return <StaffGate portal="agent" recovering={recovering}>{({ signOut }) => <Shell signOut={signOut} />}</StaffGate>;
}
