import { useState } from "react";
import { ActionForm, Badge, Btn, Card, Input, Loading, Pager, Section, Select, Stat, Table, Tabs, act, downloadCsv, dt, money, statusTone, toast, useRpc, type Row } from "../kit";
import { can } from "../AdminApp";
import { errText, rpc } from "../client";

const day0 = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function preset(p: string): [Date, Date] {
  const today = day0(new Date());
  if (p === "last_week") { const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7)); const prev = new Date(mon); prev.setDate(mon.getDate() - 7); return [prev, mon]; }
  if (p === "last_month") return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 1)];
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  return [new Date(today.getFullYear(), today.getMonth(), 1), tomorrow];
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Calculate({ me }: { me: Row }) {
  const agents = useRpc<Row[]>("admin_list_agents", {});
  const [pre, setPre] = useState("last_month");
  const [from, setFrom] = useState(() => ymd(preset("last_month")[0]));
  const [to, setTo] = useState(() => ymd(preset("last_month")[1]));
  const [agent, setAgent] = useState("");
  const [res, setRes] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const may = can(me, "commissions.calculate");

  const pick = (p: string) => { setPre(p); if (p !== "custom") { const [a, b] = preset(p); setFrom(ymd(a)); setTo(ymd(b)); } setRes(null); };
  const run = async (commit: boolean) => {
    setBusy(true);
    try {
      const r = await rpc<Row>("admin_calculate_commissions", { p_from: new Date(`${from}T00:00:00`).toISOString(), p_to: new Date(`${to}T00:00:00`).toISOString(), p_agent: agent || null, p_commit: commit });
      setRes(r);
      if (commit) toast("Commissions calculated and saved as PENDING for review");
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const rows = (res?.rows as Row[]) ?? [];
  const totals: Record<string, number> = {};
  rows.forEach((r) => { if (!String(r.action).startsWith("skipped")) totals[r.currency] = (totals[r.currency] ?? 0) + Number(r.amount); });

  return (
    <div className="space-y-4">
      <Card title="Calculate commissions">
        <p className="mb-4 text-[12.5px] font-semibold leading-relaxed text-brand-ink/55">Always <b>preview</b> first. Only qualified customers (real deposit, real settled bets, clean account, no chargebacks) generate commission, and revenue share is paid only on <b>net gaming revenue</b> – never on deposits. Negative months are carried forward.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Period" value={pre} onChange={pick} options={[["last_month", "Last month"], ["last_week", "Last week"], ["this_month", "This month so far"], ["custom", "Custom dates"]]} />
          <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPre("custom"); setRes(null); }} />
          <Input label="To (exclusive)" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPre("custom"); setRes(null); }} />
          <Select label="Agent" value={agent} onChange={(v) => { setAgent(v); setRes(null); }} options={[["", "All active agents"], ...((agents.data ?? []).map((a) => [String(a.id), `${a.full_name} (@${a.username})`] as [string, string]))]} />
          <div className="flex items-end gap-2"><Btn variant="dark" busy={busy} onClick={() => void run(false)} className="flex-1">Preview</Btn></div>
        </div>
      </Card>
      {res ? (
        <Card title={res.committed ? "Saved – pending your review" : "Preview (nothing saved yet)"} pad={false} actions={<>{Object.entries(totals).map(([c, n]) => <Badge key={c} tone="green">{money(n, c)}</Badge>)}<Btn size="sm" variant="ghost" onClick={() => downloadCsv("commission-calculation", rows)}>⬇ CSV</Btn>{!res.committed && may && rows.length ? <Btn size="sm" onClick={() => setConfirm(true)}>Save these commissions</Btn> : null}</>}>
          <Table rows={rows} empty="No eligible commissions for this period."
            cols={[
              { head: "Agent", render: (r) => <b>@{r.agent}</b> },
              { head: "Type", render: (r) => (r.kind === "cpa" ? "CPA" : "Revenue share") },
              { head: "Details", render: (r) => r.kind === "cpa" ? <span className="text-[11.5px]">deposit {money(r.deposit, r.currency)} · settled stake {money(r.settled_stake, r.currency)}</span> : <span className="text-[11.5px]">{r.customers} customers · NGR {money(r.ngr, r.currency)}{Number(r.carry_in) ? ` · carried ${money(r.carry_in, r.currency)}` : ""} · base {money(r.base, r.currency)} × {r.rate}%</span> },
              { head: "Amount", align: "right", render: (r) => <b>{money(r.amount, r.currency)}</b> },
              { head: "Result", render: (r) => <Badge tone={r.action === "created" || r.action === "updated" ? "green" : r.action === "preview" ? "blue" : "yellow"}>{String(r.action).replace("_", " ")}</Badge> },
            ]} />
        </Card>
      ) : null}
      {confirm ? <ActionForm title="Save commissions?" intro={`This records ${rows.length} commission line(s) as PENDING. They are not paid until you approve them. Running the same period again never duplicates anything.`} fields={[]} submitLabel="Save as pending" onSubmit={async () => { await run(true); }} onClose={() => setConfirm(false)} /> : null}
    </div>
  );
}

