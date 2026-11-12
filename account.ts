import { accountCreator } from "./client";

/** Creates only the LOGIN account. Privileges are granted separately, server-side, by a permission-checked function. */
export async function createLoginAccount(email: string, password: string): Promise<string> {
  const { data, error } = await accountCreator().auth.signUp({ email, password, options: { data: { account_type: "staff" } } });
  if (error) throw new Error(/already|registered/i.test(error.message) ? "That email already has a login account." : error.message);
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error("That email already has a login account.");
  return data.user.id;
}

export function randomPassword(len = 14): string {
  const pools = ["abcdefghijkmnpqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%*?"];
  const all = pools.join("");
  const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const out = pools.map((p) => p[rnd(p.length)]);
  while (out.length < len) out.push(all[rnd(all.length)]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
