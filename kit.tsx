import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { errText, rpc, type Row } from "./client";

export type { Row };

/* ---------- formatting ---------- */
export const fmt = (n: unknown, d = 2) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const sym = (c?: string) => (c === "NGN" ? "₦" : "GH₵");
export const money = (n: unknown, c?: string) => `${Number(n ?? 0) < 0 ? "−" : ""}${sym(c)}${fmt(Math.abs(Number(n ?? 0)))}`;
export const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const dday = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—");

export function downloadCsv(name: string, rows: Row[]) {
  if (!rows.length) return toast("Nothing to export", "info");
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- toast ---------- */
type T = { id: number; msg: string; tone: "ok" | "err" | "info" };
const listeners = new Set<(t: T) => void>();
export function toast(msg: string, tone: T["tone"] = "ok") {
  const t = { id: Date.now() + Math.random(), msg, tone };
  listeners.forEach((l) => l(t));
}
export function ToastHost() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const l = (t: T) => {
      setItems((x) => [...x, t]);
      window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 4200);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
      {items.map((t) => (
        <div key={t.id} className={cn("animate-pop pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-2xl", t.tone === "err" ? "bg-[#b42318]" : t.tone === "info" ? "bg-[#1f2937]" : "bg-brand-ink")}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ---------- data ---------- */
export function useRpc<T = Row>(fn: string, args: Record<string, unknown> | null, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(args !== null);
  const seq = useRef(0);
  const key = fn + JSON.stringify(args);
  const load = useCallback(async () => {
    if (args === null) return;
    const my = ++seq.current;
    try {
      const d = await rpc<T>(fn, args);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(errText(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    setLoading(args !== null);
    void load();
    if (!refreshMs) return;
    const id = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(id);
  }, [load, refreshMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload: load };
}

/** call a write function with success / error toasts */
export async function act(fn: string, args: Record<string, unknown>, ok?: string): Promise<boolean> {
  try {
    const r = await rpc<unknown>(fn, args);
    if (ok) toast(typeof r === "string" && r === "awaiting_second_approver" ? errText(new Error(r)) : ok);
    return true;
  } catch (e) {
    toast(errText(e), "err");
    return false;
  }
}

/* ---------- primitives ---------- */
export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-black/[0.06] bg-white shadow-[0_6px_20px_-16px_rgba(16,19,26,0.35)]", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
          <h3 className="text-[14px] font-black tracking-tight text-brand-ink">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      ) : null}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default", hint }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "warn"; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_6px_20px_-16px_rgba(16,19,26,0.35)]" title={hint}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-ink/45">{label}</p>
      <p className={cn("mt-1 text-[22px] font-black leading-tight tracking-tight tabular-nums", tone === "good" && "text-brand-green-deep", tone === "bad" && "text-brand-red", tone === "warn" && "text-[#b45309]")}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11.5px] font-semibold text-brand-ink/50">{sub}</p> : null}
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled, busy, type = "button", className, title }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "dark" | "danger" | "ghost" | "yellow"; size?: "sm" | "md"; disabled?: boolean; busy?: boolean; type?: "button" | "submit"; className?: string; title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-black tracking-tight transition active:scale-[0.97] disabled:opacity-45",
        size === "sm" ? "px-2.5 py-1.5 text-[11.5px]" : "px-4 py-2.5 text-[13px]",
        variant === "primary" && "bg-brand-green text-white hover:bg-brand-green-deep",
        variant === "dark" && "bg-brand-ink text-white hover:bg-black",
        variant === "yellow" && "bg-brand-yellow text-brand-ink hover:bg-brand-yellow-deep",
        variant === "danger" && "bg-[#e8342e] text-white hover:bg-[#c42a25]",
        variant === "ghost" && "bg-black/[0.06] text-brand-ink hover:bg-black/10",
        className,
      )}
    >
      {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : null}
      {children}
    </button>
  );
}

const TONES: Record<string, string> = {
  green: "bg-brand-green-soft text-brand-green-deep", red: "bg-[#fde8e7] text-brand-red", yellow: "bg-[#fff4c2] text-[#8a6100]", gray: "bg-black/[0.06] text-brand-ink/65", blue: "bg-[#e6efff] text-[#1d4ed8]", purple: "bg-[#f1e8ff] text-[#6d28d9]",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES | string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-black capitalize", TONES[tone] ?? TONES.gray)}>{children}</span>;
}
export const statusTone = (s?: string) =>
  ({ active: "green", approved: "green", won: "green", paid: "green", verified: "green", succeeded: "green", qualified: "green", live: "red", pending: "yellow", registered: "yellow", scheduled: "blue", open: "blue", restricted: "yellow",
     suspended: "red", rejected: "red", lost: "red", failed: "red", disqualified: "red", chargeback: "red", deactivated: "red", void: "gray", cancelled: "gray", finished: "gray", none: "gray", cashed_out: "purple" } as Record<string, string>)[s ?? ""] ?? "gray";

