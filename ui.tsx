import { useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { copyText } from "../lib/format";
import { CheckIcon, ChevronLeft, CloseIcon, CopyIcon } from "./Icons";

export const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] font-semibold text-brand-ink outline-none transition placeholder:text-brand-ink/30 focus:border-brand-green focus:ring-2 focus:ring-brand-green/15";

export function Sheet({
  title,
  onClose,
  children,
  footer,
  tall,
  z = "z-[80]",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  z?: string;
}) {
  return (
    <div className={cn("absolute inset-0 flex flex-col justify-end md:items-center md:justify-center md:p-6", z)}>
      <button aria-label="Close" className="absolute inset-0 bg-brand-ink/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "animate-sheet relative flex max-h-[92%] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl md:max-h-[90%] md:max-w-[560px] md:rounded-[1.75rem]",
          tall && "h-[92%] md:h-[88%]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3.5">
          <div className="min-w-0 text-[16px] font-black tracking-tight text-brand-ink">{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.05] text-brand-ink/60 active:scale-90"
          >
            <CloseIcon className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0 border-t border-black/[0.06] bg-white">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ScreenHeader({ title, onBack, right }: { title: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-black/[0.06] bg-white/95 px-2 backdrop-blur">
      {onBack ? (
        <button onClick={onBack} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-brand-ink active:bg-black/5">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-[16px] font-black tracking-tight text-brand-ink">{title}</h1>
      {right}
    </div>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
  onCopied,
}: {
  text: string;
  label?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          onCopied?.();
          window.setTimeout(() => setDone(false), 1600);
        }
      }}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-black text-white transition active:scale-95",
        done ? "bg-brand-green-deep" : "bg-brand-green",
        className,
      )}
    >
      {done ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} /> : <CopyIcon className="h-3.5 w-3.5" strokeWidth={2.4} />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-bold text-brand-ink/60">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] font-semibold text-brand-ink/40">{hint}</span> : null}
    </label>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-black tracking-tight transition active:scale-[0.98]",
        disabled ? "bg-black/[0.08] text-brand-ink/35" : "bg-brand-green text-white shadow-[0_10px_22px_-12px_rgba(23,163,74,0.9)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-green-soft text-brand-green">{icon}</span>
      <p className="mt-3 text-[15px] font-black tracking-tight text-brand-ink">{title}</p>
      <p className="mt-1 max-w-[260px] text-[12px] font-semibold leading-relaxed text-brand-ink/45">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-bold tracking-tight transition active:scale-95",
        active ? "bg-brand-yellow text-brand-ink shadow-sm" : "bg-black/[0.06] text-brand-ink/55",
      )}
    >
      {children}
    </button>
  );
}
