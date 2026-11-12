import { cleanAmount, money, parseAmount } from "../lib/format";
import { cur, sc } from "../lib/currency";
import { cn } from "../utils/cn";
import type { Game } from "./catalog";

export type GameWallet = {
  balance: number;
  demo: boolean;
  debit: (amount: number) => boolean;
  credit: (amount: number, note?: string) => void;
  fail: (msg: string) => void;
};

export type EngineProps = { game: Game; wallet: GameWallet };

/** Props for full-screen branded games (Aviator, Mini Mines). */
export type FullGameProps = {
  game: Game;
  wallet: GameWallet;
  playerName: string;
  /** returns false when the switch was refused */
  setMode: (mode: "demo" | "real") => void;
  onExit: () => void;
  onDeposit: () => void;
};

export function StakeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const n = parseAmount(value);
  return (
    <div className={cn("rounded-2xl bg-white/[0.07] p-2.5", disabled && "pointer-events-none opacity-50")}>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(String(Math.max(sc(1), Math.round((n / 2) * 100) / 100)))} className="h-9 w-10 rounded-lg bg-white/10 text-[12px] font-black text-white">
          ½
        </button>
        <div className="flex flex-1 items-center rounded-lg bg-black/30 px-3">
          <span className="text-[11px] font-bold text-white/50">{cur()}</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(cleanAmount(e.target.value))}
            className="w-full bg-transparent px-2 py-2 text-right text-[16px] font-black text-white outline-none"
          />
        </div>
        <button onClick={() => onChange(String(Math.min(sc(10000), Math.round(n * 2 * 100) / 100 || sc(1))))} className="h-9 w-10 rounded-lg bg-white/10 text-[12px] font-black text-white">
          2×
        </button>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {[1, 5, 10, 50, 100].map(sc).map((q) => (
          <button key={q} onClick={() => onChange(String(q))} className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white/80">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  tone = "green",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "green" | "orange" | "gray";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl py-3.5 text-[15px] font-black tracking-tight text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50",
        tone === "green" && "bg-gradient-to-b from-[#22c55e] to-[#15803d]",
        tone === "orange" && "bg-gradient-to-b from-[#fb923c] to-[#ea580c]",
        tone === "gray" && "bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

export function placeStake(wallet: GameWallet, value: string): number | null {
  const amount = parseAmount(value);
  if (amount < sc(1)) {
    wallet.fail(`Minimum stake is ${cur()} ${money(sc(1))}`);
    return null;
  }
  if (amount > sc(10_000)) {
    wallet.fail(`Maximum stake is ${cur()} ${money(sc(10_000))}`);
    return null;
  }
  if (!wallet.debit(amount)) {
    wallet.fail(wallet.demo ? "Not enough demo balance – reset it from the top bar" : "Insufficient balance – please deposit");
    return null;
  }
  return amount;
}