function List({ me }: { me: Row }) {
  const [status, setStatus] = useState("pending");
  const [agent, setAgent] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<null | { kind: "approve" | "reject"; row: Row }>(null);
  const agents = useRpc<Row[]>("admin_list_agents", {});
  const { data, error, loading, reload } = useRpc<Row>("admin_list_commissions", { p_status: status, p_agent: agent || null, p_limit: 50, p_offset: offset });
  const may = can(me, "commissions.approve");
  const rows = (data?.rows as Row[]) ?? [];
  return (
    <Card pad={false} title="Commission transactions" actions={<>
      <Select value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["void", "Void / nothing due"]]} className="!py-1.5 !text-[12px]" />
      <Select value={agent} onChange={(v) => { setAgent(v); setOffset(0); }} options={[["", "All agents"], ...((agents.data ?? []).map((a) => [String(a.id), `@${a.username}`] as [string, string]))]} className="!py-1.5 !text-[12px]" />
      <Btn size="sm" variant="ghost" onClick={() => downloadCsv("commissions", rows.map((r) => ({ created: r.created_at, agent: r.agent, code: r.referral_code, type: r.kind, customer: r.customer, currency: r.currency, period_start: r.period_start, period_end: r.period_end, base_ngr: r.base_amount, rate: r.rate, amount: r.amount, status: r.status, note: r.note })))}>⬇ Export CSV</Btn></>}>
      <Loading error={error} loading={loading && !data}>
        <Table rows={rows} empty="No commissions here."
          cols={[
            { head: "Created", render: (r) => dt(r.created_at) },
            { head: "Agent", render: (r) => <div><b>@{r.agent}</b><p className="text-[11px] text-brand-ink/45">{r.referral_code}</p></div> },
            { head: "Type", render: (r) => (r.kind === "cpa" ? <span>CPA<p className="text-[11px] text-brand-ink/45">{r.customer}</p></span> : "Revenue share") },
            { head: "Period", render: (r) => (r.period_start ? `${dt(r.period_start).split(",")[0]} → ${dt(r.period_end).split(",")[0]}` : "—") },
            { head: "How it was calculated", render: (r) => r.kind === "revshare" ? <span className="text-[11.5px]">NGR {money(r.details?.ngr, r.currency)}{Number(r.details?.carry_in) ? ` + carry ${money(r.details?.carry_in, r.currency)}` : ""} → base {money(r.base_amount, r.currency)} × {r.rate}%</span> : <span className="text-[11.5px]">deposit {money(r.details?.deposit, r.currency)}, settled stake {money(r.details?.settled_stake, r.currency)}</span> },
            { head: "Amount", align: "right", render: (r) => <b>{money(r.amount, r.currency)}</b> },
            { head: "Status", render: (r) => <div><Badge tone={statusTone(r.status)}>{r.status}</Badge>{r.note ? <p className="max-w-[160px] text-[10.5px] text-brand-ink/45">{r.note}</p> : null}</div> },
            { head: "", render: (r) => may && r.status === "pending" ? <span className="flex gap-1.5"><Btn size="sm" onClick={() => setForm({ kind: "approve", row: r })}>Approve</Btn><Btn size="sm" variant="danger" onClick={() => setForm({ kind: "reject", row: r })}>Reject</Btn></span> : null },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={50} offset={offset} onChange={setOffset} />
      </Loading>
      {form ? <ActionForm title={form.kind === "approve" ? `Approve ${money(form.row.amount, form.row.currency)} for @${form.row.agent}` : "Reject commission"} danger={form.kind === "reject"} intro={form.kind === "approve" ? "Approved commissions become available for the agent to withdraw." : undefined} fields={[{ name: "note", label: form.kind === "reject" ? "Reason" : "Note (optional)", type: "textarea", required: form.kind === "reject", minLength: form.kind === "reject" ? 5 : 0 }]} submitLabel={form.kind === "approve" ? "Approve" : "Reject"} onSubmit={async (v) => { const ok = await act("admin_review_commission", { p_id: form.row.id, p_action: form.kind, p_note: v.note || null }, form.kind === "approve" ? "Commission approved" : "Commission rejected"); if (ok) reload(); return ok; }} onClose={() => setForm(null)} /> : null}
    </Card>
  );
}