const inputCls = "w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 text-[13.5px] font-semibold text-brand-ink outline-none transition placeholder:font-medium placeholder:text-brand-ink/30 focus:border-brand-green focus:ring-2 focus:ring-brand-green/15";
export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-[11.5px] font-bold text-brand-ink/60">{label}</span> : null}
      {children}
      {hint ? <span className="mt-1 block text-[11px] font-semibold text-brand-ink/40">{hint}</span> : null}
    </label>
  );
}
export function Input(p: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const { label, hint, className, ...rest } = p;
  return (
    <Field label={label} hint={hint}>
      <input {...rest} className={cn(inputCls, className)} />
    </Field>
  );
}
export function Select({ label, value, onChange, options, className }: { label?: string; value: string; onChange: (v: string) => void; options: [string, string][]; className?: string }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "appearance-none pr-8", className)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-black/[0.05] p-1">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cn("shrink-0 rounded-lg px-3.5 py-2 text-[12.5px] font-black transition", value === k ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink/55 hover:text-brand-ink")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Table<T extends Row>({ cols, rows, empty = "Nothing to show yet.", onRow }: { cols: { head: string; render: (r: T) => ReactNode; align?: "right" | "center"; className?: string }[]; rows: T[]; empty?: string; onRow?: (r: T) => void }) {
  if (!rows.length) return <p className="px-4 py-10 text-center text-[13px] font-semibold text-brand-ink/45">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-black/[0.07] bg-black/[0.02]">
            {cols.map((c) => (
              <th key={c.head} className={cn("whitespace-nowrap px-3 py-2.5 text-[10.5px] font-black uppercase tracking-wider text-brand-ink/45", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.id as string) ?? i} onClick={onRow ? () => onRow(r) : undefined} className={cn("border-b border-black/[0.05] last:border-0", onRow && "cursor-pointer hover:bg-brand-green-soft/40")}>
              {cols.map((c) => (
                <td key={c.head} className={cn("px-3 py-2.5 font-semibold text-brand-ink/80", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (o: number) => void }) {
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] px-4 py-2.5 text-[12px] font-bold text-brand-ink/55">
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <span className="flex gap-1.5">
        <Btn size="sm" variant="ghost" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          ‹ Prev
        </Btn>
        <Btn size="sm" variant="ghost" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next ›
        </Btn>
      </span>
    </div>
  );
}

export function Loading({ error, loading, children }: { error: string | null; loading: boolean; children: ReactNode }) {
  if (error) return <p className="rounded-xl bg-[#fde8e7] px-4 py-3 text-[13px] font-bold text-brand-red">{error}</p>;
  if (loading) return <div className="grid place-items-center py-14"><span className="h-6 w-6 animate-spin rounded-full border-[3px] border-brand-green/25 border-t-brand-green" /></div>;
  return <>{children}</>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button aria-label="Close" className="absolute inset-0 bg-brand-ink/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("animate-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <header className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
          <h3 className="text-[15px] font-black tracking-tight text-brand-ink">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-brand-ink/60">✕</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export type FormField = { name: string; label: string; type?: "text" | "number" | "password" | "email" | "textarea" | "select" | "datetime-local" | "date" | "checkbox"; options?: [string, string][]; required?: boolean; placeholder?: string; def?: string | boolean; hint?: string; minLength?: number; step?: string };

/** Generic modal form – used for every admin action that needs input / a reason. */
export function ActionForm({ title, intro, fields, submitLabel = "Save", danger, onSubmit, onClose, wide }: {
  title: string; intro?: ReactNode; fields: FormField[]; submitLabel?: string; danger?: boolean; wide?: boolean;
  onSubmit: (v: Record<string, string | boolean>) => Promise<boolean | void>; onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, string | boolean>>(() => Object.fromEntries(fields.map((f) => [f.name, f.def ?? (f.type === "checkbox" ? false : "")])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      const x = v[f.name];
      if (f.required && (x === "" || x === undefined)) return setErr(`${f.label} is required.`);
      if (f.minLength && String(x).trim().length < f.minLength) return setErr(`${f.label} must be at least ${f.minLength} characters.`);
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await onSubmit(v);
      if (r !== false) onClose();
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} className="space-y-3.5">
        {intro ? <div className="text-[13px] font-semibold leading-relaxed text-brand-ink/65">{intro}</div> : null}
        {fields.map((f) =>
          f.type === "textarea" ? (
            <Field key={f.name} label={f.label} hint={f.hint}>
              <textarea rows={3} value={String(v[f.name])} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} className={inputCls} />
            </Field>
          ) : f.type === "select" ? (
            <Select key={f.name} label={f.label} value={String(v[f.name])} options={f.options ?? []} onChange={(x) => setV({ ...v, [f.name]: x })} />
          ) : f.type === "checkbox" ? (
            <label key={f.name} className="flex items-center gap-2 text-[13px] font-bold text-brand-ink/75">
              <input type="checkbox" checked={Boolean(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} className="h-4 w-4 accent-[#17a34a]" />
              {f.label}
            </label>
          ) : (
            <Input key={f.name} label={f.label} hint={f.hint} type={f.type ?? "text"} step={f.step} value={String(v[f.name])} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} autoComplete="off" />
          ),
        )}
        {err ? <p className="rounded-xl bg-[#fde8e7] px-3 py-2 text-[12.5px] font-bold text-brand-red">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant={danger ? "danger" : "primary"} busy={busy}>{submitLabel}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Btn size="sm" variant="ghost" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setOk(true);
      window.setTimeout(() => setOk(false), 1500);
    }}>
      {ok ? "Copied ✓" : label}
    </Btn>
  );
}

export function useHash() {
  const [h, setH] = useState(() => window.location.hash);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return h;
}
export const navTo = (path: string) => {
  window.location.hash = path;
};

export const Section = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-[22px] font-black tracking-tight text-brand-ink">{title}</h1>
      {sub ? <p className="text-[12.5px] font-semibold text-brand-ink/50">{sub}</p> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2">{actions}</div>
  </div>
);
