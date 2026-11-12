import { useMemo, useState } from "react";
import { ALL_MATCHES, SPORT_LABEL, fixtureName, phaseOf, teamName } from "../data";
import { liveState } from "../lib/sim";
import { ghs, kickoffLabel } from "../lib/format";
import { useClock } from "../lib/clock";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { Crest } from "./Crest";
import { CloseIcon, HelpIcon, PlusIcon, SearchIcon } from "./Icons";

export function Logo({ onClick, light }: { onClick: () => void; light?: boolean }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-1.5" aria-label="SportStake home">
      <svg viewBox="0 0 32 32" className="h-7 w-7">
        <defs>
          <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3ee07f" />
            <stop offset="100%" stopColor="#0e7a37" />
          </linearGradient>
        </defs>
        <path d="M16 1.6 28.4 8.8v14.4L16 30.4 3.6 23.2V8.8z" fill="url(#logoG)" />
        <path d="M16 6.4 24.6 11v10L16 25.6 7.4 21V11z" fill="#0b3d20" fillOpacity="0.35" />
        <path d="M11.4 20.6c1.5-3.4 3-4.6 4.6-4.6 1.4 0 2.2.8 2.2 1.9 0 1.2-.9 2-2.1 2-1.4 0-2.3-1-2.5-2.6" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`text-[16px] font-black leading-none tracking-[-0.045em] ${light ? "text-white" : "text-brand-ink"}`}>
        Sport<span className="text-[#0e7a37]">Stake</span>
      </span>
    </button>
  );
}

export function Header() {
  const { screen, go, user, open, notify } = useStore();
  const now = useClock();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const isCasino = screen.name === "casino";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const t = Date.now();
    return ALL_MATCHES.filter(
      (m) => phaseOf(m, t) !== "ft" && (teamName(m.home).toLowerCase().includes(q) || teamName(m.away).toLowerCase().includes(q) || m.league.toLowerCase().includes(q)),
    ).slice(0, 12);
  }, [query]);

  return (
    <header className="relative z-40 shrink-0 bg-brand-yellow shadow-[0_6px_18px_-8px_rgba(16,19,26,0.45)]">
      <div className="flex h-14 items-center gap-1.5 px-3 lg:h-16 lg:px-6">
        <Logo onClick={() => go({ name: "home" })} />

        <nav className="ml-1 flex shrink-0 items-center gap-1 text-[14px]" aria-label="Product switch">
          {(["Sports", "Casino"] as const).map((label, i) => {
            const active = label === "Casino" ? isCasino : !isCasino;
            return (
              <span key={label} className="flex items-center gap-1">
                {i === 1 ? <span className="text-brand-ink/35">/</span> : null}
                <button
                  onClick={() => go(label === "Casino" ? { name: "casino" } : { name: "home" })}
                  className={cn("relative pb-0.5 font-extrabold tracking-tight transition-colors", active ? "text-brand-ink" : "text-brand-ink/55")}
                >
                  {label}
                  {active ? <span className="absolute -bottom-0.5 left-0 h-[3px] w-full rounded-full bg-brand-ink" /> : null}
                </button>
              </span>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button aria-label="Customer service" onClick={() => window.dispatchEvent(new Event("ss-support"))} className="hidden h-9 w-9 place-items-center rounded-full text-brand-ink active:scale-90 min-[420px]:grid">
            <HelpIcon className="h-[21px] w-[21px]" strokeWidth={2.1} />
          </button>
          <button
            aria-label="Search"
            onClick={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-brand-ink active:scale-90"
          >
            {searching ? <CloseIcon className="h-5 w-5" strokeWidth={2.4} /> : <SearchIcon className="h-[21px] w-[21px]" strokeWidth={2.2} />}
          </button>
          {user ? (
            <div className="flex items-center overflow-hidden rounded-full bg-brand-ink text-white shadow-[0_6px_14px_-6px_rgba(16,19,26,0.9)]">
              <button onClick={() => go({ name: "me" })} className="py-[7px] pl-3 pr-2 text-[12px] font-black tabular-nums">
                {ghs(user.balance)}
              </button>
              <button onClick={() => open({ type: "deposit" })} aria-label="Deposit" className="grid h-full place-items-center bg-brand-green px-2 py-[7px]">
                <PlusIcon className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => open({ type: "auth", mode: "login" })}
              className="whitespace-nowrap rounded-full bg-brand-ink px-3 py-[7px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(16,19,26,0.9)] active:scale-95"
            >
              Join / Login
            </button>
          )}
        </div>
      </div>

      {searching ? (
        <div className="animate-pop px-3 pb-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
            <SearchIcon className="h-4 w-4 text-brand-ink/40" strokeWidth={2.2} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim().length >= 2 && results.length === 0) notify("No matches found", "info");
              }}
              placeholder="Search clubs or leagues"
              className="w-full bg-transparent text-[13px] font-semibold text-brand-ink outline-none placeholder:text-brand-ink/40"
            />
          </div>
          {query.trim().length >= 2 ? (
            <div className="no-scrollbar absolute inset-x-3 top-[calc(100%-6px)] max-h-[60vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              {results.length === 0 ? (
                <p className="px-4 py-5 text-center text-[12px] font-semibold text-brand-ink/50">No clubs or leagues match "{query}".</p>
              ) : (
                results.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      open({ type: "match", matchId: m.id });
                      setSearching(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2.5 border-b border-black/[0.05] px-3 py-2.5 text-left last:border-0 active:bg-black/[0.03]"
                  >
                    <span className="flex shrink-0 items-center">
                      <Crest team={m.home} className="w-6" />
                      <Crest team={m.away} className="-ml-1.5 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-extrabold text-brand-ink">{fixtureName(m)}</span>
                      <span className="block truncate text-[10.5px] font-semibold text-brand-ink/45">
                        {SPORT_LABEL[m.sport]} · {m.league}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-[10.5px] font-black tabular-nums", liveState(m, now).phase === "live" ? "text-brand-red" : "text-brand-ink/45")}>
                      {liveState(m, now).phase === "live" ? `${liveState(m, now).score.join("-")} · ${liveState(m, now).label}` : kickoffLabel(m.kickoff, now)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
