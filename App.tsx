import { useEffect, useRef, useState } from "react";
import { StoreProvider, useStore, type Screen } from "./store";
import { Header } from "./components/Header";
import { QuickNav } from "./components/QuickNav";
import { HeroBanner } from "./components/HeroBanner";
import { QuickLinks } from "./components/QuickLinks";
import { TopMatches } from "./components/TopMatches";
import { Jackpots } from "./components/Jackpots";
import { HomeLive } from "./components/HomeLive";
import { SportsbookScreen } from "./components/SportsbookScreen";
import { CasinoLobby } from "./components/CasinoLobby";
import { CasinoSpotlight } from "./components/CasinoSpotlight";
import { SupportWidget } from "./components/SupportWidget";
import { BottomNav } from "./components/BottomNav";
import { BetslipButton, BetslipPanel, BetslipSheet } from "./components/Betslip";
import { WinModal } from "./components/WinModal";
import { Sidebar } from "./components/Sidebar";
import { SiteFooter } from "./components/SiteFooter";
import { Logo } from "./components/Header";
import { ClockProvider, useDesktop } from "./lib/clock";
import { AllSportsSheet, AuthSheet, LoadCodeSheet, MatchSheet, PromoSheet, WalletSheet } from "./components/Sheets";
import { GameModal } from "./games/GameModal";
import { MeScreen, MyBetsScreen } from "./screens/Account";
import { AffiliateScreen, JackpotScreen, Pick12Screen, PromotionsScreen } from "./screens/Games";
import { CheckIcon, CloseIcon, InfoIcon, LockIcon } from "./components/Icons";
import { cn } from "./utils/cn";
import AdminApp from "./staff/AdminApp";
import AgentApp from "./staff/AgentApp";
import { Recover } from "./staff/Gate";
import { goToSite } from "./staff/client";

const PAYMENTS = ["MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Visa / Mastercard"];

function Home() {
  const { open, user } = useStore();
  return (
    <div className="pb-28 lg:pb-6">
      <QuickNav />
      <HeroBanner />
      <QuickLinks />
      <CasinoSpotlight />
      <TopMatches />
      <Jackpots />
      <HomeLive />
      <section className="bg-white px-3 pb-4 pt-3 md:mx-3 md:mt-3 md:rounded-3xl">
        <div className="flex items-center gap-1.5">
          <LockIcon className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.2} />
          <h3 className="text-[12px] font-black tracking-tight text-brand-ink">Fast &amp; secure payments</h3>
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {PAYMENTS.map((p) => (
            <button
              key={p}
              onClick={() => (user ? open({ type: "deposit", method: p }) : open({ type: "auth", mode: "register" }))}
              className="shrink-0 rounded-lg border border-black/[0.08] bg-black/[0.02] px-2.5 py-1.5 text-[10.5px] font-extrabold text-brand-ink/65 active:bg-brand-green-soft"
            >
              {p}
            </button>
          ))}
        </div>

      </section>
      <SiteFooter className="mt-3 md:mx-3 md:rounded-3xl" />
    </div>
  );
}

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case "home":
      return <Home />;
    case "book":
      return <SportsbookScreen screen={screen} />;
    case "casino":
      return <CasinoLobby />;
    case "jackpot":
      return <JackpotScreen />;
    case "pick12":
      return <Pick12Screen />;
    case "affiliate":
      return <AffiliateScreen />;
    case "promotions":
      return <PromotionsScreen />;
    case "mybets":
      return <MyBetsScreen />;
    case "me":
      return <MeScreen />;
  }
}

function Overlays() {
  const { overlay, user } = useStore();
  if (!overlay) return null;
  switch (overlay.type) {
    case "match":
      return <MatchSheet matchId={overlay.matchId} />;
    case "auth":
      return <AuthSheet key={overlay.mode} mode={overlay.mode} />;
    case "deposit":
      return user ? <WalletSheet kind="deposit" method={overlay.method} /> : <AuthSheet mode="login" />;
    case "withdraw":
      return user ? <WalletSheet kind="withdraw" /> : <AuthSheet mode="login" />;
    case "game":
      return <GameModal gameId={overlay.gameId} />;
    case "allSports":
      return <AllSportsSheet />;
    case "loadCode":
      return <LoadCodeSheet />;
    case "promo":
      return <PromoSheet id={overlay.id} />;
  }
}

