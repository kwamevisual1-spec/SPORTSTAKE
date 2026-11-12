import { useState } from "react";
import { ActionForm, Badge, Btn, Card, CopyBtn, Loading, Modal, Section, Stat, Table, act, dt, money, navTo, statusTone, toast, useRpc, type FormField, type Row } from "../kit";
import { can } from "../AdminApp";
import { createLoginAccount, randomPassword } from "../account";
import { errText, portalLink, rpc, siteLink } from "../client";

const MODELS: [string, string][] = [["cpa", "CPA – fixed fee per qualified customer"], ["revshare", "Revenue share – % of net gaming revenue"], ["hybrid", "Hybrid – CPA + revenue share"]];
const PERIODS: [string, string][] = [["monthly", "Monthly"], ["weekly", "Weekly"]];
const modelLabel = (m: string) => (m === "cpa" ? "CPA" : m === "revshare" ? "Revenue share" : "Hybrid");

const commissionFields = (a?: Row): FormField[] => [
  { name: "model", label: "Commission model", type: "select", options: MODELS, def: String(a?.model ?? "revshare") },
  { name: "cpa_g", label: "CPA per qualified customer – GH₵", type: "number", step: "0.01", def: String(a?.cpa_amount?.GHS ?? 0), hint: "Used by CPA and Hybrid" },
  { name: "cpa_n", label: "CPA per qualified customer – ₦", type: "number", step: "0.01", def: String(a?.cpa_amount?.NGN ?? 0) },
  { name: "rev", label: "Commission rate (%) – set any rate 0 to 100", type: "number", step: "0.01", def: String(a?.rev_share_pct ?? 60), hint: "Agent earns this % of net gaming revenue from their qualified players. Default 60%." },
  { name: "period", label: "Calculation period", type: "select", options: PERIODS, def: String(a?.period ?? "monthly") },
];

export function Credentials({ c, onClose }: { c: Row; onClose: () => void }) {
  return (
    <Modal title="Agent created" onClose={onClose}>
      <p className="mb-3 rounded-xl bg-[#fff4c2] px-3 py-2 text-[12.5px] font-bold text-[#8a6100]">Copy these details now and send them to the agent privately. The temporary password is shown only once – the agent must choose their own password at first sign-in.</p>
      <dl className="space-y-2 text-[13px]">
        {([["Agent portal link", c.login], ["Username", c.username], ["Temporary password", c.password], ["Referral code", c.code], ["Referral link", c.link]] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.04] px-3 py-2">
            <div className="min-w-0"><dt className="text-[10.5px] font-black uppercase tracking-wider text-brand-ink/45">{k}</dt><dd className="break-all font-mono text-[12.5px] font-bold text-brand-ink">{v}</dd></div>
            <CopyBtn text={v} />
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11.5px] font-semibold text-brand-ink/45">If “Confirm email” is switched on in Supabase, the agent must first click the confirmation link sent to {c.email}.</p>
      <div className="mt-4 flex justify-end"><Btn onClick={onClose}>Done</Btn></div>
    </Modal>
  );
}

