import { useState } from "react";
import type { Row } from "./client";

type S = { key: string; label: string; color: string };

const W = 640;
function scale(vals: number[]) {
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  if (min >= 0 && max <= 4 && vals.every(Number.isInteger)) return { lo: 0, hi: 4 }; // whole-number ticks for small counts
  const span = max - min || 1;
  const pad = span * 0.08;
  return { lo: min < 0 ? min - pad : 0, hi: max + pad };
}
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n * 100) / 100));

function Axes({ lo, hi, h, left }: { lo: number; hi: number; h: number; left: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 12 + ((h - 36) * i) / 4;
        const v = hi - ((hi - lo) * i) / 4;
        return (
          <g key={i}>
            <line x1={left} x2={W - 8} y1={y} y2={y} stroke="#0000000f" />
            <text x={left - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#6b7280">{short(v)}</text>
          </g>
        );
      })}
    </>
  );
}

function Legend({ series }: { series: S[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-[11.5px] font-bold text-brand-ink/60">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function LineChart({ data, x, series, height = 220, fmtX, fmtV }: { data: Row[]; x: string; series: S[]; height?: number; fmtX: (v: unknown) => string; fmtV: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="py-10 text-center text-[12.5px] font-semibold text-brand-ink/40">No data for this period.</p>;
  const left = 46;
  const vals = data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0)));
  const { lo, hi } = scale(vals);
  const px = (i: number) => left + ((W - left - 12) * (data.length === 1 ? 0.5 : i / (data.length - 1)));
  const py = (v: number) => 12 + ((height - 36) * (hi - v)) / (hi - lo || 1);
  const step = Math.max(1, Math.ceil(data.length / 7));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(((rel - left) / (W - left - 12)) * (data.length - 1)))));
        }}>
        <Axes lo={lo} hi={hi} h={height} left={left} />
        {lo < 0 ? <line x1={left} x2={W - 8} y1={py(0)} y2={py(0)} stroke="#00000030" strokeDasharray="3 3" /> : null}
        {series.map((s, si) => {
          const d = data.map((r, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(Number(r[s.key] ?? 0)).toFixed(1)}`).join(" ");
          return (
            <g key={s.key}>
              {si === 0 && data.length > 1 ? <path d={`${d} L${px(data.length - 1)},${py(Math.max(lo, 0))} L${px(0)},${py(Math.max(lo, 0))} Z`} fill={s.color} opacity="0.1" /> : null}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {data.length <= 31 ? data.map((r, i) => <circle key={i} cx={px(i)} cy={py(Number(r[s.key] ?? 0))} r="2.6" fill="#fff" stroke={s.color} strokeWidth="1.6" />) : null}
            </g>
          );
        })}
        {data.map((r, i) => (i % step === 0 ? <text key={i} x={px(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{fmtX(r[x])}</text> : null))}
        {hover !== null ? (
          <g>
            <line x1={px(hover)} x2={px(hover)} y1={12} y2={height - 24} stroke="#00000025" />
            <foreignObject x={Math.min(px(hover) + 8, W - 170)} y={10} width="160" height={24 + series.length * 16}>
              <div style={{ background: "#10131a", color: "#fff", borderRadius: 8, padding: "6px 8px", fontSize: 11, lineHeight: "16px" }}>
                <b>{fmtX(data[hover][x])}</b>
                {series.map((s) => (
                  <div key={s.key}><span style={{ color: s.color }}>●</span> {s.label}: {fmtV(Number(data[hover][s.key] ?? 0))}</div>
                ))}
              </div>
            </foreignObject>
          </g>
        ) : null}
      </svg>
      <Legend series={series} />
    </div>
  );
}

export function BarChart({ data, x, series, height = 220, fmtX, fmtV }: { data: Row[]; x: string; series: S[]; height?: number; fmtX: (v: unknown) => string; fmtV: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="py-10 text-center text-[12.5px] font-semibold text-brand-ink/40">No data for this period.</p>;
  const left = 46;
  const vals = data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0)));
  const { lo, hi } = scale(vals);
  const slot = (W - left - 12) / data.length;
  const bw = Math.max(2, Math.min(26, (slot * 0.78) / series.length));
  const py = (v: number) => 12 + ((height - 36) * (hi - v)) / (hi - lo || 1);
  const step = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" onMouseLeave={() => setHover(null)}>
        <Axes lo={lo} hi={hi} h={height} left={left} />
        {data.map((r, i) => {
          const cx = left + slot * i + slot / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={cx - slot / 2} y={12} width={slot} height={height - 36} fill="transparent" />
              {series.map((s, si) => {
                const v = Number(r[s.key] ?? 0);
                const bx = cx - (bw * series.length) / 2 + si * bw;
                const y0 = py(Math.max(lo, 0));
                return <rect key={s.key} x={bx} y={Math.min(py(v), y0)} width={bw - 1.5} height={Math.max(1.5, Math.abs(py(v) - y0))} rx="2.5" fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
              })}
              {i % step === 0 ? <text x={cx} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{fmtX(r[x])}</text> : null}
            </g>
          );
        })}
        {hover !== null ? (
          <foreignObject x={Math.min(left + slot * hover + slot, W - 170)} y={10} width="160" height={24 + series.length * 16}>
            <div style={{ background: "#10131a", color: "#fff", borderRadius: 8, padding: "6px 8px", fontSize: 11, lineHeight: "16px" }}>
              <b>{fmtX(data[hover][x])}</b>
              {series.map((s) => (
                <div key={s.key}><span style={{ color: s.color }}>●</span> {s.label}: {fmtV(Number(data[hover][s.key] ?? 0))}</div>
              ))}
            </div>
          </foreignObject>
        ) : null}
      </svg>
      <Legend series={series} />
    </div>
  );
}

export function Donut({ parts, center }: { parts: { label: string; value: number; color: string }[]; center?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="py-10 text-center text-[12.5px] font-semibold text-brand-ink/40">No settled bets yet.</p>;
  const r = 52;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
        <g transform="rotate(-90 70 70)">
          {parts.map((p) => {
            const len = (p.value / total) * c;
            const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />;
            off += len;
            return el;
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" fontSize="20" fontWeight="900" fill="#10131a">{total}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#6b7280">{center ?? "total"}</text>
      </svg>
      <div className="space-y-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[12.5px] font-bold text-brand-ink/70">
            <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
            {p.label}
            <span className="ml-auto pl-3 tabular-nums text-brand-ink">{p.value}</span>
            <span className="w-10 text-right text-brand-ink/40">{Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
