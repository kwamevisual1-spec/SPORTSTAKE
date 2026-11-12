import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const FootballIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2l4.1 3-1.55 4.75h-5.1L7.9 10.2z" />
    <path d="M12 3.2V7.2M4.6 9.6l3.3.6M19.4 9.6l-3.3.6M7.6 19.4l1.95-4.45M16.4 19.4l-1.95-4.45" />
  </svg>
);

export const TrophyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
    <path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 8 9.9M17 5h2.5v1.5A3.5 3.5 0 0 1 16 9.9" />
    <path d="M12 13v3.5M8.5 20.5h7M9.5 20.5c0-1.6.6-2.8 1-3.5M14.5 20.5c0-1.6-.6-2.8-1-3.5" />
  </svg>
);

export const VirtualIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l7.5 3v5.4c0 4.3-3 8.2-7.5 9.6-4.5-1.4-7.5-5.3-7.5-9.6V6z" />
    <path d="M10.2 9.6l4.6 2.4-4.6 2.4z" />
  </svg>
);

export const Pick12Icon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.2" y="4.2" width="17.6" height="12.4" rx="2.2" />
    <path d="M7.4 8.6h3M7.4 12h3M13.6 8.6h3M13.6 12h3" />
    <path d="M8 20.8l4-4.2 4 4.2" />
  </svg>
);

export const AffiliateIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="10" cy="8" r="3.4" />
    <path d="M4 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4" />
    <circle cx="17.6" cy="10.4" r="2.4" />
    <path d="M15.4 20c0-2.4 1-4 2.6-4 1.7 0 2.6 1.6 2.6 4" />
  </svg>
);

export const GridIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="6" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="18" cy="6" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="6" cy="18" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="18" cy="18" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="M15.8 15.8L20.5 20.5" />
  </svg>
);

export const RobotIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="7.5" width="16" height="11" rx="3.2" />
    <path d="M12 4v3.5" />
    <circle cx="9" cy="13" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none" />
    <path d="M9.4 16.4h5.2" />
    <path d="M2.6 12v3M21.4 12v3" />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.4" y="5" width="17.2" height="15.6" rx="2.6" />
    <path d="M3.4 10h17.2M8.4 3.4v3.2M15.6 3.4v3.2" />
    <path d="M8 14h2.4M13.6 14H16M8 17.2h2.4" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 4v16h16" />
    <path d="M7.5 14.5l3.2-3.6 2.6 2.2 4-4.6" />
  </svg>
);

export const BoltIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13.4 2.5L5 13.6h5.2L10 21.5l8.6-11.4h-5.4z" />
  </svg>
);

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.6 10.6L12 3.6l8.4 7" />
    <path d="M5.6 9.8V20h12.8V9.8" />
    <path d="M9.8 20v-5.2h4.4V20" />
  </svg>
);

export const LiveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.8" y="4.6" width="18.4" height="14.8" rx="3" />
    <path d="M10.4 9.2l4.6 2.8-4.6 2.8z" fill="currentColor" />
  </svg>
);

export const PlaneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.2 12.4l17.6-8.2-4.1 9.1 3 5.6-3.2 1.1-2.7-4.6-4.6 2.2.7 3.4-2.2.8-1.2-3.4-3.4-1.2.8-2.2 3.4.7z" />
  </svg>
);

export const TicketIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.4 8.4a2 2 0 0 0 0 7.2v3.4h17.2v-3.4a2 2 0 0 1 0-7.2V5H3.4z" />
    <path d="M9.4 5v14" strokeDasharray="2.4 2.6" />
  </svg>
);

export const SmileIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9 10h.01M15 10h.01" strokeWidth="2.6" />
    <path d="M8.6 14.4c.9 1.5 2.1 2.2 3.4 2.2s2.5-.7 3.4-2.2" />
  </svg>
);

export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.4V12l3.2 2" />
  </svg>
);

export const FlameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 2.8s4.6 3.7 4.6 8.1c0 1.9-1 3.1-2.4 3.1-1.2 0-2-.9-2-2.1 0-1.6.6-2.6.6-2.6s-3.4 2-3.4 5.6c0 1.5.6 2.7 1.6 3.4" />
    <path d="M12 21.2c-2.9 0-5-2.1-5-4.9 0-3.4 3-5.3 5-8.3 2 3 5 4.9 5 8.3 0 2.8-2.1 4.9-5 4.9z" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4 1.4 5.6 1.4 5.6H5s1.4-1.6 1.4-5.6z" />
    <path d="M10.2 18.6a2 2 0 0 0 3.6 0" />
  </svg>
);

export const WalletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="13" rx="2.6" />
    <path d="M3 10.4h18" />
    <circle cx="16.6" cy="14.6" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const GiftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.4" y="8.6" width="17.2" height="11.8" rx="2" />
    <path d="M3.4 12.8h17.2M12 8.6V20.4" />
    <path d="M12 8.6S10.6 4 8.2 4a2.2 2.2 0 0 0 0 4.6zM12 8.6S13.4 4 15.8 4a2.2 2.2 0 0 1 0 4.6z" />
  </svg>
);

export const StarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.4" width="14" height="9.6" rx="2.4" />
    <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.8 12.6l4.6 4.6L19.2 7.4" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const SignalIcon = (p: IconProps) => (
  <svg {...base({ viewBox: "0 0 18 12", ...p })}>
    <path d="M1 9.4h2.2M5.2 6.6h2.2M9.4 4h2.2M13.6 1.4h2.2" strokeWidth="2.4" />
  </svg>
);