export function AgentsPage({ me }: { me: Row }) {
  const { data, error, loading, reload } = useRpc<Row[]>("admin_list_agents", {}, 60_000);
  const [create, setCreate] = useState(false);
  const [creds, setCreds] = useState<Row | null>(null);
  const agents = data ?? [];

  const submit = async (v: Record<string, string | boolean>) => {
    const email = String(v.email).trim().toLowerCase();
    const username = String(v.username).trim().toLowerCase();
    const code = String(v.code).trim().toUpperCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return void toast("Username must be 3–24 characters: lowercase letters, numbers, underscore.", "err"), false;
    if (agents.some((a) => String(a.username).toLowerCase() === username)) return void toast("That username is already taken.", "err"), false;
    if (code && agents.some((a) => String(a.referral_code).toUpperCase() === code)) return void toast("That referral code is already taken.", "err"), false;
    if (Number(v.rev) < 0 || Number(v.rev) > 100) return void toast("Commission rate must be between 0 and 100 percent.", "err"), false;
    const password = String(v.password).trim() || randomPassword();
    if (password.length < 8) return void toast("Password must be at least 8 characters.", "err"), false;
    let uid: string;
    try {
      uid = await createLoginAccount(email, password);
    } catch (e) {
      toast(errText(e), "err");
      return false;
    }
    try {
      const r = await rpc<Row>("admin_create_agent", { p_user_id: uid, p_username: username, p_full_name: String(v.full_name).trim(), p_email: email, p_phone: String(v.phone).trim() || null, p_model: v.model, p_cpa: { GHS: Number(v.cpa_g), NGN: Number(v.cpa_n) }, p_rev: Number(v.rev), p_period: v.period, p_code: code || null });
      setCreds({ login: portalLink("agent"), username, password, code: r.referral_code, link: siteLink(String(r.referral_code)), email });
      reload();
      return true;
    } catch (e) {
      toast(`${errText(e)} – a login account for ${email} was created but has no agent profile. Delete that user in Supabase → Authentication → Users before trying again.`, "err");
      return false;
    }
  };

  return (
    <div>
      <Section title="Agents" sub="Create agents, set commission terms and share their unique referral links." actions={can(me, "agents.manage") ? <Btn onClick={() => setCreate(true)}>＋ Create agent</Btn> : null} />
      <Card pad={false}>
        <Loading error={error} loading={loading && !data}>
          <Table rows={agents} empty="No agents yet. Click “Create agent” to add your first one." onRow={(r) => navTo(`/admin/agents/${r.id}`)}
            cols={[
              { head: "Agent", render: (r) => <div><p className="font-black text-brand-ink">{r.full_name}</p><p className="text-[11px] text-brand-ink/45">@{r.username} · {r.email}</p></div> },
              { head: "Referral code", render: (r) => <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-bold">{r.referral_code}</code> },
              { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
              { head: "Commission", render: (r) => <div><p>{modelLabel(r.model)}</p><p className="text-[11px] text-brand-ink/45">{r.model !== "cpa" ? `${r.rev_share_pct}%` : ""}{r.model === "hybrid" ? " + " : ""}{r.model !== "revshare" ? `CPA ${r.cpa_amount?.GHS ?? 0} / ${r.cpa_amount?.NGN ?? 0}` : ""} · {r.period}</p></div> },
              { head: "Referrals", align: "right", render: (r) => <span>{r.referrals} <span className="text-[11px] text-brand-ink/40">({r.qualified} qualified)</span></span> },
              { head: "Approved", render: (r) => Object.entries((r.approved as Row) ?? {}).map(([c, n]) => <p key={c}>{money(n, c)}</p>) },
              { head: "Pending", render: (r) => Object.entries((r.pending as Row) ?? {}).map(([c, n]) => <p key={c}>{money(n, c)}</p>) },
              { head: "Payout details", render: (r) => <Badge tone={r.payout_status === "approved" ? "green" : r.payout_status === "pending" ? "yellow" : "gray"}>{r.payout_status}</Badge> },
              { head: "Last login", render: (r) => dt(r.last_login_at) },
            ]} />
        </Loading>
      </Card>
      {create ? (
        <ActionForm wide title="Create agent" submitLabel="Create agent"
          intro="This creates the agent's login and their unique referral link. Leave the password blank to generate a strong temporary one."
          fields={[
            { name: "username", label: "Username (used to sign in)", required: true, placeholder: "e.g. kwame_agent" },
            { name: "full_name", label: "Full name", required: true },
            { name: "email", label: "Email address", type: "email", required: true },
            { name: "phone", label: "Phone number" },
            ...commissionFields(),
            { name: "code", label: "Custom referral code (optional)", hint: "4–16 letters/numbers. Leave blank for AGENT001, AGENT002…" },
            { name: "password", label: "Temporary password (optional)", type: "text", hint: "Leave blank to auto-generate" },
          ]}
          onSubmit={submit} onClose={() => setCreate(false)} />
      ) : null}
      {creds ? <Credentials c={creds} onClose={() => setCreds(null)} /> : null}
    </div>
  );
}

export function AgentDetailPage({ me, id }: { me: Row; id: string }) {
  const d = useRpc<Row>("admin_agent_detail", { p_id: id });
  const comms = useRpc<Row>("admin_list_commissions", can(me, "commissions.view") ? { p_status: "", p_agent: id, p_limit: 100, p_offset: 0 } : null);
  const [form, setForm] = useState<null | "edit" | "status" | "dq">(null);
  const [dq, setDq] = useState<Row | null>(null);
  const a = d.data?.agent as Row | undefined;
  const link = a ? siteLink(String(a.referral_code)) : "";
  const refs = (d.data?.referrals as Row[]) ?? [];
  const manage = can(me, "agents.manage");

  return (
    <div>
      <button onClick={() => navTo("/admin/agents")} className="mb-3 text-[12.5px] font-black text-[#2563eb]">‹ All agents</button>
      <Loading error={d.error} loading={d.loading && !d.data}>
        {a ? (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-[20px] font-black tracking-tight text-brand-ink">{a.full_name} <span className="text-[14px] font-bold text-brand-ink/40">@{a.username}</span></h1>
                  <p className="text-[12.5px] font-semibold text-brand-ink/50">{a.email} · {a.phone || "no phone"} · joined {dt(a.created_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={statusTone(a.status)}>{a.status}</Badge><Badge tone="blue">{modelLabel(a.model)}</Badge><Badge>{a.period}</Badge><Badge tone={a.payout_status === "approved" ? "green" : "yellow"}>payout details: {a.payout_status}</Badge></div>
                </div>
                {manage ? <div className="flex flex-wrap gap-2"><Btn variant="dark" onClick={() => setForm("edit")}>Edit commission</Btn><Btn variant={a.status === "active" ? "danger" : "primary"} onClick={() => setForm("status")}>{a.status === "active" ? "Suspend / deactivate" : "Reactivate"}</Btn></div> : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-green-soft p-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-brand-green-deep">Referral link</span>
                <code className="min-w-0 flex-1 break-all text-[12.5px] font-bold text-brand-ink">{link}</code>
                <CopyBtn text={link} label="Copy link" /><CopyBtn text={String(a.referral_code)} label="Copy code" />
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Referrals" value={String(refs.length)} sub={`${refs.filter((r) => r.status === "qualified").length} qualified · ${refs.filter((r) => r.status === "disqualified").length} disqualified`} />
              <Stat label="Available balance GH₵" value={money((d.data?.balances as Row)?.GHS, "GHS")} />
              <Stat label="Available balance ₦" value={money((d.data?.balances as Row)?.NGN, "NGN")} />
              <Stat label="Rates" value={a.model === "cpa" ? "CPA only" : `${a.rev_share_pct}%`} sub={a.model !== "revshare" ? `CPA GH₵${a.cpa_amount?.GHS ?? 0} / ₦${a.cpa_amount?.NGN ?? 0}` : "revenue share"} />
            </div>
            <Card title="Referred customers" pad={false}>
              <Table rows={refs} empty="No customers have registered through this agent's link yet."
                cols={[
                  { head: "Customer", render: (r) => r.email },
                  { head: "Currency", render: (r) => r.currency },
                  { head: "Registered", render: (r) => dt(r.registered_at) },
                  { head: "Status", render: (r) => <div><Badge tone={statusTone(r.status)}>{r.status}</Badge>{r.disqualified_reason ? <p className="text-[10.5px] text-brand-red">{r.disqualified_reason}</p> : null}{(r.flags as string[])?.length ? <p className="text-[10.5px] text-brand-red">⚑ {(r.flags as string[]).join(", ")}</p> : null}</div> },
                  { head: "Deposits", align: "right", render: (r) => money(r.deposits, r.currency) },
                  { head: "", render: (r) => manage && r.status !== "disqualified" ? <Btn size="sm" variant="ghost" onClick={() => setDq(r)}>Disqualify</Btn> : null },
                ]} />
            </Card>
            <Card title="Commissions" pad={false}>
              <Loading error={comms.error} loading={comms.loading && !comms.data}>
                <Table rows={(comms.data?.rows as Row[]) ?? []} empty="No commissions calculated yet."
                  cols={[
                    { head: "Created", render: (r) => dt(r.created_at) },
                    { head: "Type", render: (r) => (r.kind === "cpa" ? `CPA – ${r.customer ?? ""}` : "Revenue share") },
                    { head: "Period", render: (r) => (r.period_start ? `${dt(r.period_start).split(",")[0]} → ${dt(r.period_end).split(",")[0]}` : "—") },
                    { head: "Base (NGR)", align: "right", render: (r) => (r.kind === "revshare" ? money(r.base_amount, r.currency) : "—") },
                    { head: "Rate", align: "right", render: (r) => (r.rate ? `${r.rate}%` : "—") },
                    { head: "Amount", align: "right", render: (r) => <b>{money(r.amount, r.currency)}</b> },
                    { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
                  ]} />
              </Loading>
            </Card>
            <Card title="Payout requests" pad={false}>
              <Table rows={(d.data?.withdrawals as Row[]) ?? []} empty="No payout requests."
                cols={[{ head: "Requested", render: (r) => dt(r.requested_at) }, { head: "Amount", align: "right", render: (r) => money(r.amount, r.currency) }, { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }, { head: "Reference", render: (r) => r.payout_ref || r.reject_reason || "—" }]} />
            </Card>
          </div>
        ) : null}
      </Loading>
      {form === "edit" && a ? <ActionForm title="Edit commission terms" intro="Changes apply to FUTURE calculations only. The old and new values are recorded in the audit log." fields={[{ name: "full_name", label: "Full name", def: String(a.full_name) }, { name: "phone", label: "Phone", def: String(a.phone ?? "") }, ...commissionFields(a)]} onSubmit={async (v) => { const ok = await act("admin_update_agent", { p_id: id, p_full_name: v.full_name, p_phone: v.phone, p_model: v.model, p_cpa: { GHS: Number(v.cpa_g), NGN: Number(v.cpa_n) }, p_rev: Number(v.rev), p_period: v.period }, "Agent updated"); if (ok) d.reload(); return ok; }} onClose={() => setForm(null)} /> : null}
      {form === "status" && a ? <ActionForm title="Change agent status" intro="Suspended or deactivated agents stop receiving new referrals and cannot withdraw. Existing referrals are kept." fields={[{ name: "status", label: "New status", type: "select", def: a.status === "active" ? "suspended" : "active", options: [["active", "Active"], ["suspended", "Suspended"], ["deactivated", "Deactivated"]] }, { name: "reason", label: "Reason", type: "textarea" }]} onSubmit={async (v) => { const ok = await act("admin_set_agent_status", { p_id: id, p_status: v.status, p_reason: v.reason || null }, "Status updated"); if (ok) d.reload(); return ok; }} onClose={() => setForm(null)} /> : null}
      {dq ? <ActionForm title="Disqualify referral" danger intro={`${dq.email} will no longer count towards this agent's commissions. Any pending CPA for this customer is voided.`} fields={[{ name: "reason", label: "Reason", type: "textarea", required: true, minLength: 5 }]} submitLabel="Disqualify" onSubmit={async (v) => { const ok = await act("admin_disqualify_referral", { p_user: dq.user_id, p_reason: v.reason }, "Referral disqualified"); if (ok) d.reload(); return ok; }} onClose={() => setDq(null)} /> : null}
    </div>
  );
}
