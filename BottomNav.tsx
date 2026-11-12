import { liveCount } from "../data";
import { useClock } from "../lib/clock";
import { SCREENS, useStore } from "../store";
import { cn } from "../utils/cn";
import { HomeIcon, LiveIcon, SmileIcon, TicketIcon } from "./Icons";
import { AviatorNavIcon } from "../games/art";

export function BottomNav() {
  const { screen, go, open, overlay, user } = useStore();
  const now = useClock();
  const openBets = user?.bets.filter((b) => b.status === "open").length ?? 0;
  const active =
    overlay?.type === "game" && overlay.gameId === "aviator"
      ? "aviator"
      : screen.name === "home"
        ? "home"
        : screen.name === "book" && screen.title === "Live"
          ? "live"
          : screen.name === "mybets"
            ? "mybets"
            : screen.name === "me"
              ? "me"
              : "";

  const items = [
    { key: "home", label: "Home", Icon: HomeIcon, badge: 0, action: () => go({ name: "home" }) },
    { key: "live", label: "Live", Icon: LiveIcon, badge: liveCount(now), action: () => go(SCREENS.live()) },
    { key: "aviator", label: "Aviator", Icon: HomeIcon, badge: 0, action: () => open({ type: "game", gameId: "aviator" }) },
    { key: "mybets", label: "My Bets", Icon: TicketIcon, badge: openBets, action: () => go({ name: "mybets" }) },
    { key: "me", label: "Me", Icon: SmileIcon, badge: 0, action: () => go({ name: "me" }) },
  ];

  return (
    <nav className="relative z-[45] shrink-0 border-t border-black/[0.06] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
      <ul className="flex items-stretch">
        {items.map(({ key, label, Icon, badge, action }) => {
          const isActive = active === key;
          const special = key === "aviator";
          return (
            <li key={key} className="flex-1">
              <button onClick={action} className="relative flex w-full flex-col items-center gap-0.5 py-2">
                {special ? (
                  <span className="relative -mt-4 grid h-12 w-14 place-items-end justify-center">
                    <AviatorNavIcon className="h-11 w-14 drop-shadow-[0_3px_4px_rgba(229,5,57,0.25)]" />
                  </span>
                ) : (
                  <span className="relative">
                    <span className={cn("grid h-8 w-8 place-items-center rounded-xl transition-colors", isActive ? "bg-brand-green-soft text-brand-green" : "text-brand-ink/45")}>
                      <Icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.2 : 1.9} />
                    </span>
                    {badge > 0 ? (
                      <span className="absolute -right-2.5 -top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[#ff5a4e] px-1 text-[9px] font-black text-white ring-2 ring-white">
                        {badge}
                      </span>
                    ) : null}
                  </span>
                )}
                <span className={cn("text-[10.5px] tracking-tight", isActive && !special ? "font-black text-brand-green" : "font-bold text-brand-ink/50")}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
