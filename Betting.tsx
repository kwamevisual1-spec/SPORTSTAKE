import { useEffect, useState } from "react";
import { ActionForm, Badge, Btn, Card, Input, Loading, Modal, Pager, Section, Select, Table, Tabs, act, dt, money, statusTone, useRpc, type Row } from "../kit";
import { can } from "../AdminApp";
import { LimitsEditor } from "./Settings";

const SPORTS: [string, string][] = [["football", "Football"], ["v-football", "Virtual football"], ["basketball", "Basketball"], ["v-basketball", "Virtual basketball"]];
const MARKET_OPTIONS: [string, string][] = [
  ["1x2", "1X2 – Full time"], ["dc", "Double chance"], ["dnb", "Draw no bet"], ["mw", "Match winner"], ["team_win", "Team to win"],
  ["oneup", "1X2 1UP"], ["twoup", "1X2 2UP"], ["neverdown", "1X2 Never down"], ["htft", "Half time / full time"],
  ["ou_lines", "Total goals O/U"], ["ttg", "Total goals"], ["ou1h", "1st half O/U"], ["ou2h", "2nd half O/U"],
  ["home_ou", "Home team goals"], ["away_ou", "Away team goals"], ["btts", "Both teams to score"], ["btts1h", "BTTS 1st half"],
  ["btts2h", "BTTS 2nd half"], ["home_score", "Home team to score"], ["away_score", "Away team to score"],
  ["oe", "Odd/even goals"], ["oe1h", "1st half odd/even"], ["home_oe", "Home odd/even"], ["away_oe", "Away odd/even"],
  ["cs", "Correct score"], ["cs1h", "1st half correct score"], ["cs2h", "2nd half correct score"],
  ["corners", "Total corners"], ["corners_home", "Home corners"], ["corners_away", "Away corners"],
  ["corners1h", "1st half corners"], ["corners2h", "2nd half corners"], ["bookings", "Bookings"],
  ["ht", "Half time result"], ["sh", "Second half result"], ["ht_dc", "HT double chance"], ["sh_dc", "SH double chance"],
  ["hcp1h", "1st half handicap"], ["hcp_table", "Handicap"], ["first_goal", "First team to score"], ["last_goal", "Last team to score"],
  ["win_nil", "Win to nil"], ["clean_sheet", "Clean sheet"], ["highest_half", "Highest scoring half"], ["win_margin", "Winning margin"],
  ["goals_range", "Total goals range"], ["score_both_halves", "Score in both halves"], ["hcp", "Handicap (basketball)"], ["ml", "Winner (basketball)"], ["tot", "Total points (basketball)"],
];

