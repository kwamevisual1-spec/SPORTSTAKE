import { useState } from "react";
import { ActionForm, Badge, Btn, Card, Loading, Section, Table, act, dt, statusTone, toast, useRpc, type FormField, type Row } from "../kit";
import { Credentials } from "./Agents";
import { createLoginAccount, randomPassword } from "../account";
import { errText, portalLink, rpc } from "../client";

const ROLES: [string, string][] = [["finance", "Finance – withdrawals, payments, reconciliation"], ["support", "Support – customers & KYC"], ["risk", "Risk – restrict accounts, audit"], ["trader", "Trader – events, odds, settlement"], ["affiliate_manager", "Affiliate manager – agents & commissions"], ["marketing", "Marketing – promotions & agents"]];
const PERMS: [string, string][] = [["dashboard.view", "View dashboard"], ["users.view", "View customers"], ["users.manage", "Suspend / restrict / flag customers"], ["users.kyc", "Manage KYC"], ["finance.view", "View finance & ledger"], ["withdrawals.approve", "Approve & pay withdrawals"], ["payments.reconcile", "Reconcile payments & chargebacks"], ["betting.view", "View betting"], ["betting.manage", "Manage events, odds & suspensions"], ["betting.settle", "Settle & cancel events"], ["bets.correct", "Authorise bet corrections"], ["agents.view", "View agents"], ["agents.manage", "Create & manage agents"], ["commissions.view", "View commissions"], ["commissions.calculate", "Run commission calculations"], ["commissions.approve", "Approve / reject commissions"], ["agent_payouts.process", "Process agent payouts"], ["promotions.manage", "Manage promotions & bonuses"], ["audit.view", "View audit log & logins"], ["settings.edit", "Edit platform settings"]];

export function AdminsPage() {
  const { data, error, loading, reload } = useRpc<Row[]>("admin_list_admins", {});
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [creds, setCreds] = useState<Row | null>(null);

  const submit = async (v: Record<string, string | boolean>) => {
    const email = String(v.email).trim().toLowerCase();
    if ((data ?? []).some((a) => String(a.email).toLowerCase() === email)) return void toast("That email is already an administrator.", "err"), false;
    const password = String(v.password).trim() || randomPassword();
    if (password.length < 8) return void toast("Password must be at least 8 characters.", "err"), false;
    let uid: string;
    try { uid = await createLoginAccount(email, password); } catch (e) { toast(errText(e), "err"); return false; }
    try {
      await rpc("admin_create_admin", { p_user_id: uid, p_email: email, p_full_name: String(v.full_name).trim(), p_role: v.role, p_permissions: null });
      setCreds({ login: portalLink("admin"), username: email, password, code: "—", link: "—", email });
      reload();
      return true;
    } catch (e) {
      toast(`${errText(e)} – a login account for ${email} was created but has no admin rights. Delete it in Supabase → Authentication → Users before retrying.`, "err");
      return false;
    }
  };

  const editFields = (a: Row): FormField[] => [
    { name: "role", label: "Role", type: "select", options: ROLES, def: String(a.role) },
    { name: "status", label: "Status", type: "select", options: [["active", "Active"], ["suspended", "Suspended (locked out)"]], def: String(a.status) },
    ...PERMS.map(([k, l]): FormField => ({ name: k, label: l, type: "checkbox", def: (a.permissions as string[]).includes(k) })),
  ];

  return (
    <div>
      <Section title="Administrators" sub="Only the Super Admin can create administrators or change their permissions. Every administrator must use two-factor authentication." actions={<Btn onClick={() => setCreate(true)}>＋ Create administrator</Btn>} />
      <Card pad={false}>
        <Loading error={error} loading={loading && !data}>
          <Table rows={data ?? []}
            cols={[
              { head: "Administrator", render: (r) => <div><p className="font-black text-brand-ink">{r.full_name || r.email}</p><p className="text-[11px] text-brand-ink/45">{r.email}</p></div> },
              { head: "Role", render: (r) => <Badge tone={r.role === "super_admin" ? "purple" : "blue"}>{String(r.role).replace("_", " ")}</Badge> },
              { head: "Permissions", render: (r) => (r.role === "super_admin" ? "Everything" : `${(r.permissions as string[]).length} granted`) },
              { head: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
              { head: "Last login", render: (r) => dt(r.last_login_at) },
              { head: "", render: (r) => (r.role === "super_admin" ? <span className="text-[11px] font-bold text-brand-ink/35">protected</span> : <Btn size="sm" variant="ghost" onClick={() => setEdit(r)}>Permissions</Btn>) },
            ]} />
        </Loading>
      </Card>
      {create ? <ActionForm title="Create administrator" intro="A role gives a sensible starting set of permissions. You can fine-tune them afterwards. Leave the password blank to auto-generate a temporary one." fields={[{ name: "full_name", label: "Full name", required: true }, { name: "email", label: "Email address", type: "email", required: true }, { name: "role", label: "Role", type: "select", options: ROLES, def: "support" }, { name: "password", label: "Temporary password (optional)", hint: "Blank = auto-generate" }]} submitLabel="Create administrator" onSubmit={submit} onClose={() => setCreate(false)} /> : null}
      {edit ? <ActionForm wide title={`Permissions – ${edit.email}`} intro="Tick exactly what this administrator may do. Changes take effect immediately." fields={editFields(edit)} onSubmit={async (v) => { const ok = await act("admin_update_admin", { p_user_id: edit.user_id, p_role: v.role, p_permissions: PERMS.filter(([k]) => v[k]).map(([k]) => k), p_status: v.status }, "Administrator updated"); if (ok) reload(); return ok; }} onClose={() => setEdit(null)} /> : null}
      {creds ? <Credentials c={{ ...creds, code: "—", link: "—" }} onClose={() => setCreds(null)} /> : null}
    </div>
  );
}
