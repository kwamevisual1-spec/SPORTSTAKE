import { useState } from "react";
import { ActionForm, Badge, Btn, Card, Loading, Section, Table, act, dt, money, useRpc, type FormField, type Row } from "../kit";

const KINDS: [string, string][] = [["welcome", "Welcome bonus"], ["campaign", "Promotional campaign"], ["free_bet", "Free bet"], ["referral", "Referral promotion"]];
const local = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const fields = (p?: Row): FormField[] => [
  { name: "name", label: "Name", required: true, def: String(p?.name ?? "") },
  { name: "kind", label: "Type", type: "select", options: KINDS, def: String(p?.kind ?? "welcome") },
  { name: "description", label: "Description / rules shown to customers", type: "textarea", def: String(p?.description ?? "") },
  { name: "max_g", label: "Maximum bonus per customer – GH₵", type: "number", step: "0.01", def: String(p?.max_amount?.GHS ?? 0) },
  { name: "max_n", label: "Maximum bonus per customer – ₦", type: "number", step: "0.01", def: String(p?.max_amount?.NGN ?? 0) },
  { name: "min_g", label: "Minimum qualifying deposit – GH₵", type: "number", step: "0.01", def: String(p?.min_deposit?.GHS ?? 0) },
  { name: "min_n", label: "Minimum qualifying deposit – ₦", type: "number", step: "0.01", def: String(p?.min_deposit?.NGN ?? 0) },
  { name: "wager", label: "Wagering requirement (× bonus)", type: "number", step: "0.5", def: String(p?.wagering_multiple ?? 1) },
  { name: "bud_g", label: "Total budget – GH₵ (0 = unlimited)", type: "number", step: "0.01", def: String(p?.budget?.GHS ?? 0), hint: "Grants stop when the budget is used up" },
  { name: "bud_n", label: "Total budget – ₦ (0 = unlimited)", type: "number", step: "0.01", def: String(p?.budget?.NGN ?? 0) },
  { name: "starts", label: "Starts", type: "datetime-local", def: local(p?.starts_at as string | null) },
  { name: "ends", label: "Ends", type: "datetime-local", def: local(p?.ends_at as string | null) },
  { name: "elig", label: "Eligibility rules (plain text, e.g. new customers only, one per person)", type: "textarea", def: String(p?.eligibility?.rules ?? "One bonus per customer. New customers only.") },
  { name: "active", label: "Active", type: "checkbox", def: p ? Boolean(p.active) : true },
];

export function PromotionsPage() {
  const { data, error, loading, reload } = useRpc<Row[]>("admin_list_promotions", {});
  const [form, setForm] = useState<null | { row?: Row }>(null);
  return (
    <div>
      <Section title="Bonuses & promotions" sub="Create welcome bonuses, campaigns, free bets and referral promotions, set the rules and watch usage. Grant bonuses from a customer's profile page." actions={<Btn onClick={() => setForm({})}>＋ New promotion</Btn>} />
      <Card pad={false}>
        <Loading error={error} loading={loading && !data}>
          <Table rows={data ?? []} empty="No promotions yet."
            cols={[
              { head: "Promotion", render: (r) => <div><p className="font-black text-brand-ink">{r.name}</p><p className="max-w-[260px] truncate text-[11px] text-brand-ink/45">{r.description}</p></div> },
              { head: "Type", render: (r) => <Badge tone="blue">{String(r.kind).replace("_", " ")}</Badge> },
              { head: "Max per customer", render: (r) => <div><p>{money(r.max_amount?.GHS, "GHS")}</p><p>{money(r.max_amount?.NGN, "NGN")}</p></div> },
              { head: "Budget", render: (r) => <div><p>{Number(r.budget?.GHS) ? money(r.budget.GHS, "GHS") : "no limit"}</p><p>{Number(r.budget?.NGN) ? money(r.budget.NGN, "NGN") : "no limit"}</p></div> },
              { head: "Used", render: (r) => <div><b>{r.grants} granted</b>{Object.entries((r.granted_total as Row) ?? {}).map(([c, n]) => <p key={c} className="text-[11px]">{money(n, c)}</p>)}</div> },
              { head: "Window", render: (r) => <span className="text-[11.5px]">{r.starts_at ? dt(r.starts_at) : "now"} → {r.ends_at ? dt(r.ends_at) : "open-ended"}</span> },
              { head: "Status", render: (r) => <Badge tone={r.active ? "green" : "gray"}>{r.active ? "active" : "paused"}</Badge> },
              { head: "", render: (r) => <Btn size="sm" variant="ghost" onClick={() => setForm({ row: r })}>Edit</Btn> },
            ]} />
        </Loading>
      </Card>
      {form ? <ActionForm wide title={form.row ? "Edit promotion" : "New promotion"} fields={fields(form.row)} onSubmit={async (v) => { const ok = await act("admin_upsert_promotion", { p_id: form.row?.id ?? null, p: { name: v.name, kind: v.kind, description: v.description, max_amount: { GHS: Number(v.max_g), NGN: Number(v.max_n) }, min_deposit: { GHS: Number(v.min_g), NGN: Number(v.min_n) }, wagering_multiple: Number(v.wager), budget: { GHS: Number(v.bud_g), NGN: Number(v.bud_n) }, starts_at: v.starts ? new Date(String(v.starts)).toISOString() : "", ends_at: v.ends ? new Date(String(v.ends)).toISOString() : "", eligibility: { rules: v.elig }, active: Boolean(v.active) } }, "Promotion saved"); if (ok) reload(); return ok; }} onClose={() => setForm(null)} /> : null}
    </div>
  );
}
