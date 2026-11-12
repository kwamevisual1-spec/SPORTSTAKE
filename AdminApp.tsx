import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Logo } from "../components/Header";
import { StaffGate } from "./Gate";
import { ToastHost, navTo, useHash, useRpc, type Row } from "./kit";
import { portalLink } from "./client";
import { OverviewPage } from "./admin/Overview";
import { UserDetailPage, UsersPage } from "./admin/Users";
import { FinancePage } from "./admin/Finance";
import { BettingPage } from "./admin/Betting";
import { AgentDetailPage, AgentsPage } from "./admin/Agents";
import { CommissionsPage } from "./admin/Commissions";
import { AdminsPage } from "./admin/Admins";
import { PromotionsPage } from "./admin/Promotions";
import { SecurityPage } from "./admin/Security";
import { SettingsPage } from "./admin/Settings";

const NAV: { path: string; label: string; icon: string; perms: string[]; superOnly?: boolean }[] = [
  { path: "", label: "Overview", icon: "📊", perms: ["dashboard.view"] },
  { path: "users", label: "Customers", icon: "👥", perms: ["users.view"] },
  { path: "finance", label: "Finance", icon: "💳", perms: ["finance.view", "withdrawals.approve"] },
  { path: "betting", label: "Betting", icon: "⚽", perms: ["betting.view"] },
  { path: "agents", label: "Agents", icon: "🤝", perms: ["agents.view"] },
  { path: "commissions", label: "Commissions", icon: "💰", perms: ["commissions.view", "agent_payouts.process"] },
  { path: "promotions", label: "Promotions", icon: "🎁", perms: ["promotions.manage"] },
  { path: "security", label: "Security & audit", icon: "🔒", perms: ["audit.view"] },
  { path: "admins", label: "Administrators", icon: "🛡", perms: [], superOnly: true },
  { path: "settings", label: "Settings", icon: "⚙️", perms: ["dashboard.view"] },
];

export const can = (me: Row, p: string) => me.role === "super_admin" || (me.permissions as string[]).includes(p);
const allowed = (me: Row, n: (typeof NAV)[number]) => (n.superOnly ? me.role === "super_admin" : n.perms.some((p) => can(me, p)));