function Payouts({ me }: { me: Row }) {
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<null | { kind: "approve" | "pay" | "reject"; row: Row }>(null);
  const [review, setReview] = useState<Row | null>(null);
  const wd = useRpc<Row[]>("admin_list_agent_withdrawals", { p_status: status }, 30_000);
  const agents = useRpc<Row[]>("admin_list_agents", {});
  const may = can(me, "agent_payouts.process");
  const pending = (agents.data ?? []).filter((a) => a.payout_status === "pending");
  const run = async (v: Record<string, string | boolean>, f: NonNullable<typeof form>, ok: string) => { const r = await act("admin_process_agent_withdrawal", { p_id: f.row.id, p_action: f.kind, p_note: v.note || null, p_ref: v.ref || null }, ok); if (r) wd.reload(); return r; };
  return (
    <div className="space-y-4">
      {pending.length ? (
        <Card title={`Payment details waiting for approval (${pending.length})`}>
          <div className="space-y-2">{pending.map((a) => (
            <div key={String(a.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fff9dd] px-3 py-2.5">
              <span className="text-[13px] font-bold text-brand-ink">@{a.username} – {a.full_name}</span>
              {may ? <Btn size="sm" variant="dark" onClick={async () => { try { const d = await rpc<Row>("admin_agent_detail", { p_id: a.id }); setReview(d.agent as Row); } catch (e) { toast(errText(e), "err"); } }}>Review details</Btn> : null}
            </div>))}</div>
        </Card>
      ) : null}
      <Card pad={false} title="Agent commission withdrawals" actions={<><Btn size="sm" variant="ghost" onClick={() => wd.reload()}>↻ Refresh</Btn><Select value={status} onChange={setStatus} options={[["", "All"], ["pending", "Pending"], ["approved", "Approved – awaiting payment"], ["paid", "Paid"], ["rejected", "Rejected"]]} className="!py-1.5 !text-[12px]" /></>}>
        <Loading error={wd.error} loading={wd.loading && !wd.data}>
          <Table rows={wd.data ?? []} empty="No agent withdrawal requests here."
            cols={[
              { head: "Requested", render: (r) => dt(r.requested_at) },
              { head: "Agent", render: (r) => <div><b>@{r.agent}</b><p className="text-[11px] text-brand-ink/45">{r.full_name}</p></div> },
              { head: "Amount", align: "right", render: (r) => <b>{money(r.amount, r.currency)}</b> },
              { head: "Pay to", render: (r) => <div><p>{r.method}</p><p className="text-[11px] text-brand-ink/45">{r.account} · {r.account_name}</p></div> },
              { head: "Status", render: (r) => <div><Badge tone={statusTone(r.status)}>{r.status}</Badge>{r.payout_ref ? <p className="text-[10.5px] text-brand-ink/45">ref {r.payout_ref}</p> : null}{r.reject_reason ? <p className="text-[10.5px] text-brand-red">{r.reject_reason}</p> : null}</div> },
              { head: "", render: (r) => may && (r.status === "pending" || r.status === "approved") ? <span className="flex gap-1.5">{r.status === "pending" ? <Btn size="sm" onClick={() => setForm({ kind: "approve", row: r })}>Approve</Btn> : <Btn size="sm" variant="dark" onClick={() => setForm({ kind: "pay", row: r })}>Mark paid</Btn>}<Btn size="sm" variant="danger" onClick={() => setForm({ kind: "reject", row: r })}>Reject</Btn></span> : null },
            ]} />
        </Loading>
      </Card>
      {form?.kind === "approve" ? <ActionForm title="Approve agent payout" fields={[]} intro={`Approve ${money(form.row.amount, form.row.currency)} for @${form.row.agent}? Then send the money and mark it as paid.`} onSubmit={(v) => run(v, form, "Approved")} onClose={() => setForm(null)} /> : null}
      {form?.kind === "pay" ? <ActionForm title="Mark agent payout as paid" intro={`Send ${money(form.row.amount, form.row.currency)} to ${form.row.method} ${form.row.account}, then enter the transaction reference.`} fields={[{ name: "ref", label: "Payment transaction reference", required: true, minLength: 3 }]} onSubmit={(v) => run(v, form, "Marked as paid")} onClose={() => setForm(null)} /> : null}
      {form?.kind === "reject" ? <ActionForm title="Reject agent payout" danger intro="The amount returns to the agent's available balance." fields={[{ name: "note", label: "Reason", type: "textarea", required: true, minLength: 5 }]} onSubmit={(v) => run(v, form, "Rejected")} onClose={() => setForm(null)} /> : null}
      {review ? <ActionForm title={`Payment details – @${review.username}`} intro={<div className="rounded-xl bg-black/[0.05] p-3"><p><b>Method:</b> {review.payout_method}</p><p><b>Account:</b> {review.payout_account}</p><p><b>Account name:</b> {review.payout_name}</p><p className="mt-1 text-[11.5px]">Registered agent name: {review.full_name}</p></div>} fields={[{ name: "decision", label: "Decision", type: "select", def: "approved", options: [["approved", "Approve these details"], ["rejected", "Reject"]] }, { name: "note", label: "Note" }]} onSubmit={async (v) => { const ok = await act("admin_set_agent_payout_status", { p_id: agents.data?.find((a) => a.username === review.username)?.id, p_status: v.decision, p_note: v.note || null }, "Updated"); if (ok) agents.reload(); return ok; }} onClose={() => setReview(null)} /> : null}
    </div>
  );
}

export function CommissionsPage({ me }: { me: Row }) {
  const [tab, setTab] = useState(can(me, "commissions.calculate") ? "calc" : "list");
  const sum = useRpc<Row[]>("admin_list_agents", {});
  const totalAgents = sum.data?.length ?? 0;
  return (
    <div>
      <Section title="Commissions & agent payouts" sub="Calculate, review and pay agent commissions. Every step is recorded." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><Stat label="Agents" value={String(totalAgents)} /><Stat label="Qualified referrals" value={String((sum.data ?? []).reduce((a, r) => a + Number(r.qualified), 0))} /><Stat label="Total referrals" value={String((sum.data ?? []).reduce((a, r) => a + Number(r.referrals), 0))} /></div>
      <div className="mb-4"><Tabs tabs={[["calc", "Calculate"], ["list", "Commission transactions"], ["pay", "Agent payouts"]]} value={tab} onChange={setTab} /></div>
      {tab === "calc" ? <Calculate me={me} /> : tab === "list" ? <List me={me} /> : <Payouts me={me} />}
    </div>
  );
}
