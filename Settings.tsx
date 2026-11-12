import { useState } from "react";
import { Btn, Card, Input, Loading, Section, Field, act, useRpc, type Row } from "../kit";
import { can } from "../AdminApp";

const num = (v: unknown) => (v === undefined || v === null ? "" : String(v));

function useSettings() {
  return useRpc<Row>("admin_get_settings", {});
}

function Save({ onClick, busy, disabled }: { onClick: () => void; busy: boolean; disabled: boolean }) {
  return <div className="mt-4 flex justify-end"><Btn onClick={onClick} busy={busy} disabled={disabled}>Save changes</Btn></div>;
}

export function LimitsEditor({ me }: { me: Row }) {
  const { data, error, loading, reload } = useSettings();
  const [v, setV] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const s = data ?? {};
  const cur = v ?? {
    gmin: num(s.stake_limits?.GHS?.min), gmax: num(s.stake_limits?.GHS?.max), gwin: num(s.max_payout?.GHS),
    nmin: num(s.stake_limits?.NGN?.min), nmax: num(s.stake_limits?.NGN?.max), nwin: num(s.max_payout?.NGN),
  };
  const set = (k: string, x: string) => setV({ ...cur, [k]: x });
  const may = can(me, "settings.edit");
  const save = async () => {
    setBusy(true);
    const a = await act("admin_set_setting", { p_key: "stake_limits", p_value: { GHS: { min: Number(cur.gmin), max: Number(cur.gmax) }, NGN: { min: Number(cur.nmin), max: Number(cur.nmax) } } }, "Stake limits saved");
    const b = a && (await act("admin_set_setting", { p_key: "max_payout", p_value: { GHS: Number(cur.gwin), NGN: Number(cur.nwin) } }, "Maximum payouts saved"));
    setBusy(false);
    if (b) { setV(null); reload(); }
  };
  return (
    <Card title="Stake & payout limits" actions={<span className="text-[11.5px] font-semibold text-brand-ink/45">Enforced by the database on every bet</span>}>
      <Loading error={error} loading={loading && !data}>
        <div className="grid gap-5 md:grid-cols-2">
          {[["GHS", "GH₵ Ghana cedis", "g"], ["NGN", "₦ Nigerian naira", "n"]].map(([c, label, k]) => (
            <div key={c} className="rounded-xl border border-black/[0.07] p-4">
              <p className="mb-3 text-[13px] font-black text-brand-ink">{label}</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Min stake" type="number" step="0.01" value={cur[`${k}min`]} disabled={!may} onChange={(e) => set(`${k}min`, e.target.value)} />
                <Input label="Max stake" type="number" step="0.01" value={cur[`${k}max`]} disabled={!may} onChange={(e) => set(`${k}max`, e.target.value)} />
                <Input label="Max payout" type="number" step="0.01" value={cur[`${k}win`]} disabled={!may} onChange={(e) => set(`${k}win`, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
        {may ? <Save onClick={() => void save()} busy={busy} disabled={v === null} /> : <p className="mt-3 text-[12px] font-semibold text-brand-ink/45">You can view these limits but not change them.</p>}
      </Loading>
    </Card>
  );
}

function Qualification({ me }: { me: Row }) {
  const { data, error, loading, reload } = useSettings();
  const [v, setV] = useState<Record<string, string | boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const q = data?.qualification ?? {};
  const cur = v ?? { gdep: num(q.min_deposit?.GHS), ndep: num(q.min_deposit?.NGN), gstk: num(q.min_settled_stake?.GHS), nstk: num(q.min_settled_stake?.NGN), kyc: Boolean(q.require_kyc), days: num(q.window_days) };
  const set = (k: string, x: string | boolean) => setV({ ...cur, [k]: x });
  const may = can(me, "settings.edit");
  return (
    <Card title="Agent commission qualification rules">
      <Loading error={error} loading={loading && !data}>
        <p className="mb-4 text-[12.5px] font-semibold leading-relaxed text-brand-ink/55">A referred customer only counts as <b>qualified</b> (and only then earns the agent a commission) after they make a real deposit and place real settled bets within the window, with no chargebacks, no flags and an active account.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Minimum deposit – GH₵" type="number" value={String(cur.gdep)} disabled={!may} onChange={(e) => set("gdep", e.target.value)} />
          <Input label="Minimum deposit – ₦" type="number" value={String(cur.ndep)} disabled={!may} onChange={(e) => set("ndep", e.target.value)} />
          <Input label="Qualifying window (days)" type="number" value={String(cur.days)} disabled={!may} onChange={(e) => set("days", e.target.value)} />
          <Input label="Minimum settled stake – GH₵" type="number" value={String(cur.gstk)} disabled={!may} onChange={(e) => set("gstk", e.target.value)} />
          <Input label="Minimum settled stake – ₦" type="number" value={String(cur.nstk)} disabled={!may} onChange={(e) => set("nstk", e.target.value)} />
          <label className="flex items-center gap-2 self-end pb-3 text-[13px] font-bold text-brand-ink/70"><input type="checkbox" className="h-4 w-4 accent-[#17a34a]" checked={Boolean(cur.kyc)} disabled={!may} onChange={(e) => set("kyc", e.target.checked)} />Require verified KYC</label>
        </div>
        {may ? <Save disabled={v === null} busy={busy} onClick={async () => { setBusy(true); const ok = await act("admin_set_setting", { p_key: "qualification", p_value: { min_deposit: { GHS: Number(cur.gdep), NGN: Number(cur.ndep) }, min_settled_stake: { GHS: Number(cur.gstk), NGN: Number(cur.nstk) }, require_kyc: Boolean(cur.kyc), window_days: Number(cur.days) } }, "Qualification rules saved"); setBusy(false); if (ok) { setV(null); reload(); } }} /> : null}
      </Loading>
    </Card>
  );
}

function TwoValue({ me, title, hint, keyName }: { me: Row; title: string; hint: string; keyName: string }) {
  const { data, error, loading, reload } = useSettings();
  const [v, setV] = useState<{ g: string; n: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const s = data?.[keyName] ?? {};
  const cur = v ?? { g: num(s.GHS), n: num(s.NGN) };
  const may = can(me, "settings.edit");
  return (
    <Card title={title}>
      <Loading error={error} loading={loading && !data}>
        <p className="mb-3 text-[12.5px] font-semibold text-brand-ink/55">{hint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="GH₵ Ghana" type="number" value={cur.g} disabled={!may} onChange={(e) => setV({ ...cur, g: e.target.value })} />
          <Input label="₦ Nigeria" type="number" value={cur.n} disabled={!may} onChange={(e) => setV({ ...cur, n: e.target.value })} />
        </div>
        {may ? <Save disabled={v === null} busy={busy} onClick={async () => { setBusy(true); const ok = await act("admin_set_setting", { p_key: keyName, p_value: { GHS: Number(cur.g), NGN: Number(cur.n) } }, "Saved"); setBusy(false); if (ok) { setV(null); reload(); } }} /> : null}
      </Loading>
    </Card>
  );
}

export function SettingsPage({ me }: { me: Row }) {
  return (
    <div className="space-y-5">
      <Section title="Settings" sub="Platform rules. Every change is written to the audit log with the old and new values." />
      <LimitsEditor me={me} />
      <Qualification me={me} />
      <div className="grid gap-5 lg:grid-cols-2">
        <TwoValue me={me} keyName="withdrawal_dual_approval" title="Two-person approval for large withdrawals" hint="Customer withdrawals at or above this amount need approval from TWO different administrators. Set 0 to turn it off." />
        <TwoValue me={me} keyName="agent_min_withdrawal" title="Agent minimum withdrawal" hint="Agents cannot request a commission payout below this amount." />
      </div>
      <Card title="Your account"><Field label="Signed in as"><p className="text-[13.5px] font-black text-brand-ink">{me.email} · <span className="capitalize">{String(me.role).replace("_", " ")}</span></p></Field></Card>
    </div>
  );
}
