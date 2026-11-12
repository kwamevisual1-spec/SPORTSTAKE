import { useCallback, useEffect, useRef, useState } from "react";
import { SCREENS, useStore } from "../store";
import { cur, num, sc } from "../lib/currency";
import { cn } from "../utils/cn";
import { BoltIcon, GiftIcon, LockIcon, PlaneIcon } from "./Icons";

export function HeroBanner() {
  const { push, open } = useStore();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  const slides = [
    {
      id: "odds",
      image: true,
      title: "TOP1",
      accent: "BEST ODDS",
      sub: "Best odds guaranteed on today's football",
      pills: [
        { Icon: BoltIcon, label: "Fast payouts" },
        { Icon: LockIcon, label: "Safe & secure" },
      ],
      cta: "BET NOW",
      action: () => push(SCREENS.today()),
      gradient: "",
    },
    {
      id: "bonus",
      image: false,
      title: "100%",
      accent: "FIRST DEPOSIT BONUS",
      sub: `Up to ${cur()} ${num(sc(200))} credited instantly`,
      pills: [{ Icon: GiftIcon, label: "Sports & casino" }],
      cta: "CLAIM",
      action: () => open({ type: "promo", id: "welcome" }),
      gradient: "from-[#4c1d95] via-[#7c3aed] to-[#db2777]",
    },
    {
      id: "aviator",
      image: false,
      title: "AVIATOR",
      accent: "UP TO ×10,000",
      sub: "Cash out before the plane flies away",
      pills: [{ Icon: PlaneIcon, label: "Provably fair" }],
      cta: "PLAY NOW",
      action: () => open({ type: "game", gameId: "aviator" }),
      gradient: "from-[#7f1d1d] via-[#dc2626] to-[#f59e0b]",
    },
  ];

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.max(0, Math.min(2, Math.round(el.scrollLeft / el.clientWidth))));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      el.scrollTo({ left: ((activeRef.current + 1) % 3) * el.clientWidth, behavior: "smooth" });
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="-mt-3 px-3 lg:mt-3">
      <div className="relative">
        <div ref={trackRef} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl shadow-[0_12px_24px_-14px_rgba(0,0,0,0.6)]">
          {slides.map((s) => (
            <article key={s.id} onClick={s.action} className="relative h-[118px] w-full shrink-0 cursor-pointer snap-start overflow-hidden sm:h-[150px] lg:h-[180px]">
              {s.image ? (
                <>
                  <img src="/images/hero-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#04361c] via-[#0a5c2c]/90 to-transparent" />
                </>
              ) : (
                <div className={cn("absolute inset-0 bg-gradient-to-br", s.gradient)}>
                  <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                  <div className="absolute bottom-[-30%] right-6 h-32 w-32 rotate-12 rounded-2xl bg-white/10" />
                </div>
              )}
              <div className="relative flex h-full flex-col justify-center gap-1.5 px-3.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-black italic leading-none text-brand-yellow drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">{s.title}</span>
                  <span className="text-[14px] font-extrabold leading-none text-white">{s.accent}</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/75">{s.sub}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.pills.map(({ Icon, label }) => (
                    <span key={label} className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-[3px] text-[8.5px] font-extrabold uppercase text-white">
                      <Icon className="h-3 w-3 text-brand-lime" strokeWidth={2.4} />
                      {label}
                    </span>
                  ))}
                </div>
                <span className="shine-btn mt-0.5 w-fit rounded-full bg-brand-yellow px-3.5 py-1.5 text-[11px] font-black text-brand-ink shadow-lg">{s.cta} →</span>
              </div>
            </article>
          ))}
        </div>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Slide ${i + 1}`}
              onClick={() => trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" })}
              className={cn("h-1.5 rounded-full transition-all", i === active ? "w-4 bg-white" : "w-1.5 bg-white/50")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
