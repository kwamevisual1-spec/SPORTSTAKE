import { useEffect, useState } from "react";
import { ActionForm, Badge, Btn, Card, Loading, Pager, Section, Select, Stat, Table, Tabs, act, dt, money, navTo, statusTone, toast, useRpc, Input, type Row } from "../kit";
import { can } from "../AdminApp";

export function UsersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(q.trim()); setOffset(0); }, 350);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data, error, loading } = useRpc<Row>("admin_list_users", { p_search: search, p_status: status, p_currency: currency, p_limit: 25, p_offset: offset });
  return (
    <div>
      <Section title="Customers" sub="Search by email, phone number, name or user ID. Passwords are never visible to administrators." />
      <Card pad={false}>
        <div className="grid gap-3 border-b border-black/[0.06] p-4 sm:grid-cols-[1fr_170px_150px]">
          <Input placeholder="Search email, phone, name or user ID…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[["", "All statuses"], ["active", "Active"], ["restricted", "Restricted"], ["suspended", "Suspended"]]} />
          <Select value={currency} onChange={(v) => { setCurrency(v); setOffset(0); }} options={[["", "All currencies"], ["GHS", "GHS"], ["NGN", "NGN"]]} />
        </div>
        <Loading error={error} loading={loading && !data}>
          <Table
            rows={(data?.rows as Row[]) ?? []}
            empty="No customers match your search."
            onRow={(r) => navTo(`/admin/users/${r.id}`)}
            cols={[
              { head: "Customer", render: (r) => <div><p className="font-black text-brand-ink">{r.email || "—"}</p><p className="text-[11px] text-brand-ink/45">{r.phone || r.full_name || String(r.id).slice(0, 8)}</p></div> },
              { head: "Currency", render: (r) => r.currency },
              { head: "Balance", align: "right", render: (r) => money(r.balance, r.currency) },
              { head: "Status", render: (r) => <span className="flex gap-1"><Badge tone={statusTone(r.status)}>{r.status}</Badge>{r.risk_flag ? <Badge tone="red">flagged</Badge> : null}</span> },
              { head: "KYC", render: (r) => <Badge tone={statusTone(r.kyc_status)}>{r.kyc_status}</Badge> },
              { head: "Joined", render: (r) => dt(r.created_at) },
            ]}
          />
          <Pager total={Number(data?.total ?? 0)} limit={25} offset={offset} onChange={setOffset} />
        </Loading>
      </Card>
    </div>
  );
}