function ToastView() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-[95] flex justify-center px-4">
      <div
        key={toast.id}
        className={cn(
          "animate-pop flex max-w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[12px] font-bold text-white shadow-2xl",
          toast.tone === "err" ? "bg-[#b42318]" : toast.tone === "info" ? "bg-[#1f2937]" : "bg-brand-ink",
        )}
      >
        {toast.tone === "err" ? (
          <CloseIcon className="h-4 w-4 shrink-0" strokeWidth={3} />
        ) : toast.tone === "info" ? (
          <InfoIcon className="h-4 w-4 shrink-0" strokeWidth={2.4} />
        ) : (
          <CheckIcon className="h-4 w-4 shrink-0 text-brand-lime" strokeWidth={3} />
        )}
        <span className="min-w-0">{toast.msg}</span>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid h-dvh w-full place-items-center bg-brand-yellow">
      <div className="animate-pulse">
        <Logo onClick={() => undefined} />
      </div>
    </div>
  );
}

function Shell() {
  const { user, authReady } = useStore();
  if (!authReady) return <Splash />;
  // every amount on screen uses the account currency – remount cleanly if it ever changes
  return <ShellInner key={user?.currency ?? "GHS"} />;
}

function ShellInner() {
  const { screen, lastWin, dismissWin } = useStore();
  const desktop = useDesktop();
  const mainRef = useRef<HTMLElement>(null);
  const screenKey = JSON.stringify(screen);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [screenKey]);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#f4f6f8]">
      <Header />
      <div className="flex min-h-0 flex-1">
        {desktop ? <Sidebar /> : null}
        <main ref={mainRef} className="no-scrollbar relative min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div key={screenKey} className={cn("animate-float-up mx-auto min-h-full w-full lg:px-4 lg:py-4", screen.name === "casino" ? "max-w-[1500px]" : "max-w-[940px]")}>
            <ScreenView screen={screen} />
          </div>
        </main>
        {desktop ? (
          <aside className="relative w-[360px] shrink-0 border-l border-black/[0.06] xl:w-[390px]">
            <BetslipPanel variant="side" />
          </aside>
        ) : null}
      </div>
      <BetslipButton />
      <BottomNav />
      <BetslipSheet />
      <Overlays />
      {lastWin ? <WinModal bet={lastWin} onClose={dismissWin} /> : null}
      <ToastView />
      <SupportWidget />
    </div>
  );
}

function CustomerApp() {
  return (
    <ClockProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ClockProvider>
  );
}

/**
 * Staff portals live at  /#/admin  and  /#/agent  – completely separate from the customer site.
 * Everything below only decides WHICH app to show; the customer app above is unchanged.
 */
const detectPortal = (): "admin" | "agent" | "reset" | null => {
  const h = window.location.hash;
  if (h.startsWith("#/admin")) return "admin";
  if (h.startsWith("#/agent")) return "agent";
  const s = new URLSearchParams(window.location.search).get("staff");
  if ((s === "admin" || s === "agent") && h.includes("access_token")) return s;
  // password-reset link (customers, agents and administrators all use the same page)
  if (s === "reset" && h.includes("access_token")) return "reset";
  return null;
};

export default function App() {
  const [portal, setPortal] = useState(detectPortal);
  const [recovering] = useState(() => Boolean(new URLSearchParams(window.location.search).get("staff")) && window.location.hash.includes("type=recovery"));
  useEffect(() => {
    const f = () => setPortal(detectPortal());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  if (portal === "reset") return <Recover portal="site" finished={() => goToSite("reset-done")} />;
  if (portal === "admin") return <AdminApp recovering={recovering} />;
  if (portal === "agent") return <AgentApp recovering={recovering} />;
  return <CustomerApp />;
}
