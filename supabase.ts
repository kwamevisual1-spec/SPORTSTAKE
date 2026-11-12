import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client. The URL and the *publishable* key are public by design – they are
 * safe to ship in the browser because Row Level Security protects the data.
 * NEVER put the `secret` / `service_role` key in this project.
 */
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://imuiwipqsbjnwncdtxww.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_Fw_7X9GZPQGXj4UHj6iT5w_goYGj2XA";

export const supabase = createClient(URL, KEY, {
  // detectSessionInUrl lets the "reset password" email link sign the player in
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !new URLSearchParams(window.location.search).get("staff") },
});

/**
 * A throw-away client used ONLY to check the password and find out who is signing in
 * (customer, agent or administrator). It never stores the session and never refreshes it, so the
 * session can be handed safely to the right part of the site afterwards.
 */
export const loginProbe = () =>
  createClient(URL, KEY, { auth: { storageKey: "ss-login-probe", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

export type Role = "admin" | "agent" | "customer";

/** Works with any signed-in client. Administrators (even suspended ones) → "admin", agents → "agent". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function roleOf(client: any): Promise<Role> {
  try {
    const [a, g] = await Promise.all([client.rpc("admin_me"), client.rpc("agent_me")]);
    if (a?.data && a.data.status) return "admin";
    if (g?.data && g.data.is_agent) return "agent";
  } catch {
    /* functions not installed yet → treat as customer */
  }
  return "customer";
}

export function authMessage(error: { message?: string; status?: number; code?: string } | null): string {
  const m = (error?.message ?? "").toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered") || error?.code === "user_already_exists")
    return "An account with this email already exists. Log in instead.";
  if (m.includes("invalid login") || error?.code === "invalid_credentials") return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first – open the link we sent you, then log in.";
  if (m.includes("rate limit") || error?.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("database error")) return "We could not create your account. This phone number or email may already be registered.";
  if (m.includes("same password")) return "Choose a password different from your current one.";
  if (m.includes("password")) return "Password is too weak. Use at least 8 characters.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Enter a valid email address.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Network problem – check your connection and try again.";
  if (m.includes("signups not allowed")) return "Sign-ups are currently disabled.";
  return error?.message ?? "Something went wrong. Please try again.";
}
