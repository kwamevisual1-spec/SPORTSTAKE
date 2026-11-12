import { SCREENS, useStore } from "../store";
import { BoltIcon, CalendarIcon, CodeIcon, GiftIcon, RobotIcon, TrophyIcon } from "./Icons";

export function QuickLinks() {
  const { push, open, aiSelect } = useStore();
  const links = [
    { label: "AISelect", Icon: RobotIcon, tone: "text-[#2563eb]", action: aiSelect },
    { label: "Today's Football", Icon: CalendarIcon, tone: "text-brand-green", action: () => push(SCREENS.today()) },
    { label: "Euro Top 5", Icon: TrophyIcon, tone: "text-[#7c3aed]", action: () => push(SCREENS.euro()) },
    { label: "Booking Code", Icon: CodeIcon, tone: "text-brand-ink", action: () => open({ type: "loadCode" }) },
    { label: "Sure Odds", Icon: BoltIcon, tone: "text-[#f59e0b]", action: () => push(SCREENS.sure()) },
    { label: "Promotions", Icon: GiftIcon, tone: "text-[#e11d48]", action: () => push({ name: "promotions" }) },
  ];

  return (
    <section className="no-scrollbar flex gap-2.5 overflow-x-auto px-3 py-3">
      {links.map(({ label, Icon, tone, action }) => (
        <button
          key={label}
          onClick={action}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-black/5 bg-white px-3 py-2.5 shadow-[0_2px_8px_-4px_rgba(16,19,26,0.35)] transition active:scale-[0.97]"
        >
          <Icon className={`h-[18px] w-[18px] ${tone}`} strokeWidth={2} />
          <span className="text-[12.5px] font-extrabold tracking-tight text-brand-ink">{label}</span>
        </button>
      ))}
    </section>
  );
}
