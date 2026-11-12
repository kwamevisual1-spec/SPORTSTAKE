/**
 * Single source of truth for the account currency.
 *
 * A player picks GHS or NGN once, at registration. It is stored on their profile in the
 * database (and locked there), and every amount on the site is shown in that currency only.
 */
export type CurrencyCode = "GHS" | "NGN";

export type CurrencyInfo = {
  code: CurrencyCode;
  /** ISO country code shown in the Country / Region picker */
  iso: string;
  symbol: string;
  name: string;
  country: string;
  dial: string;
  /** how many digits follow the country code (without the leading 0) */
  nationalLength: number;
  example: string;
  /** limits & promo amounts are defined in GHS and multiplied by this for other currencies */
  scale: number;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  GHS: { code: "GHS", iso: "GH", symbol: "GH₵", name: "Ghanaian Cedi", country: "Ghana", dial: "+233", nationalLength: 9, example: "24 123 4567", scale: 1 },
  NGN: { code: "NGN", iso: "NG", symbol: "₦", name: "Nigerian Naira", country: "Nigeria", dial: "+234", nationalLength: 10, example: "803 123 4567", scale: 100 },
};

export const CURRENCY_CODES: CurrencyCode[] = ["GHS", "NGN"];

export const isCurrency = (v: unknown): v is CurrencyCode => v === "GHS" || v === "NGN";

let current: CurrencyCode = "GHS";

export function setCurrency(c: CurrencyCode) {
  current = c;
}

/** "GHS" | "NGN" */
export const cur = () => current;
/** "GH₵" | "₦" */
export const sym = () => CURRENCIES[current].symbol;
export const scale = () => CURRENCIES[current].scale;
/** Convert an amount written in GHS terms into the account currency. */
export const sc = (n: number) => n * scale();
/** 8,623 */
export const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