export const WifiIcon = (p: IconProps) => (
  <svg {...base({ viewBox: "0 0 16 12", ...p })}>
    <path d="M1 4.2A10.4 10.4 0 0 1 15 4.2" />
    <path d="M3.7 7A6.6 6.6 0 0 1 12.3 7" />
    <path d="M6.4 9.7a2.9 2.9 0 0 1 3.2 0" />
    <circle cx="8" cy="11" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const BatteryIcon = (p: IconProps) => (
  <svg {...base({ viewBox: "0 0 26 13", ...p })}>
    <rect x="1" y="1.4" width="21" height="10.2" rx="2.6" strokeWidth="1.4" />
    <path d="M23.6 4.8v3.4" strokeWidth="2" />
    <rect x="3" y="3.4" width="13" height="6.2" rx="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const BasketIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M4.4 5.6h15.2M12 5.6v12.8M6.6 8.4l-2.2 9.9M17.4 8.4l2.2 9.9M9.3 4.4h5.4" />
  </svg>
);

export const VolleyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="9" r="5.4" />
    <path d="M13 13l6.4 6.4M14.6 4.6a7 7 0 0 1 5.6 9.2" />
  </svg>
);

export const TennisIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M5.2 5.2a8.6 8.6 0 0 0 0 13.6M18.8 5.2a8.6 8.6 0 0 1 0 13.6" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 6.6h15M9.6 6.6V4.4h4.8v2.2M6.4 6.6l.9 13h9.4l.9-13M10.2 10.4v6M13.8 10.4v6" />
  </svg>
);

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.2" />
    <path d="M15.6 8.4V6.2A2.2 2.2 0 0 0 13.4 4H6.2A2.2 2.2 0 0 0 4 6.2v7.2a2.2 2.2 0 0 0 2.2 2.2h2.2" />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="17.6" cy="5.8" r="2.4" />
    <circle cx="6.4" cy="12" r="2.4" />
    <circle cx="17.6" cy="18.2" r="2.4" />
    <path d="M8.5 10.8l7-3.8M8.5 13.2l7 3.8" />
  </svg>
);

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5.5 9.5l6.5 6.5 6.5-6.5" />
  </svg>
);

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.4" r="3.8" />
    <path d="M4.6 20.2c.8-3.8 3.7-5.8 7.4-5.8s6.6 2 7.4 5.8" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4.4H6.4a2 2 0 0 0-2 2v11.2a2 2 0 0 0 2 2H14M10.4 12h10M17 8.4l3.6 3.6-3.6 3.6" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.2l7.4 2.9v5.6c0 4.4-3.1 7.9-7.4 9.1-4.3-1.2-7.4-4.7-7.4-9.1V6.1z" />
    <path d="M8.8 12.2l2.2 2.2 4.2-4.4" />
  </svg>
);

export const SortIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4.6v14.8M3.8 16.2L7 19.4l3.2-3.2M17 19.4V4.6M13.8 7.8L17 4.6l3.2 3.2" />
  </svg>
);

export const CodeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.4" />
    <path d="M7.4 9.2h9.2M7.4 12.4h6.4M7.4 15.6h4" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.2M12 7.8h.01" strokeWidth="2.4" />
  </svg>
);

export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 16.8h.01" />
  </svg>
);

export const WhatsAppIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...p}>
    <circle cx="16" cy="16" r="16" fill="#25D366" />
    <path
      fill="#fff"
      d="M22.9 18.9c-.4-.2-2.2-1.1-2.5-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.4-.7.1-.3 0-.5 0-.7l-1.1-2.7c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-1 .5-.3.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.9c.2.2 2.6 4 6.3 5.6 3.1 1.3 3.7 1 4.4.9.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.1-.4-.2-.9-.4zM16 5.6A10.4 10.4 0 0 0 7.1 21.4L5.6 26.4l5.2-1.4A10.4 10.4 0 1 0 16 5.6z"
      fillOpacity="0.98"
    />
  </svg>
);

export const TelegramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...p}>
    <circle cx="16" cy="16" r="16" fill="#2AABEE" />
    <path fill="#fff" d="M7.2 15.6l15.6-6c.7-.3 1.4.2 1.1 1.4l-2.6 12.4c-.2.9-.7 1.1-1.5.7l-4-3-1.9 1.9c-.2.2-.4.4-.9.4l.3-4.1 7.4-6.7c.3-.3-.1-.4-.5-.2l-9.2 5.8-3.9-1.2c-.9-.3-.9-.9.1-1.4z" />
  </svg>
);

export const FacebookIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...p}>
    <circle cx="16" cy="16" r="16" fill="#1877F2" />
    <path fill="#fff" d="M17.6 26v-8.4h2.8l.4-3.3h-3.2v-2.1c0-.9.3-1.6 1.6-1.6H21V7.7c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4h-2.8v3.3h2.8V26z" />
  </svg>
);

export const XBrandIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...p}>
    <circle cx="16" cy="16" r="16" fill="#0F1419" />
    <path fill="#fff" d="M17.6 14.8L23.4 8h-1.4l-5 5.9L13 8H8.4l6.1 8.9L8.4 24h1.4l5.3-6.2 4.3 6.2H24zm-1.9 2.2l-.6-.9-4.9-7h2.1l4 5.7.6.9 5.2 7.4H20z" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 4l16 16M9.9 5.9A9.6 9.6 0 0 1 12 5.6C18 5.6 21.6 12 21.6 12a17 17 0 0 1-3.1 3.9M6.3 7.7A17 17 0 0 0 2.4 12S6 18.4 12 18.4c1.5 0 2.8-.4 4-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
