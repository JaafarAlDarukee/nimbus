/**
 * Paid access (owner, 17 Oct 2026): 2 days free with limits, then £5 once for lifetime access.
 * Mirrored in radar/notify/personal.py (`access_state`) for Telegram: change both together.
 */

/** Nimbus is private (owner, 18 Oct: "make it for me only, no payment, no nothing"): only admins get in;
 *  no sign-ups, trial or payments. Set to false (here and radar/notify/personal.py) to open it again. */
export const PRIVATE = true;

export const PRICE = "£5";
export const TRIAL_JOBS = 5;
export const TRIAL_CVS = 2;

export type Access = "paid" | "trial" | "locked";

/** What the free trial and the £5 include (pricing page and /pay). Only things Nimbus really does. */
export const TRIAL_FEATURES = [
  `${TRIAL_JOBS} roles that fit your degree`,
  `${TRIAL_CVS} CVs checked against a job advert`,
  `${TRIAL_JOBS} Telegram alerts`,
];
export const PAID_FEATURES = [
  "Every placement, internship, graduate job, apprenticeship and event in your field, across the UK and Ireland",
  "A Telegram message the moment one opens: Nimbus checks 3,200+ employers' own careers sites every 15 minutes",
  "Finds from Gradcracker, Bright Network, LinkedIn and more, in the same place, each role once",
  "Unlimited CV checks against each advert, like the screening software employers use",
  "Who to contact on LinkedIn for each role: the recruiter, current interns, people from your uni",
  "Your tracker, calendar and deadline reminders",
];

export type AccessFields = { is_admin?: boolean | null; paid_at?: string | null; trial_ends_at?: string | null };

export function accessState(p: AccessFields | null | undefined, now = Date.now()): Access {
  if (!p) return "locked";
  if (p.is_admin || p.paid_at) return "paid";
  if (p.trial_ends_at && new Date(p.trial_ends_at).getTime() > now) return "trial";
  return "locked";
}

/** Hours until a time (negative once it has passed). */
export function hoursLeft(until: string | null | undefined, now = Date.now()): number {
  return until ? (new Date(until).getTime() - now) / 3_600_000 : 0;
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
