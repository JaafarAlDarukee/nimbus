/**
 * Paid access (owner, 17 Oct 2026): 2 days free with limits, then £5 once for lifetime access.
 * Mirrored in radar/notify/personal.py (`access_state`) for Telegram: change both together.
 */

export const PRICE = "£5";
export const TRIAL_JOBS = 5;
export const TRIAL_CVS = 2;

export type Access = "paid" | "trial" | "locked";

export type AccessFields = { is_admin?: boolean | null; paid_at?: string | null; trial_ends_at?: string | null };

export function accessState(p: AccessFields | null | undefined, now = Date.now()): Access {
  if (!p) return "locked";
  if (p.is_admin || p.paid_at) return "paid";
  if (p.trial_ends_at && new Date(p.trial_ends_at).getTime() > now) return "trial";
  return "locked";
}

/** "1 day 4 hours", "3 hours", "less than an hour" */
export function timeLeft(until: string | null | undefined, now = Date.now()): string {
  const ms = until ? new Date(until).getTime() - now : 0;
  if (ms <= 0) return "no time";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "less than an hour";
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (!days) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${days} day${days > 1 ? "s" : ""}${rest ? ` ${rest} hour${rest > 1 ? "s" : ""}` : ""}`;
}

/** The owner's Stripe payment link, with who is paying so the webhook can unlock them. */
export function payLink(base: string, userId: string, email?: string | null): string | null {
  if (!/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(base.trim())) return null;
  const url = new URL(base.trim());
  url.searchParams.set("client_reference_id", userId);
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}
