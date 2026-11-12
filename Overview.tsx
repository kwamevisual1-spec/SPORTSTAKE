import { useMemo, useState } from "react";
import { BarChart, Donut, LineChart } from "../charts";
import { Btn, Card, Loading, Section, Select, Stat, Table, Tabs, dday, downloadCsv, dt, fmt, money, useRpc, type Row } from "../kit";

const RANGES: [string, string][] = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"]];

export function OverviewPage({ me }: { me: Row }) {
  const [cur, setCur] = useState("GHS");
  const [range, setRange] = useState("30");
  const [gran, setGran] = useState("auto");
  const g = gran === "auto" ? (range === "365" ? "month" : range === "90" ? "week" : "day") : gran;
  const { from, to } = useMemo(() => {
    const t = new Date();
    t.setHours(24, 0, 0, 0);
    return { to: t.toISOString(), from: new Date(t.getTime() - Number(range) * 86_400_000).toISOString() };
  }, [range]);
  const { data, error, loading, reload } = useRpc<Row>("admin_overview", { p_currency: cur, p_from: from, p_to: to, p_gran: g }, 30_000);
  const [stamp, setStamp] = useState(Date.now());
  const m = (c: string) => (v: unknown) => money(v, c);
  const fmtX = (v: unknown) => (g === "month" ? new Date(String(v)).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : dday(String(v)));

  const p = data?.period ?? {};
  const a = data?.all_time ?? {};
  const c = data?.counts ?? {};
  const series = (data?.series as Row[]) ?? [];

  return (
    <div>
      <Section
        title="Overview"
        sub={`Live platform performance in ${cur === "NGN" ? "Nigerian Naira" : "Ghana Cedis"}. Auto-refreshes every 30 seconds.`}
        actions={
          <>
            <Tabs tabs={[["GHS", "GH₵ Ghana"], ["NGN", "₦ Nigeria"]]} value={cur} onChange={setCur} />
            <Select value={range} onChange={setRange} options={RANGES} className="!py-2" />
            <Btn variant="ghost" onClick={() => { void reload(); setStamp(Date.now()); }}>↻ Refresh</Btn>
          </>
        }
      />
      <Loading error={error} loading={loading && !data}>
        {data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Registered users" value={fmt(c.users, 0)} sub={`+${fmt(p.new_users, 0)} in period`} />
              <Stat label="Active users (30d)" value={fmt(c.active_users, 0)} sub="placed a bet in 30 days" />
              <Stat label="Player balances" value={money(c.player_balances, cur)} sub="owed to customers" />
              <Stat label="Pending withdrawals" value={fmt(c.pending_withdrawals, 0)} sub={money(c.pending_withdrawals_amount, cur)} tone={Number(c.pending_withdrawals) > 0 ? "warn" : "default"} />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Total deposits" value={money(p.deposits, cur)} sub={`All time ${money(a.deposits, cur)}`} />
              <Stat label="Total withdrawals paid" value={money(p.withdrawals_paid, cur)} sub={`All time ${money(a.withdrawals_paid, cur)}`} />
              <Stat label="Betting volume" value={money(p.stakes, cur)} sub={`${fmt(p.bets_placed, 0)} bets · all time ${money(a.stakes, cur)}`} />
              <Stat label="Open bets" value={fmt(c.open_bets, 0)} sub="awaiting settlement" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Settled bets" value={fmt(p.settled_bets, 0)} sub={`${fmt(p.winning_bets, 0)} won · ${fmt(p.losing_bets, 0)} lost · ${fmt(p.cashed_out_bets, 0)} cashed out`} />
              <Stat label="Platform revenue (GGR)" value={money(p.ggr, cur)} tone={Number(p.ggr) >= 0 ? "good" : "bad"} sub={`All time ${money(a.ggr, cur)}`} hint="Gross gaming revenue = settled stakes − winnings paid (+ casino results)" />
              <Stat label="Net gaming revenue (NGR)" value={money(p.ngr, cur)} tone={Number(p.ngr) >= 0 ? "good" : "bad"} sub={`After ${money(p.bonuses, cur)} bonuses`} hint="NGR = GGR − bonuses credited" />
              <Stat label="Flagged accounts" value={fmt(c.flagged_users, 0)} sub="restricted, suspended or flagged" tone={Number(c.flagged_users) > 0 ? "warn" : "default"} />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Agents" value={`${fmt(c.agents_active, 0)} / ${fmt(c.agents, 0)}`} sub="active / total" />
              <Stat label="Commissions approved" value={money(c.commissions_approved, cur)} sub="earned by agents" />
              <Stat label="Commissions pending" value={money(c.commissions_pending, cur)} sub="awaiting review" tone={Number(c.commissions_pending) > 0 ? "warn" : "default"} />
              <Stat label="Commissions paid out" value={money(c.commissions_paid_out, cur)} sub="withdrawn by agents" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Revenue (GGR) & net revenue (NGR)">
                <LineChart data={series} x="bucket" series={[{ key: "ggr", label: "GGR", color: "#17a34a" }, { key: "ngr", label: "NGR", color: "#2563eb" }]} fmtX={fmtX} fmtV={m(cur)} />
              </Card>
              <Card title="Deposits vs withdrawals">
                <BarChart data={series} x="bucket" series={[{ key: "deposits", label: "Deposits", color: "#17a34a" }, { key: "withdrawals_paid", label: "Withdrawals paid", color: "#f59e0b" }]} fmtX={fmtX} fmtV={m(cur)} />
              </Card>
              <Card title="Betting volume vs winnings paid">
                <BarChart data={series} x="bucket" series={[{ key: "settled_stake", label: "Settled stakes", color: "#7c3aed" }, { key: "settled_payout", label: "Winnings paid", color: "#e8342e" }]} fmtX={fmtX} fmtV={m(cur)} />
              </Card>
              <Card title="New registrations">
                <BarChart data={series} x="bucket" series={[{ key: "new_users", label: "New users", color: "#0ea5e9" }]} fmtX={fmtX} fmtV={(n) => fmt(n, 0)} />
              </Card>
              <Card title="Settled bet outcomes (period)" className="lg:col-span-2">
                <Donut center="settled bets" parts={[{ label: "Won", value: Number(p.winning_bets ?? 0), color: "#17a34a" }, { label: "Lost", value: Number(p.losing_bets ?? 0), color: "#e8342e" }, { label: "Cashed out", value: Number(p.cashed_out_bets ?? 0), color: "#7c3aed" }]} />
              </Card>
            </div>

            <Card
              title={`Performance report – by ${g}`}
              pad={false}
              actions={
                <>
                  <Select value={gran} onChange={setGran} options={[["auto", "Auto"], ["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]]} className="!py-1.5 !text-[12px]" />
                  <Btn size="sm" variant="ghost" onClick={() => downloadCsv(`performance-${cur}-${g}`, [...series].map((r) => ({ period: String(r.bucket).slice(0, 10), new_users: r.new_users, deposits: r.deposits, withdrawals_paid: r.withdrawals_paid, stakes: r.stakes, bets_placed: r.bets_placed, settled_bets: r.settled_bets, winnings_paid: r.settled_payout, ggr: r.ggr, bonuses: r.bonuses, ngr: r.ngr })))}>⬇ CSV</Btn>
                </>
              }
            >
              <Table
                rows={[...series].reverse()}
                cols={[
                  { head: "Period", render: (r) => dt(String(r.bucket)).split(",")[0] },
                  { head: "New users", align: "right", render: (r) => fmt(r.new_users, 0) },
                  { head: "Deposits", align: "right", render: (r) => money(r.deposits, cur) },
                  { head: "Withdrawals", align: "right", render: (r) => money(r.withdrawals_paid, cur) },
                  { head: "Volume", align: "right", render: (r) => money(r.stakes, cur) },
                  { head: "Settled", align: "right", render: (r) => fmt(r.settled_bets, 0) },
                  { head: "GGR", align: "right", render: (r) => <span className={Number(r.ggr) < 0 ? "text-brand-red" : "text-brand-green-deep"}>{money(r.ggr, cur)}</span> },
                  { head: "NGR", align: "right", render: (r) => <span className={Number(r.ngr) < 0 ? "text-brand-red" : "text-brand-green-deep"}>{money(r.ngr, cur)}</span> },
                ]}
              />
            </Card>
            <p className="text-center text-[11.5px] font-semibold text-brand-ink/40">
              Last updated {new Date(stamp).toLocaleTimeString()} · Signed in as {me.email}. Figures only include real database records; casino games that run in the browser are not included until they are connected to the wallet.
            </p>
          </div>
        ) : null}
      </Loading>
    </div>
  );
}
