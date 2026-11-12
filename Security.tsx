import { useEffect, useState } from "react";
import { Badge, Btn, Card, Input, Loading, Pager, Section, Table, Tabs, downloadCsv, dt, useRpc, type Row } from "../kit";

function Audit() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => { const t = window.setTimeout(() => { setActor(a.trim()); setAction(b.trim()); setOffset(0); }, 350); return () => window.clearTimeout(t); }, [a, b]);
  const { data, error, loading } = useRpc<Row>("admin_list_audit", { p_actor: actor, p_action: action, p_limit: 50, p_offset: offset }, 30_000);
  const rows = (data?.rows as Row[]) ?? [];
  return (
    <Card pad={false} title="Administrative action history (append-only – nobody can edit or delete it)" actions={<Btn size="sm" variant="ghost" onClick={() => downloadCsv("audit-log", rows.map((r) => ({ at: r.at, actor: r.actor_email, type: r.actor_type, action: r.action, entity: `${r.entity_type ?? ""}:${r.entity_id ?? ""}`, ip: r.ip, details: r.details })))}>⬇ CSV (this page)</Btn>}>
      <div className="grid gap-3 border-b border-black/[0.06] p-4 sm:grid-cols-2">
        <Input placeholder="Filter by who (email)…" value={a} onChange={(e) => setA(e.target.value)} />
        <Input placeholder="Filter by action, e.g. withdrawal, bet.correct, agent…" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      <Loading error={error} loading={loading && !data}>
        <Table rows={rows} empty="No matching activity."
          cols={[
            { head: "When", render: (r) => dt(r.at) },
            { head: "Who", render: (r) => <div><p className="font-black text-brand-ink">{r.actor_email || "system"}</p><Badge>{r.actor_type}</Badge></div> },
            { head: "Action", render: (r) => <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[11.5px] font-bold">{r.action}</code> },
            { head: "Target", render: (r) => <span className="text-[11.5px]">{r.entity_type} {String(r.entity_id ?? "").slice(0, 12)}</span> },
            { head: "Details", render: (r) => <code className="block max-w-[340px] truncate text-[11px] text-brand-ink/55" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</code> },
            { head: "IP", render: (r) => r.ip || "—" },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={50} offset={offset} onChange={setOffset} />
      </Loading>
    </Card>
  );
}

function Logins() {
  const { data, error, loading } = useRpc<Row[]>("admin_list_logins", { p_limit: 200 }, 30_000);
  return (
    <Card pad={false} title="Staff login history (admins & agents)">
      <Loading error={error} loading={loading && !data}>
        <Table rows={data ?? []} empty="No logins recorded yet."
          cols={[
            { head: "When", render: (r) => dt(r.at) },
            { head: "Account", render: (r) => r.email || "—" },
            { head: "Portal", render: (r) => r.portal },
            { head: "Result", render: (r) => (r.success ? <Badge tone="green">success</Badge> : <Badge tone="red">failed</Badge>) },
            { head: "IP address", render: (r) => r.ip || "—" },
            { head: "Device / browser", render: (r) => <span className="block max-w-[320px] truncate text-[11px]" title={r.user_agent}>{r.user_agent || "—"}</span> },
          ]} />
      </Loading>
    </Card>
  );
}

function Abuse() {
  const { data, error, loading } = useRpc<Row>("admin_abuse_signals", {}, 60_000);
  return (
    <Loading error={error} loading={loading && !data}>
      <div className="space-y-4">
        <Card title="Suspicious referral bursts (10+ registrations in one hour)" pad={false}>
          <Table rows={(data?.referral_bursts as Row[]) ?? []} empty="None detected." cols={[{ head: "Agent", render: (r) => <b>@{r.username}</b> }, { head: "Code", render: (r) => r.referral_code }, { head: "Hour", render: (r) => dt(r.hour) }, { head: "Registrations", align: "right", render: (r) => r.registrations }]} />
        </Card>
        <Card title="Self-referral attempts (auto-disqualified)" pad={false}>
          <Table rows={(data?.self_referrals as Row[]) ?? []} empty="None detected." cols={[{ head: "Agent", render: (r) => <b>@{r.username}</b> }, { head: "Customer ID", render: (r) => <code>{String(r.user_id).slice(0, 13)}</code> }, { head: "Registered", render: (r) => dt(r.registered_at) }]} />
        </Card>
        <Card title="Bonus abuse – withdrew within 7 days of a bonus with almost no betting" pad={false}>
          <Table rows={(data?.bonus_then_withdraw as Row[]) ?? []} empty="None detected." cols={[{ head: "Customer ID", render: (r) => <code>{String(r.user_id).slice(0, 13)}</code> }, { head: "Bonus", align: "right", render: (r) => `${r.currency} ${r.bonus}` }, { head: "Withdrawn", align: "right", render: (r) => r.withdrawn }, { head: "When", render: (r) => dt(r.created_at) }]} />
        </Card>
      </div>
    </Loading>
  );
}

export function SecurityPage() {
  const [tab, setTab] = useState("audit");
  return (
    <div>
      <Section title="Security & audit" sub="Who did what, from where, and what looks suspicious." />
      <div className="mb-4"><Tabs tabs={[["audit", "Audit log"], ["logins", "Login history"], ["abuse", "Suspicious activity"]]} value={tab} onChange={setTab} /></div>
      {tab === "audit" ? <Audit /> : tab === "logins" ? <Logins /> : <Abuse />}
    </div>
  );
}
