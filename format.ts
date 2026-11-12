import { useEffect, useState } from "react";
import { cur } from "./currency";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ghs = (n: number) => `${cur()} ${money(n)}`;

const pad = (n: number) => String(n).padStart(2, "0");

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function hhmm(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function kickoffLabel(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const diff = Math.round((startOfDay(d) - startOfDay(new Date(now))) / 86_400_000);
  if (diff === 0) return `Today ${hhmm(ts)}`;
  if (diff === 1) return `Tomorrow ${hhmm(ts)}`;
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  return `${day} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hhmm(ts)}`;
}

export function dateTime(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${hhmm(ts)}`;
}

export const parseAmount = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? round2(n) : 0;
};

export const cleanAmount = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, "");
  const [a, ...rest] = cleaned.split(".");
  return rest.length ? `${a}.${rest.join("").slice(0, 2)}` : a;
};

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function openShare(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
