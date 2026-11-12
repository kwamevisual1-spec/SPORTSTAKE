import { CATALOG, OUTCOME_BY_KEY } from "./markets";

/**
 * Booking codes are self-contained: every selection is packed into the code itself
 * (1 salt + 2 nonce + 2 characters per selection + 1 checksum – 6 characters for a single). That means a code shared over
 * WhatsApp works on any phone or browser without a server lookup – exactly like the
 * "load code" flow on SportyBet / BangBet.
 *
 * When a backend is connected this can be swapped for server-issued short codes.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // 56 – no 0/O/1/l/I
const N = ALPHABET.length;
const SPACE = N * N;

export function encodeBooking(keys: string[]): string {
  const idx = keys
    .map((k) => OUTCOME_BY_KEY.get(k)?.index)
    .filter((v): v is number => typeof v === "number");
  const salt = Math.floor(Math.random() * N);
  let code = ALPHABET[salt] + ALPHABET[Math.floor(Math.random() * N)] + ALPHABET[Math.floor(Math.random() * N)];
  idx.forEach((v, i) => {
    const w = (v + salt * 53 + i * 97) % SPACE;
    code += ALPHABET[Math.floor(w / N)] + ALPHABET[w % N];
  });
  const sum = idx.reduce((a, b) => a + b, salt + idx.length * 7);
  return code + ALPHABET[sum % N];
}

export type DecodeResult = { ok: true; keys: string[] } | { ok: false; error: string };

export function decodeBooking(raw: string): DecodeResult {
  const code = raw.trim().replace(/\s+/g, "");
  const invalid: DecodeResult = { ok: false, error: "Invalid booking code. Check the code and try again (codes are case-sensitive)." };
  if (code.length < 6 || code.length % 2 !== 0) return invalid;
  for (const ch of code) if (ALPHABET.indexOf(ch) < 0) return invalid;

  const salt = ALPHABET.indexOf(code[0]);
  const body = code.slice(3, -1);
  const idx: number[] = [];
  for (let i = 0; i < body.length / 2; i++) {
    const w = ALPHABET.indexOf(body[i * 2]) * N + ALPHABET.indexOf(body[i * 2 + 1]);
    const v = (((w - salt * 53 - i * 97) % SPACE) + SPACE) % SPACE;
    if (v >= CATALOG.length) return invalid;
    idx.push(v);
  }
  const sum = idx.reduce((a, b) => a + b, salt + idx.length * 7);
  if (ALPHABET[sum % N] !== code[code.length - 1]) return invalid;

  const keys = idx.map((v) => CATALOG[v].key);
  const matches = new Set(idx.map((v) => CATALOG[v].matchId));
  if (matches.size !== keys.length) return invalid;
  return { ok: true, keys };
}
