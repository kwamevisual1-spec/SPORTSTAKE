import type { ReactNode } from "react";
import { ALL_MATCHES, SPORTS, SPORT_LABEL, liveCount, phaseOf, todaysFootball } from "../data";
import { useClock } from "../lib/clock";
import { SCREENS, useStore, type Screen } from "../store";
import { cn } from "../utils/cn";
import { sportIcon } from "./SportsbookScreen";
import { CalendarIcon, GiftIcon, GridIcon, HomeIcon, LiveIcon, Pick12Icon, TicketIcon, TrophyIcon, UserIcon } from "./Icons";
import { AviatorNavIcon, Bomb } from "../games/art";

function Item({ icon, label, count, active, onClick, tone }: { icon: ReactNode; label: string; count?: number; active?: boolean; onClick: () => void; tone?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-bold transition",
        active ? "bg-brand-green-soft text-brand-green-deep" : "text-brand-ink/75 hover:bg-black/[0.04]",
      )}
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center", tone)}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-black", active ? "bg-brand-green text-white" : "bg-black/[0.06] text-brand-ink/60")}>{count}</span> : null}
    </button>
  );
}

const Heading = ({ children }: { children: ReactNode }) => <p className="px-3 pb-1 pt-4 text-[10.5px] font-black uppercase tracking-[0.14em] text-brand-ink/35">{children}</p>;

export function Sidebar() {
  const { screen, go, open } = useStore();
  const now = useClock();
  const isBook = (title: string) => screen.name === "book" && screen.title === title;
  const nav = (s: Screen) => () => go(s);

  return (
    <aside className="no-scrollbar hidden w-[232px] shrink-0 overflow-y-auto border-r border-black/[0.06] bg-white px-2.5 pb-6 pt-3 lg:block xl:w-[248px]">
      <Item icon={<HomeIcon className="h-5 w-5" strokeWidth={2} />} label="Home" active={screen.name === "home"} onClick={nav({ name: "home" })} />
      <Item icon={<LiveIcon className="h-5 w-5 text-brand-red" strokeWidth={2} />} label="Live" count={liveCount(now)} active={isBook("Live")} onClick={nav(SCREENS.live())} />
      <Item icon={<CalendarIcon className="h-5 w-5" strokeWidth={2} />} label="Today's Football" count={todaysFootball(now).length} active={isBook("Today's Football")} onClick={nav(SCREENS.today())} />

      <Heading>Sports</Heading>
      {SPORTS.map((s) => (
        <Item
          key={s}
          icon={sportIcon(s)}
          label={SPORT_LABEL[s]}
          count={ALL_MATCHES.filter((m) => m.sport === s && phaseOf(m, now) === "live").length}
          active={isBook(SPORT_LABEL[s])}
          onClick={nav(SCREENS.sport(s))}
        />
      ))}
      <Item icon={<GridIcon className="h-5 w-5" />} label="All Sports" onClick={() => open({ type: "allSports" })} />

      <Heading>Casino</Heading>
      <Item icon={<AviatorNavIcon className="h-7 w-7" />} label="Aviator" onClick={() => open({ type: "game", gameId: "aviator" })} />
      <Item icon={<Bomb className="h-6 w-6" />} label="Mini Mines" onClick={() => open({ type: "game", gameId: "mines" })} />
      <Item icon={<TrophyIcon className="h-5 w-5" strokeWidth={2} />} label="All casino games" active={screen.name === "casino"} onClick={nav({ name: "casino" })} />

      <Heading>More</Heading>
      <Item icon={<TrophyIcon className="h-5 w-5" strokeWidth={2} />} label="Sports Jackpot" active={screen.name === "jackpot"} onClick={nav({ name: "jackpot" })} />
      <Item icon={<Pick12Icon className="h-5 w-5" strokeWidth={2} />} label="Pick12" active={screen.name === "pick12"} onClick={nav({ name: "pick12" })} />
      <Item icon={<GiftIcon className="h-5 w-5" strokeWidth={2} />} label="Promotions" active={screen.name === "promotions"} onClick={nav({ name: "promotions" })} />
      <Item icon={<TicketIcon className="h-5 w-5" strokeWidth={2} />} label="My Bets" active={screen.name === "mybets"} onClick={nav({ name: "mybets" })} />
      <Item icon={<UserIcon className="h-5 w-5" strokeWidth={2} />} label="My Account" active={screen.name === "me"} onClick={nav({ name: "me" })} />
      <p className="px-3 pt-5 text-[10px] font-semibold leading-relaxed text-brand-ink/35">18+ · Gamble responsibly. Odds are subject to change.</p>
    </aside>
  );
}
