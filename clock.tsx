import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** One shared 1-second clock for every live clock, score and odds on screen. */
const ClockContext = createContext<number>(Date.now());

export function ClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export const useClock = () => useContext(ClockContext);

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

/** ≥1024px: desktop layout with sidebar + docked betslip. */
export const useDesktop = () => useMedia("(min-width: 1024px)");
