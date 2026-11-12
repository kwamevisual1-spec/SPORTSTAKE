import { useEffect, useMemo, useState } from "react";
import { ActionForm, Badge, Btn, Card, Input, Loading, Pager, Section, Select, Stat, Table, Tabs, act, downloadCsv, dt, fmt, money, statusTone, useRpc, type Row } from "../kit";
import { can } from "../AdminApp";

const CUR: [string, string][] = [["GHS", "GH₵ Ghana"], ["NGN", "₦ Nigeria"]];

function Withdrawals({ me }: { me: Row }) {
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<null | { kind: "approve" | "pay" | "reject"; row: Row }>(null);
  const { data, error, loading, reload } = useRpc<Row>("admin_list_withdrawals", { p_status: status, p_limit: 25, p_offset: offset }, 30_000);
  const may = can(me, "withdrawals.approve");
  const run = async (id: string, action: string, note: unknown, ref: unknown, ok: string) => {
    const r = await act("admin_process_withdrawal", { p_id: id, p_action: action, p_note: note || null, p_ref: ref || null }, ok);
    if (r) reload();
    return r;
  };
  return (
    <Card pad={false} title="Withdrawal requests" actions={<><Btn size="sm" variant="ghost" onClick={() => reload()}>↻ Refresh</Btn><Select value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[["", "All"], ["pending", "Pending"], ["approved", "Approved – awaiting payment"], ["paid", "Paid"], ["rejected", "Rejected"]]} className="!py-1.5 !text-[12px]" /></>}>
      <Loading error={error} loading={loading && !data}>
        <Table rows={(data?.rows as Row[]) ?? []} empty="No withdrawal requests here."
          cols={[
            { head: "Requested", render: (r) => dt(r.created_at) },
            { head: "Customer", render: (r) => <div><p className="font-black text-brand-ink">{r.email}</p><p className="text-[11px] text-brand-ink/45">{r.phone} · KYC <Badge tone={statusTone(r.kyc_status)}>{r.kyc_status}</Badge> {r.user_status !== "active" ? <Badge tone="red">{r.user_status}</Badge> : null}</p></div> },
            { head: "Amount", align: "right", render: (r) => <b>{money(r.amount, r.currency)}</b> },
            { head: "Pay to", render: (r) => <div><p>{r.method}</p><p className="text-[11px] text-brand-ink/45">{r.account}</p></div> },
            { head: "Wallet now", align: "right", render: (r) => money(r.balance, r.currency) },
            { head: "Status", render: (r) => <div><Badge tone={statusTone(r.status)}>{r.status}</Badge>{r.status === "pending" && r.first_approver ? <p className="mt-0.5 text-[10.5px] font-bold text-[#b45309]">1st approval done – needs a second admin</p> : null}{r.payout_ref ? <p className="text-[10.5px] text-brand-ink/45">ref {r.payout_ref}</p> : null}{r.reject_reason ? <p className="text-[10.5px] text-brand-red">{r.reject_reason}</p> : null}</div> },
            { head: "", render: (r) => may && (r.status === "pending" || r.status === "approved") ? (
              <span className="flex gap-1.5">
                {r.status === "pending" ? <Btn size="sm" onClick={() => setForm({ kind: "approve", row: r })}>Approve</Btn> : <Btn size="sm" variant="dark" onClick={() => setForm({ kind: "pay", row: r })}>Mark paid</Btn>}
                <Btn size="sm" variant="danger" onClick={() => setForm({ kind: "reject", row: r })}>Reject</Btn>
              </span>) : null },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={25} offset={offset} onChange={setOffset} />
      </Loading>
      {form?.kind === "approve" ? <ActionForm title={`Approve ${money(form.row.amount, form.row.currency)}`} intro="Approving confirms the customer is allowed to be paid. Large amounts may need a second administrator." fields={[{ name: "note", label: "Note (optional)", type: "textarea" }]} submitLabel="Approve" onSubmit={(v) => run(String(form.row.id), "approve", v.note, null, "Approved")} onClose={() => setForm(null)} /> : null}
      {form?.kind === "pay" ? <ActionForm title={`Mark ${money(form.row.amount, form.row.currency)} as paid`} intro={`Send the money to ${form.row.method} ${form.row.account} first, then enter the transaction reference.`} fields={[{ name: "ref", label: "Payment transaction reference", required: true, minLength: 3 }]} submitLabel="Confirm paid" onSubmit={(v) => run(String(form.row.id), "pay", null, v.ref, "Marked as paid")} onClose={() => setForm(null)} /> : null}
      {form?.kind === "reject" ? <ActionForm title="Reject withdrawal" danger intro="The money is returned to the customer's wallet automatically." fields={[{ name: "note", label: "Reason (shown in the audit log)", type: "textarea", required: true, minLength: 5 }]} submitLabel="Reject & refund" onSubmit={(v) => run(String(form.row.id), "reject", v.note, null, "Rejected and refunded")} onClose={() => setForm(null)} /> : null}
    </Card>
  );
}

function Payments({ me }: { me: Row }) {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<null | { kind: "rec" | "cb"; row: Row }>(null);
  const { data, error, loading, reload } = useRpc<Row>("admin_list_payments", { p_status: status, p_kind: kind, p_limit: 25, p_offset: offset });
  const may = can(me, "payments.reconcile");
  return (
    <Card pad={false} title="Payments (payment gateway records)" actions={<><Select value={kind} onChange={(v) => { setKind(v); setOffset(0); }} options={[["", "Deposits & withdrawals"], ["deposit", "Deposits"], ["withdrawal", "Withdrawals"]]} className="!py-1.5 !text-[12px]" /><Select value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[["", "Any status"], ["pending", "Pending"], ["succeeded", "Succeeded"], ["failed", "Failed"], ["chargeback", "Chargeback"]]} className="!py-1.5 !text-[12px]" /></>}>
      <Loading error={error} loading={loading && !data}>
        <Table rows={(data?.rows as Row[]) ?? []} empty="No gateway payments recorded yet. They appear here automatically once a payment provider is connected."
          cols={[
            { head: "Date", render: (r) => dt(r.created_at) },
            { head: "Type", render: (r) => r.kind },
            { head: "Customer", render: (r) => r.email || "—" },
            { head: "Provider / reference", render: (r) => <div><p>{r.provider}</p><code className="text-[11px] text-brand-ink/50">{r.provider_ref}</code></div> },
            { head: "Amount", align: "right", render: (r) => money(r.amount, r.currency) },
            { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            { head: "Reconciled", render: (r) => (r.reconciled ? <Badge tone="green">yes</Badge> : <Badge>no</Badge>) },
            { head: "", render: (r) => may ? <span className="flex gap-1.5">{!r.reconciled ? <Btn size="sm" variant="ghost" onClick={() => setForm({ kind: "rec", row: r })}>Reconcile</Btn> : null}{r.kind === "deposit" && r.status === "succeeded" ? <Btn size="sm" variant="danger" onClick={() => setForm({ kind: "cb", row: r })}>Chargeback</Btn> : null}</span> : null },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={25} offset={offset} onChange={setOffset} />
      </Loading>
      {form?.kind === "rec" ? <ActionForm title="Reconcile payment" intro="Confirm this payment matches your gateway statement." fields={[{ name: "note", label: "Note", type: "textarea" }]} onSubmit={async (v) => { const ok = await act("admin_reconcile_payment", { p_id: form.row.id, p_note: v.note || null }, "Reconciled"); if (ok) reload(); return ok; }} onClose={() => setForm(null)} /> : null}
      {form?.kind === "cb" ? <ActionForm title="Record chargeback" danger intro="The deposit is reversed from the customer's wallet (up to their balance) and the customer becomes ineligible for agent commissions." fields={[{ name: "note", label: "Reason", type: "textarea", required: true, minLength: 5 }]} submitLabel="Record chargeback" onSubmit={async (v) => { const ok = await act("admin_record_chargeback", { p_id: form.row.id, p_note: v.note }, "Chargeback recorded"); if (ok) reload(); return ok; }} onClose={() => setForm(null)} /> : null}
    </Card>
  );
}

function Ledger() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [currency, setCurrency] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => { const t = window.setTimeout(() => { setSearch(q.trim()); setOffset(0); }, 350); return () => window.clearTimeout(t); }, [q]);
  const { data, error, loading } = useRpc<Row>("admin_list_ledger", { p_search: search, p_type: type, p_currency: currency, p_limit: 50, p_offset: offset });
  return (
    <Card pad={false} title="Transaction ledger (every money movement)" actions={<Btn size="sm" variant="ghost" onClick={() => downloadCsv("ledger", ((data?.rows as Row[]) ?? []).map((r) => ({ date: r.created_at, customer: r.email, currency: r.currency, type: r.type, amount: r.amount, balance_after: r.balance_after, reference: r.ref, note: r.note })))}>⬇ CSV (this page)</Btn>}>
      <div className="grid gap-3 border-b border-black/[0.06] p-4 sm:grid-cols-[1fr_170px_150px]">
        <Input placeholder="Search reference or customer email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={type} onChange={(v) => { setType(v); setOffset(0); }} options={[["", "All types"], ["deposit", "Deposits"], ["withdrawal", "Withdrawals"], ["bet_stake", "Bet stakes"], ["bet_win", "Bet wins"], ["refund", "Refunds"], ["bonus", "Bonuses"], ["adjustment", "Adjustments"], ["chargeback", "Chargebacks"], ["casino_stake", "Casino stakes"], ["casino_win", "Casino wins"]]} />
        <Select value={currency} onChange={(v) => { setCurrency(v); setOffset(0); }} options={[["", "All currencies"], ["GHS", "GHS"], ["NGN", "NGN"]]} />
      </div>
      <Loading error={error} loading={loading && !data}>
        <Table rows={(data?.rows as Row[]) ?? []} empty="No transactions."
          cols={[
            { head: "Date", render: (r) => dt(r.created_at) },
            { head: "Customer", render: (r) => r.email },
            { head: "Type", render: (r) => <Badge>{String(r.type).replace("_", " ")}</Badge> },
            { head: "Amount", align: "right", render: (r) => <span className={Number(r.amount) < 0 ? "text-brand-red" : "text-brand-green-deep"}>{money(r.amount, r.currency)}</span> },
            { head: "Balance after", align: "right", render: (r) => money(r.balance_after, r.currency) },
            { head: "Reference", render: (r) => <code className="text-[11px]">{r.ref || "—"}</code> },
            { head: "Note", render: (r) => r.note || "" },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={50} offset={offset} onChange={setOffset} />
      </Loading>
    </Card>
  );
}

function Recon() {
  const [cur, setCur] = useState("GHS");
  const [days, setDays] = useState("7");
  const { from, to } = useMemo(() => { const t = new Date(); t.setHours(24, 0, 0, 0); return { to: t.toISOString(), from: new Date(t.getTime() - Number(days) * 86_400_000).toISOString() }; }, [days]);
  const { data, error, loading } = useRpc<Row>("admin_reconcile_summary", { p_currency: cur, p_from: from, p_to: to });
  const diff = Number(data?.gateway_total ?? 0) - Number(data?.ledger_total ?? 0);
  return (
    <div className="space-y-4">
      <Card title="Reconciliation: gateway vs. wallet ledger" actions={<><Select value={cur} onChange={setCur} options={CUR} className="!py-1.5 !text-[12px]" /><Select value={days} onChange={setDays} options={[["1", "Last 24h"], ["7", "Last 7 days"], ["30", "Last 30 days"]]} className="!py-1.5 !text-[12px]" /></>}>
        <Loading error={error} loading={loading && !data}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Succeeded at gateway" value={money(data?.gateway_total, cur)} />
            <Stat label="Credited in ledger" value={money(data?.ledger_total, cur)} />
            <Stat label="Difference" value={money(diff, cur)} tone={Math.abs(diff) < 0.005 ? "good" : "bad"} sub={Math.abs(diff) < 0.005 ? "Fully reconciled" : "Investigate the lists below"} />
          </div>
        </Loading>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Paid at gateway but NOT credited to a wallet" pad={false}>
          <Table rows={(data?.payments_missing_in_ledger as Row[]) ?? []} empty="None – every successful payment was credited." cols={[{ head: "Date", render: (r) => dt(r.created_at) }, { head: "Provider", render: (r) => r.provider }, { head: "Reference", render: (r) => <code>{r.provider_ref}</code> }, { head: "Amount", align: "right", render: (r) => money(r.amount, cur) }]} />
        </Card>
        <Card title="Credited to a wallet but NOT found at gateway" pad={false}>
          <Table rows={(data?.ledger_missing_payment as Row[]) ?? []} empty="None – every deposit has a gateway record." cols={[{ head: "Date", render: (r) => dt(r.created_at) }, { head: "Reference", render: (r) => <code>{r.ref}</code> }, { head: "Amount", align: "right", render: (r) => money(r.amount, cur) }]} />
        </Card>
      </div>
    </div>
  );
}

function GatewayEvents() {
  const { data, error, loading } = useRpc<Row[]>("admin_list_payment_events", { p_limit: 100 }, 30_000);
  return (
    <Card pad={false} title="Payment gateway activity (webhooks received)">
      <Loading error={error} loading={loading && !data}>
        <Table rows={data ?? []} empty="No gateway events yet. Once a payment provider is connected, every webhook it sends is logged here."
          cols={[{ head: "Received", render: (r) => dt(r.received_at) }, { head: "Provider", render: (r) => r.provider }, { head: "Event", render: (r) => r.event }, { head: "Reference", render: (r) => <code>{r.provider_ref}</code> }, { head: "Processed", render: (r) => (r.processed ? <Badge tone="green">yes</Badge> : <Badge tone="yellow">no</Badge>) }, { head: "Error", render: (r) => r.error || "" }]} />
      </Loading>
    </Card>
  );
}

function Report() {
  const [cur, setCur] = useState("GHS");
  const [days, setDays] = useState("30");
  const { from, to } = useMemo(() => { const t = new Date(); t.setHours(24, 0, 0, 0); return { to: t.toISOString(), from: new Date(t.getTime() - Number(days) * 86_400_000).toISOString() }; }, [days]);
  const { data, error, loading } = useRpc<Row>("admin_overview", { p_currency: cur, p_from: from, p_to: to, p_gran: Number(days) > 120 ? "week" : "day" });
  const rows = [...((data?.series as Row[]) ?? [])].reverse();
  const p = data?.period ?? {};
  return (
    <Card pad={false} title="Financial report" actions={<><Select value={cur} onChange={setCur} options={CUR} className="!py-1.5 !text-[12px]" /><Select value={days} onChange={setDays} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]]} className="!py-1.5 !text-[12px]" /><Btn size="sm" variant="ghost" onClick={() => downloadCsv(`financial-report-${cur}`, rows.map((r) => ({ period: String(r.bucket).slice(0, 10), deposits: r.deposits, withdrawals_paid: r.withdrawals_paid, stakes: r.stakes, winnings_paid: r.settled_payout, ggr: r.ggr, bonuses: r.bonuses, ngr: r.ngr })))}>⬇ CSV</Btn></>}>
      <Loading error={error} loading={loading && !data}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Deposits" value={money(p.deposits, cur)} />
          <Stat label="Withdrawals paid" value={money(p.withdrawals_paid, cur)} />
          <Stat label="Net cash flow" value={money(Number(p.deposits) - Number(p.withdrawals_paid), cur)} />
          <Stat label="Revenue (GGR)" value={money(p.ggr, cur)} tone={Number(p.ggr) >= 0 ? "good" : "bad"} />
          <Stat label="Net revenue (NGR)" value={money(p.ngr, cur)} tone={Number(p.ngr) >= 0 ? "good" : "bad"} />
        </div>
        <Table rows={rows} cols={[
          { head: "Period", render: (r) => dt(String(r.bucket)).split(",")[0] },
          { head: "Deposits", align: "right", render: (r) => money(r.deposits, cur) },
          { head: "Withdrawals", align: "right", render: (r) => money(r.withdrawals_paid, cur) },
          { head: "Stakes", align: "right", render: (r) => money(r.stakes, cur) },
          { head: "Winnings", align: "right", render: (r) => money(r.settled_payout, cur) },
          { head: "GGR", align: "right", render: (r) => money(r.ggr, cur) },
          { head: "Bonuses", align: "right", render: (r) => money(r.bonuses, cur) },
          { head: "NGR", align: "right", render: (r) => money(r.ngr, cur) },
        ]} />
        <p className="px-4 py-3 text-[11px] font-semibold text-brand-ink/40">{fmt(rows.length, 0)} periods · GGR = settled stakes − winnings paid · NGR = GGR − bonuses.</p>
      </Loading>
    </Card>
  );
}

export function FinancePage({ me }: { me: Row }) {
  const [tab, setTab] = useState("wd");
  return (
    <div>
      <Section title="Finance" sub="Deposits, withdrawals, payments and reconciliation. Every action is recorded in the audit log." />
      <div className="mb-4"><Tabs tabs={[["wd", "Withdrawals"], ["pay", "Payments"], ["ledger", "Ledger"], ["recon", "Reconciliation"], ["events", "Gateway activity"], ["report", "Reports"]]} value={tab} onChange={setTab} /></div>
      {tab === "wd" ? <Withdrawals me={me} /> : tab === "pay" ? <Payments me={me} /> : tab === "ledger" ? <Ledger /> : tab === "recon" ? <Recon /> : tab === "events" ? <GatewayEvents /> : <Report />}
    </div>
  );
}
