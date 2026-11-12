import { useEffect, useState } from "react";
import { ghs } from "../lib/format";
import { useStore } from "../store";
import { cn } from "../utils/cn";
import { ChevronLeft } from "../components/Icons";
import { AuthSheet, WalletSheet } from "../components/Sheets";
import { GAME_BY_ID, STUDIO } from "./catalog";
import type { GameWallet } from "./common";
import { Aviator } from "./Aviator";
import { MiniMines } from "./MiniMines";
import { Slots } from "./Slots";
import { Dice, Penalty, Wheel } from "./Instant";
import { CrashVariants } from "./CrashVariants";
import { Cascade } from "./Cascade";
import { ChickenRoad, PlinkoStorm, ScratchGold, TowerRush } from "./Arcade";
import { CoinFlip, HiLoRoyale, KenoRoyal, Limbo } from "./Numbers";
import { BlackjackClassic, MiniRoulette } from "./Cards";

export function GameModal({ gameId }: { gameId: string }) {
  const { close, user, demoBalance, debit, credit, notify, resetDemo } = useStore();
  const game = GAME_BY_ID.get(gameId);
  const [mode, setModeState] = useState<"real" | "demo">(user ? "real" : "demo");
  const [sub, setSub] = useState<null | "deposit" | "login">(null);

  // after logging in from inside a game, switch straight to real-money play
  useEffect(() => {
    if (sub === "login" && user) {
      setSub(null);
      setModeState("real");
      notify("Real money mode enabled", "info");
    }
  }, [sub, user, notify]);

  if (!game) return null;

  const demo = mode === "demo" || !user;
  const wallet: GameWallet = {
    balance: demo ? demoBalance : (user?.balance ?? 0),
    demo,
    debit: (a) => debit(a, `${game.name} stake`, demo),
    credit: (a, note) => (note === "reset" ? resetDemo() : credit(a, note ?? `${game.name} win`, demo)),
    fail: (msg) => notify(msg, "err"),
  };

  const setMode = (m: "demo" | "real") => {
    if (m === "real" && !user) {
      notify("Log in to play with real money", "info");
      setSub("login");
      return;
    }
    setModeState(m);
  };
  const onDeposit = () => setSub(user ? "deposit" : "login");
  const playerName = user ? user.name.split(" ")[0] : "Guest";

  const subSheets = (
    <>
      {sub === "deposit" && user ? <WalletSheet kind="deposit" onClose={() => setSub(null)} /> : null}
      {sub === "login" && !user ? <AuthSheet mode="login" onClose={() => setSub(null)} /> : null}
    </>
  );

  if (game.engine === "aviator" || game.engine === "mines") {
    const Full = game.engine === "aviator" ? Aviator : MiniMines;
    return (
      <>
        <div className="absolute inset-0 z-[70] bg-black md:bg-black/85 md:p-4">
          <div className="relative mx-auto h-full w-full max-w-[560px] overflow-hidden md:rounded-3xl md:ring-1 md:ring-white/10">
            <Full key={mode} game={game} wallet={wallet} playerName={playerName} setMode={setMode} onExit={close} onDeposit={onDeposit} />
          </div>
        </div>
        {subSheets}
      </>
    );
  }

  const Engine = {
    slots: Slots,
    dice: Dice,
    wheel: Wheel,
    penalty: Penalty,
    crash: CrashVariants,
    cascade: Cascade,
    chicken: ChickenRoad,
    tower: TowerRush,
    plinko: PlinkoStorm,
    scratch: ScratchGold,
    keno: KenoRoyal,
    limbo: Limbo,
    hilo: HiLoRoyale,
    coinflip: CoinFlip,
    blackjack: BlackjackClassic,
    roulette: MiniRoulette,
  }[game.engine];

  return (
    <>
      <div className="absolute inset-0 z-[70] bg-black md:bg-black/85 md:p-4">
      <div className="relative mx-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden bg-[#0b1020] text-white md:rounded-3xl md:ring-1 md:ring-white/10">
        <div className="relative flex shrink-0 items-center gap-2.5 overflow-hidden border-b border-white/10 px-2 py-2.5">
          <img src={game.art} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-25 blur-xl" />
          <button onClick={close} aria-label="Close game" className="relative grid h-9 w-9 place-items-center rounded-full bg-black/40">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.6} />
          </button>
          <img src={game.art} alt="" className="relative h-10 w-10 rounded-xl object-cover ring-1 ring-white/20" />
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[15px] font-black tracking-tight">{game.name}</p>
            <p className="truncate text-[10px] font-bold text-white/55">
              {STUDIO} · RTP {game.rtp}%
            </p>
          </div>
          <div className="relative flex rounded-full bg-black/45 p-0.5 text-[10.5px] font-black">
            {(["demo", "real"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded-full px-2.5 py-1 capitalize", (m === "demo") === demo ? "bg-white text-[#0b1020]" : "text-white/60")}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between bg-black/30 px-3 py-2">
          <span className="text-[11px] font-bold text-white/50">{demo ? "Demo balance" : "Balance"}</span>
          <span className="flex items-center gap-2">
            <span className="text-[14px] font-black tabular-nums">{ghs(wallet.balance)}</span>
            {demo ? (
              <button onClick={resetDemo} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black">
                Reset
              </button>
            ) : (
              <button onClick={onDeposit} className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black">
                + Deposit
              </button>
            )}
          </span>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-3 pb-8">
          <Engine key={`${game.id}-${mode}`} game={game} wallet={wallet} />
          <p className="mt-4 text-center text-[10.5px] font-semibold text-white/35">{game.blurb} · 18+ · Play responsibly</p>
        </div>
      </div>
      </div>
      {subSheets}
    </>
  );
}
