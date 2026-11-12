import { SCREENS, useStore } from "../store";
import { AffiliateIcon, FootballIcon, GridIcon, Pick12Icon, TrophyIcon, VirtualIcon } from "./Icons";

export function QuickNav() {
  const { push, open } = useStore();
  const items = [
    { label: "Football", Icon: FootballIcon, action: () => push(SCREENS.sport("football")) },
    { label: "Jackpot", Icon: TrophyIcon, action: () => push({ name: "jackpot" }) },
    { label: "Virtuals", Icon: VirtualIcon, action: () => push(SCREENS.sport("v-football")) },
    { label: "Pick12", Icon: Pick12Icon, action: () => push({ name: "pick12" }) },
    { label: "Affiliate", Icon: AffiliateIcon, action: () => push({ name: "affiliate" }) },
    { label: "All", Icon: GridIcon, action: () => open({ type: "allSports" }) },
  ];

  return (
    <nav className="rounded-b-[2rem] bg-brand-yellow px-2 pb-4 pt-1 lg:rounded-[2rem] lg:pt-4" aria-label="Sports categories">
      <ul className="flex items-start justify-between">
        {items.map(({ label, Icon, action }) => (
          <li key={label} className="flex-1">
            <button onClick={action} className="group flex w-full flex-col items-center gap-1.5">
              <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-b from-brand-yellow-soft to-brand-yellow-deep shadow-[inset_0_-2px_0_rgba(16,19,26,0.12),0_4px_10px_-4px_rgba(16,19,26,0.5)] transition duration-200 group-active:scale-90">
                <Icon className="h-[26px] w-[26px] text-brand-ink" strokeWidth={1.85} />
              </span>
              <span className="text-[11px] font-bold tracking-tight text-brand-ink/90">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