function Bell({ me }: { me: Row }) {
  const { data } = useRpc<Row[]>("admin_alerts", {}, 60_000);
  const [open, setOpen] = useState(false);
  const items = data ?? [];
  const total = items.reduce((a, i) => a + Number(i.count), 0);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Alerts" className="relative grid h-10 w-10 place-items-center rounded-xl bg-black/[0.05] text-[17px] hover:bg-black/10">
        🔔
        {total > 0 ? <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e8342e] px-1 text-[10px] font-black text-white">{total > 99 ? "99+" : total}</span> : null}
      </button>
      {open ? (
        <>
          <button className="fixed inset-0 z-30" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute right-0 top-12 z-40 w-[320px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <p className="border-b border-black/[0.06] px-4 py-3 text-[13px] font-black text-brand-ink">Alerts</p>
            {items.length === 0 ? <p className="px-4 py-8 text-center text-[12.5px] font-semibold text-brand-ink/45">All clear. Nothing needs your attention.</p> : null}
            {items.map((i) => (
              <button key={String(i.key)} onClick={() => { setOpen(false); navTo(`/admin/${i.section}`); }} className="flex w-full items-center gap-3 border-b border-black/[0.05] px-4 py-3 text-left last:border-0 hover:bg-black/[0.03]">
                <span className={cn("grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-[12px] font-black text-white", i.severity === "danger" ? "bg-[#e8342e]" : i.severity === "warn" ? "bg-[#f59e0b]" : "bg-[#3b82f6]")}>{i.count}</span>
                <span className="text-[12.5px] font-bold text-brand-ink/75">{i.label}</span>
              </button>
            ))}
            <p className="px-4 py-2 text-[10.5px] font-semibold text-brand-ink/35">Signed in as {me.email}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Shell({ me, signOut }: { me: Row; signOut: () => Promise<void> }) {
  const hash = useHash();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ss-admin-collapsed") === "1");
  const [drawer, setDrawer] = useState(false);
  const parts = hash.replace(/^#\/admin\/?/, "").split("/").filter(Boolean);
  const page = parts[0] ?? "";
  const id = parts[1];

  useEffect(() => {
    localStorage.setItem("ss-admin-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => setDrawer(false), [hash]);

  const current = NAV.find((n) => n.path === page) ?? NAV[0];
  let body: ReactNode;
  if (!allowed(me, current)) body = <div className="rounded-2xl bg-white p-10 text-center text-[14px] font-bold text-brand-ink/55">Your role does not include access to this section.</div>;
  else if (page === "") body = <OverviewPage me={me} />;
  else if (page === "users") body = id ? <UserDetailPage me={me} id={id} /> : <UsersPage />;
  else if (page === "finance") body = <FinancePage me={me} />;
  else if (page === "betting") body = <BettingPage me={me} />;
  else if (page === "agents") body = id ? <AgentDetailPage me={me} id={id} /> : <AgentsPage me={me} />;
  else if (page === "commissions") body = <CommissionsPage me={me} />;
  else if (page === "promotions") body = <PromotionsPage />;
  else if (page === "security") body = <SecurityPage />;
  else if (page === "admins") body = <AdminsPage />;
  else body = <SettingsPage me={me} />;

  const items = NAV.filter((n) => allowed(me, n));
  const side = (
    <nav className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-white/10 px-4", collapsed && "lg:justify-center lg:px-0")}>
        <span className={cn(collapsed && "lg:hidden")}><Logo light onClick={() => navTo("/admin")} /></span>
        <span className={cn("hidden text-[18px] font-black text-brand-yellow", collapsed && "lg:block")}>S</span>
      </div>
      <ul className="no-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((n) => {
          const active = n.path === current.path;
          return (
            <li key={n.path}>
              <button onClick={() => navTo(n.path ? `/admin/${n.path}` : "/admin")} title={n.label} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-bold transition", active ? "bg-brand-yellow text-brand-ink" : "text-white/70 hover:bg-white/[0.08] hover:text-white", collapsed && "lg:justify-center lg:px-0")}>
                <span className="text-[17px]">{n.icon}</span>
                <span className={cn(collapsed && "lg:hidden")}>{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className={cn("mb-2 rounded-xl bg-white/[0.06] p-3", collapsed && "lg:hidden")}>
          <p className="truncate text-[12.5px] font-black text-white">{me.full_name || me.email}</p>
          <p className="truncate text-[11px] font-semibold capitalize text-white/50">{String(me.role).replace("_", " ")}</p>
        </div>
        <button onClick={() => void signOut()} className={cn("w-full rounded-xl bg-white/10 px-3 py-2.5 text-[12.5px] font-black text-white hover:bg-white/20", collapsed && "lg:px-0")}>{collapsed ? "⎋" : "Sign out"}</button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-dvh bg-[#f3f5f8]">
      <aside className={cn("hidden shrink-0 bg-brand-ink transition-[width] duration-200 lg:block", collapsed ? "w-[72px]" : "w-[250px]")}>{side}</aside>
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/55" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <aside className="animate-sheet relative h-full w-[270px] bg-brand-ink" style={{ animationName: "none" }}>{side}</aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white px-4">
          <button onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setCollapsed((c) => !c) : setDrawer(true))} aria-label="Toggle menu" className="grid h-10 w-10 place-items-center rounded-xl bg-black/[0.05] text-[18px] hover:bg-black/10">☰</button>
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-black tracking-tight text-brand-ink">{current.icon} {current.label}</h2>
          <a href={window.location.pathname} target="_blank" rel="noreferrer" className="hidden rounded-xl bg-black/[0.05] px-3 py-2 text-[12px] font-black text-brand-ink/70 hover:bg-black/10 sm:block">Open betting site ↗</a>
          <Bell me={me} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1280px]" key={hash}>{body}</div>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}

export default function AdminApp({ recovering }: { recovering: boolean }) {
  useEffect(() => {
    document.title = "SportStake Admin";
    if (!window.location.hash.startsWith("#/admin")) window.location.hash = "/admin";
    return () => {
      document.title = "SportStake";
    };
  }, []);
  return <StaffGate portal="admin" recovering={recovering}>{({ me, signOut }) => <Shell me={me} signOut={signOut} />}</StaffGate>;
}

export { portalLink };
