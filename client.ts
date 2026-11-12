import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://imuiwipqsbjnwncdtxww.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_Fw_7X9GZPQGXj4UHj6iT5w_goYGj2XA";

/**
 * Staff (admin + agent) sessions live in their OWN storage key, completely separate from the
 * customer site. Logging in to the admin portal never logs you in as a customer and vice-versa.
 */
export const staff = createClient(URL, KEY, {
  auth: { storageKey: "ss-staff-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Throw-away client used only to create a new login account (never stores a session). */
export const accountCreator = () =>
  createClient(URL, KEY, { auth: { storageKey: "ss-account-creator", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export async function rpc<T = Row>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await staff.rpc(fn, args);
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
}

const MESSAGES: Record<string, string> = {
  mfa_required: "Two-factor authentication is required. Please sign out and sign in again.",
  forbidden: "You do not have permission to do this.",
  not_authenticated: "Your session has expired. Please sign in again.",
  reason_required: "Please give a reason (at least 5 characters).",
  reason_required_min_10_chars: "Please give a clear reason (at least 10 characters).",
  user_not_found: "Customer not found.",
  agent_not_found: "Agent not found.",
  username_taken: "That username is already used by another agent.",
  code_taken: "That referral code is already used.",
  bad_code: "Referral code must be 4–16 letters/numbers.",
  bad_username: "Username must be 3–24 characters: lowercase letters, numbers and underscore.",
  bad_rate: "Commission rate must be between 0 and 100.",
  missing_fields: "Please fill in all the required fields.",
  email_mismatch: "The email does not match the login account that was created.",
  auth_user_not_new: "That login account is too old to be converted. Create a fresh one.",
  already_staff: "That login account is already staff.",
  account_has_activity: "That login account already has customer activity.",
  event_already_settled: "This event has already been settled.",
  event_not_editable: "This event can no longer be edited.",
  event_has_bets: "This event has bets, so it cannot be deleted.",
  bad_price: "Odds must be between 1.01 and 1000.",
  bad_score: "Enter a valid score.",
  not_pending: "This item has already been reviewed.",
  not_actionable: "This item can no longer be changed.",
  must_be_approved_first: "Approve it first, then mark it as paid.",
  payout_reference_required: "Enter the payment transaction reference.",
  second_approver_required: "A DIFFERENT administrator must give the second approval.",
  awaiting_second_approver: "First approval recorded. A second administrator must approve.",
  cannot_modify_super_admin: "The Super Admin account cannot be changed here.",
  bad_permission: "That permission cannot be assigned.",
  bad_role: "Choose a valid role.",
  already_granted: "This customer has already received this promotion.",
  above_promotion_max: "That amount is above the promotion's maximum.",
  promotion_budget_exhausted: "This promotion's budget is used up.",
  promotion_not_active: "This promotion is not active.",
  promotion_outside_dates: "This promotion is outside its start/end dates.",
  settled_bet_locked: "Settled bets are locked. Use an authorised correction.",
  bet_still_open_use_settlement: "This bet is still open – settle the event instead.",
  period_too_long: "Choose a period of 400 days or less.",
  bad_period: "Choose a valid period.",
  no_payout_details: "The agent has not submitted payment details yet.",
  insufficient_funds: "The customer's wallet cannot cover this adjustment.",
  bad_stake_limits: "Check the limits: minimum must be above 0 and maximum above minimum.",
  payout_details_not_approved: "Your payment details must be approved before you can withdraw.",
  insufficient_commission_balance: "That is more than your available commission balance.",
  below_minimum_withdrawal: "That is below the minimum withdrawal amount.",
  agent_not_active: "Your agent account is not active.",
  not_chargeable: "Only a succeeded deposit can be charged back.",
};

export function errText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const code = raw.split(":")[0].trim();
  if (MESSAGES[code]) return MESSAGES[code];
  if (/permission denied/i.test(raw)) return "You do not have permission to do this.";
  if (/failed to fetch|network/i.test(raw)) return "Network problem – check your connection and try again.";
  return raw.replace(/_/g, " ") || "Something went wrong.";
}

/** Branded agent referral link: /sportstake/partner/<CODE> */
export const siteLink = (code: string) => `${window.location.origin}${window.location.pathname}sportstake/partner/${encodeURIComponent(String(code).toUpperCase())}`;
/** Everybody (customers, agents, administrators) signs in with the normal Log in button on the website. */
export const portalLink = (portal: "admin" | "agent" = "agent") => `${window.location.origin}${window.location.pathname}${portal === "agent" ? "sportstake/subadmin" : "sportstake/admin"}`;

/** Leave a staff dashboard and show the betting website again (optionally opening the login form). */
export function goToSite(after?: "login" | "signedout" | "reset-done") {
  if (after) sessionStorage.setItem("ss-after-staff", after);
  window.history.replaceState(null, "", window.location.pathname);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