export function UserDetailPage({ me, id }: { me: Row; id: string }) {
  const [tab, setTab] = useState("summary");
  const [form, setForm] = useState<null | "status" | "kyc" | "flag" | "bonus">(null);
  const d = useRpc<Row>("admin_user_detail", { p_id: id });
  const bets = useRpc<Row>("admin_list_bets", tab === "bets" ? { p_status: "", p_search: "", p_user: id, p_limit: 50, p_offset: 0 } : null);
  const ledger = useRpc<Row[]>("admin_user_ledger", tab === "ledger" ? { p_id: id, p_limit: 200 } : null);
  const promos = useRpc<Row[]>("admin_list_promotions", form === "bonus" ? {} : null);
  const p = d.data?.profile as Row | undefined;
  const t = (d.data?.totals as Row) ?? {};
  const cur = p?.currency as string;

  return (
    <div>
      <button onClick={() => navTo("/admin/users")} className="mb-3 text-[12.5px] font-black text-[#2563eb]">‹ All customers</button>
      <Loading error={d.error} loading={d.loading && !d.data}>
        {p ? (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-[20px] font-black tracking-tight text-brand-ink">{p.email || "Customer"}</h1>
                  <p className="text-[12.5px] font-semibold text-brand-ink/50">{p.phone} · ID {String(p.id)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    <Badge tone={statusTone(p.kyc_status)}>KYC {p.kyc_status}</Badge>
                    <Badge tone="blue">{p.currency} wallet</Badge>
                    {p.risk_flag ? <Badge tone="red">flagged</Badge> : null}
                  </div>
                  {p.status_reason ? <p className="mt-2 text-[12px] font-semibold text-brand-ink/55">Reason: {p.status_reason}</p> : null}
                  {p.risk_note ? <p className="text-[12px] font-semibold text-brand-red">Flag note: {p.risk_note}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {can(me, "users.manage") ? <Btn variant="dark" onClick={() => setForm("status")}>Change status</Btn> : null}
                  {can(me, "users.kyc") ? <Btn variant="ghost" onClick={() => setForm("kyc")}>KYC</Btn> : null}
                  {can(me, "users.manage") ? <Btn variant={p.risk_flag ? "ghost" : "danger"} onClick={() => setForm("flag")}>{p.risk_flag ? "Clear flag" : "Flag as suspicious"}</Btn> : null}
                  {can(me, "promotions.manage") ? <Btn variant="yellow" onClick={() => setForm("bonus")}>Grant bonus</Btn> : null}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Balance" value={money(d.data?.balance, cur)} />
              <Stat label="Total deposits" value={money(t.deposits, cur)} />
              <Stat label="Withdrawals paid" value={money(t.withdrawals_paid, cur)} />
              <Stat label="Bets placed" value={String(t.bets ?? 0)} sub={`Staked ${money(t.stakes, cur)}`} />
              <Stat label="Settled stake" value={money(t.settled_stake, cur)} />
              <Stat label="Winnings paid" value={money(t.settled_payout, cur)} />
              <Stat label="Net result for house" value={money(Number(t.settled_stake) - Number(t.settled_payout), cur)} tone={Number(t.settled_stake) - Number(t.settled_payout) >= 0 ? "good" : "bad"} />
              <Stat label="Bonuses received" value={money(t.bonuses, cur)} />
            </div>

            <Tabs tabs={[["summary", "Summary"], ["bets", "Betting history"], ["ledger", "Transactions"], ["wd", "Withdrawals"]]} value={tab} onChange={setTab} />

            {tab === "summary" ? (
              <Card title="Account & referral">
                <dl className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                  {[["Registered", dt(p.created_at)], ["Referred by", d.data?.referral ? `${(d.data.referral as Row).agent} (${(d.data.referral as Row).referral_code}) – ${(d.data.referral as Row).status}` : "Not referred"], ["Referral code typed", p.referred_by || "—"], ["Self-exclusion until", p.self_excluded_until ? dt(p.self_excluded_until) : "—"], ["KYC note", p.kyc_note || "—"]].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between gap-3 border-b border-black/[0.05] py-1.5"><dt className="font-bold text-brand-ink/50">{k}</dt><dd className="text-right font-black text-brand-ink">{String(v)}</dd></div>
                  ))}
                </dl>
              </Card>
            ) : null}
            {tab === "bets" ? (
              <Card pad={false}>
                <Loading error={bets.error} loading={bets.loading}>
                  <Table rows={(bets.data?.rows as Row[]) ?? []} empty="No bets yet."
                    cols={[
                      { head: "Placed", render: (r) => dt(r.placed_at) },
                      { head: "Type", render: (r) => r.kind },
                      { head: "Selections", render: (r) => <div className="max-w-[320px] space-y-0.5">{(r.legs as Row[]).map((l, i) => <p key={i} className="truncate text-[11.5px]">{l.event} · {l.market}:{l.selection} @{l.odds} {l.result ? <Badge tone={statusTone(l.result)}>{l.result}</Badge> : null}</p>)}</div> },
                      { head: "Stake", align: "right", render: (r) => money(r.stake, cur) },
                      { head: "Odds", align: "right", render: (r) => r.total_odds },
                      { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
                      { head: "Payout", align: "right", render: (r) => (r.payout !== null ? money(r.payout, cur) : "—") },
                    ]} />
                </Loading>
              </Card>
            ) : null}
            {tab === "ledger" ? (
              <Card pad={false}>
                <Loading error={ledger.error} loading={ledger.loading}>
                  <Table rows={ledger.data ?? []} empty="No transactions yet."
                    cols={[
                      { head: "Date", render: (r) => dt(r.created_at) },
                      { head: "Type", render: (r) => <Badge>{String(r.type).replace("_", " ")}</Badge> },
                      { head: "Amount", align: "right", render: (r) => <span className={Number(r.amount) < 0 ? "text-brand-red" : "text-brand-green-deep"}>{money(r.amount, cur)}</span> },
                      { head: "Balance after", align: "right", render: (r) => money(r.balance_after, cur) },
                      { head: "Reference", render: (r) => <code className="text-[11px]">{r.ref || "—"}</code> },
                      { head: "Note", render: (r) => r.note || "" },
                    ]} />
                </Loading>
              </Card>
            ) : null}
            {tab === "wd" ? (
              <Card pad={false}>
                <Table rows={(d.data?.withdrawals as Row[]) ?? []} empty="No withdrawals."
                  cols={[
                    { head: "Requested", render: (r) => dt(r.created_at) },
                    { head: "Amount", align: "right", render: (r) => money(r.amount, cur) },
                    { head: "Method", render: (r) => r.method },
                    { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
                    { head: "Reason", render: (r) => r.reject_reason || "" },
                  ]} />
              </Card>
            ) : null}
          </div>
        ) : null}
      </Loading>

      {form === "status" ? (
        <ActionForm title="Change account status" intro="Restricted: cannot bet but can withdraw. Suspended: cannot bet or withdraw (funds frozen). A reason is recorded in the audit log."
          fields={[{ name: "status", label: "New status", type: "select", def: "restricted", options: [["active", "Active (reactivate)"], ["restricted", "Restricted"], ["suspended", "Suspended"]] }, { name: "reason", label: "Reason", type: "textarea", required: true, minLength: 5 }]}
          onSubmit={async (v) => { const ok = await act("admin_set_user_status", { p_id: id, p_status: v.status, p_reason: v.reason }, "Status updated"); if (ok) d.reload(); return ok; }} onClose={() => setForm(null)} />
      ) : null}
      {form === "kyc" ? (
        <ActionForm title="KYC verification" fields={[{ name: "status", label: "KYC status", type: "select", def: String(p?.kyc_status ?? "pending"), options: [["none", "Not submitted"], ["pending", "Pending review"], ["verified", "Verified"], ["rejected", "Rejected"]] }, { name: "note", label: "Note", type: "textarea" }]}
          onSubmit={async (v) => { const ok = await act("admin_set_kyc", { p_id: id, p_status: v.status, p_note: v.note }, "KYC updated"); if (ok) d.reload(); return ok; }} onClose={() => setForm(null)} />
      ) : null}
      {form === "flag" ? (
        <ActionForm title={p?.risk_flag ? "Clear suspicious flag" : "Flag as suspicious"} danger={!p?.risk_flag} intro={p?.risk_flag ? "This removes the flag." : "Flagged customers are excluded from agent commissions and shown in alerts."}
          fields={[{ name: "note", label: "Reason / note", type: "textarea", required: !p?.risk_flag, def: "" }]}
          onSubmit={async (v) => { const ok = await act("admin_flag_user", { p_id: id, p_flag: !p?.risk_flag, p_note: v.note }, "Flag updated"); if (ok) d.reload(); return ok; }} onClose={() => setForm(null)} />
      ) : null}
      {form === "bonus" ? (
        <ActionForm title="Grant a bonus" intro={`The bonus is credited to the customer's ${cur} wallet and recorded in the ledger.`}
          fields={[{ name: "promo", label: "Promotion", type: "select", options: ((promos.data ?? []).filter((x) => x.active) as Row[]).map((x) => [String(x.id), String(x.name)] as [string, string]), def: String(promos.data?.[0]?.id ?? "") }, { name: "amount", label: `Amount (${cur})`, type: "number", step: "0.01", required: true }, { name: "note", label: "Note" }]}
          onSubmit={async (v) => { if (!v.promo) { toast("Create a promotion first", "err"); return false; } const ok = await act("admin_grant_bonus", { p_user: id, p_promotion: v.promo, p_amount: Number(v.amount), p_note: v.note }, "Bonus granted"); if (ok) d.reload(); return ok; }} onClose={() => setForm(null)} />
      ) : null}
    </div>
  );
}