const toLocal = (iso?: string) => { const d = iso ? new Date(iso) : new Date(Date.now() + 3_600_000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const TEMPLATES: Record<string, [string, string, string, number | null][]> = {
  football: [["1x2", "1", "Home", null], ["1x2", "X", "Draw", null], ["1x2", "2", "Away", null], ["dc", "1X", "Home or draw", null], ["dc", "12", "Home or away", null], ["dc", "X2", "Draw or away", null], ["ou", "O", "Over 2.5", 2.5], ["ou", "U", "Under 2.5", 2.5], ["btts", "GG", "Both teams score", null], ["btts", "NG", "Not both score", null]],
  basketball: [["ml", "1", "Home", null], ["ml", "2", "Away", null], ["hcp", "H1", "Home handicap", -5.5], ["hcp", "H2", "Away handicap", -5.5], ["tot", "O", "Over", 160.5], ["tot", "U", "Under", 160.5]],
};

function OddsEditor({ ev, onClose }: { ev: Row; onClose: () => void }) {
  const { data, error, loading, reload } = useRpc<Row[]>("admin_list_odds", { p_event: ev.id });
  const [edit, setEdit] = useState<Record<string, { price: string; line: string }>>({});
  const [add, setAdd] = useState({ market: "1x2", selection: "", label: "", price: "", line: "" });
  const editable = ev.status === "scheduled" || ev.status === "live";
  const key = (r: Row) => `${r.market}|${r.selection}`;
  const save = async (r: Row) => {
    const e = edit[key(r)] ?? { price: String(r.price), line: r.line ?? "" };
    if (await act("admin_upsert_odds", { p_event: ev.id, p_market: r.market, p_selection: r.selection, p_label: r.label, p_price: Number(e.price), p_line: e.line === "" ? null : Number(e.line) }, "Odds saved")) { setEdit((x) => { const n = { ...x }; delete n[key(r)]; return n; }); reload(); }
  };
  const markets = [...new Set((data ?? []).map((r) => String(r.market)))];
  const template = TEMPLATES[String(ev.sport).includes("basketball") ? "basketball" : "football"];
  const addTemplate = async () => {
    for (const [m, s, l, line] of template) if (!(await act("admin_upsert_odds", { p_event: ev.id, p_market: m, p_selection: s, p_label: l, p_price: 2, p_line: line }))) return;
    await act("admin_set_market_suspended", { p_event: ev.id, p_market: null, p_suspended: true }, "Standard markets added – all SUSPENDED at 2.00. Set real odds, then resume each market.");
    reload();
  };
  return (
    <Modal wide title={`Markets & odds – ${ev.home} vs ${ev.away}`} onClose={onClose}>
      <Loading error={error} loading={loading && !data}>
        {!editable ? <p className="mb-3 rounded-xl bg-[#fff4c2] px-3 py-2 text-[12.5px] font-bold text-[#8a6100]">This event is {String(ev.status)} – odds can no longer be changed.</p> : null}
        {(data ?? []).length === 0 && editable ? (
          <div className="mb-4 rounded-xl border border-dashed border-black/20 p-4 text-center">
            <p className="mb-2 text-[13px] font-semibold text-brand-ink/60">No markets yet.</p>
            <Btn variant="dark" onClick={() => void addTemplate()}>Add standard markets (added suspended)</Btn>
          </div>
        ) : null}
        {markets.map((m) => {
          const rows = (data ?? []).filter((r) => r.market === m);
          const susp = rows.every((r) => r.suspended);
          return (
            <div key={m} className="mb-4 overflow-hidden rounded-xl border border-black/[0.08]">
              <div className="flex items-center justify-between bg-black/[0.04] px-3 py-2">
                <span className="text-[13px] font-black uppercase text-brand-ink">{m} {susp ? <Badge tone="red">suspended</Badge> : <Badge tone="green">open</Badge>}</span>
                {editable ? <Btn size="sm" variant={susp ? "primary" : "danger"} onClick={async () => { if (await act("admin_set_market_suspended", { p_event: ev.id, p_market: m, p_suspended: !susp }, susp ? "Market resumed" : "Market suspended")) reload(); }}>{susp ? "Resume market" : "Suspend market"}</Btn> : null}
              </div>
              <Table rows={rows} cols={[
                { head: "Selection", render: (r) => <b>{r.selection}</b> },
                { head: "Label", render: (r) => r.label },
                { head: "Price", render: (r) => <input disabled={!editable} className="w-20 rounded-lg border border-black/15 px-2 py-1 text-right font-bold" type="number" step="0.01" value={edit[key(r)]?.price ?? String(r.price)} onChange={(e) => setEdit({ ...edit, [key(r)]: { price: e.target.value, line: edit[key(r)]?.line ?? (r.line ?? "") } })} /> },
                { head: "Line", render: (r) => <input disabled={!editable} className="w-20 rounded-lg border border-black/15 px-2 py-1 text-right font-bold" type="number" step="0.5" value={edit[key(r)]?.line ?? (r.line ?? "")} onChange={(e) => setEdit({ ...edit, [key(r)]: { price: edit[key(r)]?.price ?? String(r.price), line: e.target.value } })} /> },
                { head: "State", render: (r) => (r.suspended ? <Badge tone="red">suspended</Badge> : <Badge tone="green">open</Badge>) },
                { head: "", render: (r) => editable ? (
                  <span className="flex items-center gap-1.5">
                    {edit[key(r)] ? <Btn size="sm" onClick={() => void save(r)}>Save</Btn> : null}
                    <Btn size="sm" variant="ghost" onClick={async () => { if (await act("admin_set_selection_suspended", { p_event: ev.id, p_market: r.market, p_selection: r.selection, p_suspended: !r.suspended }, r.suspended ? "Selection re-opened" : "Selection suspended")) reload(); }}>{r.suspended ? "Re-open" : "Suspend"}</Btn>
                  </span>) : (r.suspended ? <Badge tone="red">suspended</Badge> : null) },
              ]} />
            </div>
          );
        })}
        {editable ? (
          <div className="rounded-xl border border-black/[0.08] p-3">
            <p className="mb-2 text-[12.5px] font-black text-brand-ink">Add / replace a selection</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Select value={add.market} onChange={(v) => setAdd({ ...add, market: v })} options={MARKET_OPTIONS} />
              <Input placeholder="Code e.g. 1, X, O" value={add.selection} onChange={(e) => setAdd({ ...add, selection: e.target.value })} />
              <Input placeholder="Label" value={add.label} onChange={(e) => setAdd({ ...add, label: e.target.value })} />
              <Input placeholder="Price" type="number" step="0.01" value={add.price} onChange={(e) => setAdd({ ...add, price: e.target.value })} />
              <Input placeholder="Line" type="number" step="0.5" value={add.line} onChange={(e) => setAdd({ ...add, line: e.target.value })} />
            </div>
            <div className="mt-2 flex justify-end"><Btn disabled={!add.selection || !add.price} onClick={async () => { if (await act("admin_upsert_odds", { p_event: ev.id, p_market: add.market, p_selection: add.selection.trim(), p_label: add.label || add.selection, p_price: Number(add.price), p_line: add.line === "" ? null : Number(add.line) }, "Selection saved")) { setAdd({ ...add, selection: "", label: "", price: "" }); reload(); } }}>Save selection</Btn></div>
          </div>
        ) : null}
      </Loading>
    </Modal>
  );
}

function Events({ me }: { me: Row }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<null | { kind: "edit" | "settle" | "cancel" | "odds"; row?: Row }>(null);
  useEffect(() => { const t = window.setTimeout(() => { setSearch(q.trim()); setOffset(0); }, 350); return () => window.clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useRpc<Row>("admin_list_events", { p_status: status, p_search: search, p_limit: 25, p_offset: offset }, 30_000);
  const manage = can(me, "betting.manage");
  const settle = can(me, "betting.settle");
  const editable = (r: Row) => r.status === "scheduled" || r.status === "live";
  return (
    <Card pad={false} title="Events & markets" actions={<>{manage ? <Btn size="sm" onClick={() => setForm({ kind: "edit" })}>＋ New event</Btn> : null}</>}>
      <div className="grid gap-3 border-b border-black/[0.06] p-4 sm:grid-cols-[1fr_190px]">
        <Input placeholder="Search team or league…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[["", "All statuses"], ["scheduled", "Scheduled"], ["live", "Live"], ["finished", "Finished"], ["cancelled", "Cancelled"]]} />
      </div>
      <Loading error={error} loading={loading && !data}>
        <Table rows={(data?.rows as Row[]) ?? []} empty="No events yet. Click “New event” to add the first match."
          cols={[
            { head: "Kick-off", render: (r) => dt(r.kickoff) },
            { head: "Match", render: (r) => <div><p className="font-black text-brand-ink">{r.home} vs {r.away}</p><p className="text-[11px] text-brand-ink/45">{r.league} · {r.sport}</p></div> },
            { head: "Status", render: (r) => <span className="flex flex-wrap gap-1"><Badge tone={statusTone(r.status)}>{r.status}</Badge>{r.status === "finished" ? <b>{r.home_score}–{r.away_score}</b> : null}{Number(r.suspended) > 0 ? <Badge tone="red">{r.suspended} suspended</Badge> : null}</span> },
            { head: "Markets", align: "right", render: (r) => r.markets },
            { head: "Open bets", align: "right", render: (r) => r.open_bets },
            { head: "", render: (r) => (
              <span className="flex flex-wrap gap-1.5">
                <Btn size="sm" variant="ghost" onClick={() => setForm({ kind: "odds", row: r })}>Odds</Btn>
                {manage && editable(r) ? <Btn size="sm" variant="ghost" onClick={() => setForm({ kind: "edit", row: r })}>Edit</Btn> : null}
                {manage && editable(r) ? <Btn size="sm" variant="ghost" onClick={async () => { if (await act("admin_set_event_status", { p_id: r.id, p_status: r.status === "live" ? "scheduled" : "live" }, r.status === "live" ? "Set to scheduled" : "Set to live")) reload(); }}>{r.status === "live" ? "Set scheduled" : "Go live"}</Btn> : null}
                {manage && editable(r) ? <Btn size="sm" variant="ghost" onClick={async () => { if (await act("admin_set_market_suspended", { p_event: r.id, p_market: null, p_suspended: Number(r.suspended) < Number(r.markets) }, Number(r.suspended) < Number(r.markets) ? "All markets suspended" : "All markets resumed")) reload(); }}>{Number(r.suspended) < Number(r.markets) ? "Suspend all" : "Resume all"}</Btn> : null}
                {settle && editable(r) ? <Btn size="sm" variant="dark" onClick={() => setForm({ kind: "settle", row: r })}>Settle</Btn> : null}
                {settle && editable(r) ? <Btn size="sm" variant="danger" onClick={() => setForm({ kind: "cancel", row: r })}>Cancel</Btn> : null}
              </span>) },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={25} offset={offset} onChange={setOffset} />
      </Loading>
      {form?.kind === "edit" ? <ActionForm title={form.row ? "Edit event" : "New event"} fields={[{ name: "sport", label: "Sport", type: "select", options: SPORTS, def: String(form.row?.sport ?? "football") }, { name: "home", label: "Home team", required: true, def: String(form.row?.home ?? "") }, { name: "away", label: "Away team", required: true, def: String(form.row?.away ?? "") }, { name: "league", label: "League / competition", required: true, def: String(form.row?.league ?? "") }, { name: "kickoff", label: "Kick-off (your local time)", type: "datetime-local", required: true, def: toLocal(form.row?.kickoff as string | undefined) }]} onSubmit={async (v) => { const ok = await act("admin_upsert_event", { p_id: form.row?.id ?? null, p_sport: v.sport, p_home: v.home, p_away: v.away, p_league: v.league, p_kickoff: new Date(String(v.kickoff)).toISOString() }, "Event saved"); if (ok) reload(); return ok; }} onClose={() => setForm(null)} /> : null}
      {form?.kind === "settle" && form.row ? <ActionForm wide title={`Settle: ${form.row.home} vs ${form.row.away}`} intro="Enter the full-time score, and the half-time score and corner count so the detailed markets can settle. Markets that cannot be settled from the data you enter are voided (stake returned) rather than guessed." fields={[
            { name: "h", label: `${form.row.home} – full time`, type: "number", required: true, def: "0" },
            { name: "a", label: `${form.row.away} – full time`, type: "number", required: true, def: "0" },
            { name: "hth", label: `${form.row.home} – half time`, type: "number", def: "0" },
            { name: "hta", label: `${form.row.away} – half time`, type: "number", def: "0" },
            { name: "ch", label: `${form.row.home} – corners`, type: "number" },
            { name: "ca", label: `${form.row.away} – corners`, type: "number" },
            { name: "fg", label: "First team to score", type: "select", options: [["", "Not known (void first-goal bets)"], ["1", String(form.row.home)], ["2", String(form.row.away)], ["NONE", "No goals"]], def: "" },
            { name: "lg", label: "Last team to score", type: "select", options: [["", "Not known (void last-goal bets)"], ["1", String(form.row.home)], ["2", String(form.row.away)], ["NONE", "No goals"]], def: "" },
          ]} submitLabel="Settle event" danger onSubmit={async (v) => {
            const args = { p_event: form.row?.id, p_home: Number(v.h), p_away: Number(v.a), p_ht_home: v.hth === "" ? null : Number(v.hth), p_ht_away: v.hta === "" ? null : Number(v.hta), p_corners_home: v.ch === "" ? null : Number(v.ch), p_corners_away: v.ca === "" ? null : Number(v.ca), p_first_goal: v.fg || null, p_last_goal: v.lg || null };
            let r = await act("admin_settle_event_full", args, "Event settled");
            if (!r) r = await act("admin_settle_event", { p_event: form.row?.id, p_home: Number(v.h), p_away: Number(v.a) }, "Event settled (basic – run supabase/markets_admin.sql for detailed markets)");
            if (r) reload();
            return r;
          }} onClose={() => setForm(null)} /> : null}
      {form?.kind === "cancel" && form.row ? <ActionForm title="Cancel event" danger intro="All bets on this event are voided and stakes are refunded." fields={[{ name: "reason", label: "Reason", type: "textarea", required: true, minLength: 5 }]} submitLabel="Cancel & refund" onSubmit={async (v) => { const r = await act("admin_cancel_event", { p_event: form.row?.id, p_reason: v.reason }, "Event cancelled, bets voided"); if (r) reload(); return r; }} onClose={() => setForm(null)} /> : null}
      {form?.kind === "odds" && form.row ? <OddsEditor ev={form.row} onClose={() => { setForm(null); reload(); }} /> : null}
    </Card>
  );
}

function SettleQueue({ me }: { me: Row }) {
  const { data, error, loading, reload } = useRpc<Row>("admin_list_events", { p_status: "", p_search: "", p_limit: 100, p_offset: 0 }, 30_000);
  const [score, setScore] = useState<Record<string, { h: string; a: string }>>({});
  const due = ((data?.rows as Row[]) ?? []).filter((r) => (r.status === "scheduled" || r.status === "live") && new Date(String(r.kickoff)).getTime() < Date.now()).sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
  const may = can(me, "betting.settle");
  return (
    <Card pad={false} title={`Waiting for a result (${due.length})`}>
      <Loading error={error} loading={loading && !data}>
        <Table rows={due} empty="Nothing waiting. Events appear here once their kick-off time has passed."
          cols={[
            { head: "Kick-off", render: (r) => dt(r.kickoff) },
            { head: "Match", render: (r) => <b>{r.home} vs {r.away}</b> },
            { head: "Open bets", align: "right", render: (r) => r.open_bets },
            { head: "Final score", render: (r) => may ? <span className="flex items-center gap-1"><input className="w-14 rounded-lg border border-black/15 px-2 py-1 text-center font-bold" type="number" min="0" value={score[r.id]?.h ?? ""} onChange={(e) => setScore({ ...score, [r.id]: { h: e.target.value, a: score[r.id]?.a ?? "" } })} />–<input className="w-14 rounded-lg border border-black/15 px-2 py-1 text-center font-bold" type="number" min="0" value={score[r.id]?.a ?? ""} onChange={(e) => setScore({ ...score, [r.id]: { a: e.target.value, h: score[r.id]?.h ?? "" } })} /></span> : "—" },
            { head: "", render: (r) => may ? <Btn size="sm" variant="dark" disabled={score[r.id]?.h === undefined || score[r.id]?.h === "" || score[r.id]?.a === undefined || score[r.id]?.a === ""} onClick={async () => { const s = score[r.id]; if (!window.confirm(`Settle ${r.home} ${s.h}–${s.a} ${r.away}? Winners are paid immediately.`)) return; if (await act("admin_settle_event", { p_event: r.id, p_home: Number(s.h), p_away: Number(s.a) }, "Event settled")) reload(); }}>Settle</Btn> : null },
          ]} />
      </Loading>
    </Card>
  );
}

function Bets({ me }: { me: Row }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [corr, setCorr] = useState<Row | null>(null);
  useEffect(() => { const t = window.setTimeout(() => { setSearch(q.trim()); setOffset(0); }, 350); return () => window.clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useRpc<Row>("admin_list_bets", { p_status: status, p_search: search, p_user: null, p_limit: 25, p_offset: offset }, 30_000);
  return (
    <Card pad={false} title="Bet history">
      <div className="grid gap-3 border-b border-black/[0.06] p-4 sm:grid-cols-[1fr_190px]">
        <Input placeholder="Search bet ID or customer email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={[["", "All statuses"], ["open", "Open"], ["won", "Won"], ["lost", "Lost"], ["void", "Void"], ["cashed_out", "Cashed out"]]} />
      </div>
      <Loading error={error} loading={loading && !data}>
        <Table rows={(data?.rows as Row[]) ?? []} empty="No bets yet."
          cols={[
            { head: "Placed", render: (r) => dt(r.placed_at) },
            { head: "Customer", render: (r) => r.email },
            { head: "Selections", render: (r) => <div className="max-w-[300px] space-y-0.5">{(r.legs as Row[]).map((l, i) => <p key={i} className="truncate text-[11.5px]">{l.event} · {l.market}:{l.selection} @{l.odds} {l.result ? <Badge tone={statusTone(l.result)}>{l.result}</Badge> : null}</p>)}</div> },
            { head: "Stake", align: "right", render: (r) => money(r.stake, r.currency) },
            { head: "Odds", align: "right", render: (r) => r.total_odds },
            { head: "Status", render: (r) => <span className="flex gap-1"><Badge tone={statusTone(r.status)}>{r.status}</Badge>{Number(r.corrections) > 0 ? <Badge tone="purple">corrected ×{r.corrections}</Badge> : null}</span> },
            { head: "Payout", align: "right", render: (r) => (r.payout !== null ? money(r.payout, r.currency) : "—") },
            { head: "", render: (r) => can(me, "bets.correct") && r.status !== "open" ? <Btn size="sm" variant="ghost" onClick={() => setCorr(r)}>Correct</Btn> : null },
          ]} />
        <Pager total={Number(data?.total ?? 0)} limit={25} offset={offset} onChange={setOffset} />
      </Loading>
      {corr ? <ActionForm title="Authorised bet correction" danger intro={<>Settled bets are locked. A correction changes the result, pays or takes back the <b>difference</b> in the customer's wallet, and is permanently recorded with your name and reason. Current: <b>{String(corr.status)}</b>, payout {money(corr.payout, corr.currency)}.</>}
        fields={[{ name: "status", label: "Correct result", type: "select", def: "won", options: [["won", "Won"], ["lost", "Lost"], ["void", "Void (refund stake)"], ["cashed_out", "Cashed out"]] }, { name: "payout", label: "Payout amount (for won / cashed out)", type: "number", step: "0.01", def: String(corr.potential_win ?? "0") }, { name: "reason", label: "Reason (min. 10 characters)", type: "textarea", required: true, minLength: 10 }]}
        submitLabel="Apply correction" onSubmit={async (v) => { const ok = await act("admin_correct_bet", { p_bet: corr.id, p_status: v.status, p_payout: Number(v.payout || 0), p_reason: v.reason }, "Correction applied and logged"); if (ok) reload(); return ok; }} onClose={() => setCorr(null)} /> : null}
    </Card>
  );
}

export function BettingPage({ me }: { me: Row }) {
  const [tab, setTab] = useState("events");
  return (
    <div>
      <Section title="Betting management" sub="Events, markets, odds, suspensions, settlement and limits. Odds are entered manually until an authorised odds provider is connected." />
      <div className="mb-4"><Tabs tabs={[["events", "Events & markets"], ["settle", "Settlement queue"], ["bets", "Bet history"], ["limits", "Stake & payout limits"]]} value={tab} onChange={setTab} /></div>
      {tab === "events" ? <Events me={me} /> : tab === "settle" ? <SettleQueue me={me} /> : tab === "bets" ? <Bets me={me} /> : <LimitsEditor me={me} />}
    </div>
  );
}
