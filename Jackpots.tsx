import { useStore } from "../store";
import { cur, num, sc } from "../lib/currency";
import { BoltIcon, ChevronRight, TrophyIcon } from "./Icons";

export function Jackpots() {
  const { push, go } = useStore();
  const cards = [
    {
      title: "Sports Jackpot",
      tag: "Must Win",
      badge: "Grand",
      amount: `${cur()} ${num(sc(8623))}`,
      sub: `12 games · ${cur()} ${num(sc(2))} per line`,
      gradient: "from-[#0e7a37] via-[#17a34a] to-[#3fd07a]",
      action: () => push({ name: "jackpot" }),
    },
    {
      title: "Casino Jackpot",
      tag: "Mega Drop",
      badge: "Super",
      amount: `${cur()} ${num(sc(45246))}`,
      sub: "Golden Kente · Aviator",
      gradient: "from-[#5b21b6] via-[#7c3aed] to-[#c084fc]",
      action: () => go({ name: "casino" }),
    },
  ];

  return (
    <section className="mt-3 flex gap-2.5 px-3">
      {cards.map((j) => (
        <button
          key={j.title}
          onClick={j.action}
          className={`relative flex-1 overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-left text-white shadow-lg transition active:scale-[0.98] ${j.gradient}`}
        >
          <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15 blur-xl" />
          <TrophyIcon className="absolute right-2 top-2 h-9 w-9 opacity-25" strokeWidth={1.7} />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-[13px] font-black tracking-tight">{j.title}</h3>
              <span className="flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase">
                <BoltIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
                {j.tag}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1">
              <span className="rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-black uppercase">{j.badge}</span>
              <span className="text-[15.5px] font-black tracking-tight">{j.amount}</span>
            </div>
            <p className="mt-1.5 flex items-center gap-0.5 text-[9.5px] font-bold text-white/80">
              {j.sub} <ChevronRight className="h-3 w-3" strokeWidth={3} />
            </p>
          </div>
        </button>
      ))}
    </section>
  );
}
