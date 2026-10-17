// Stripe calls this when someone pays for Nimbus (a webhook). It checks the Stripe-Signature
// header with the signing secret, then marks the account as paid for life and records the payment.
// The Pay button on /pay adds the account id (client_reference_id) and email to the Stripe link,
// so we know who paid. Deployed without Supabase's JWT check: the signature is the proof.
// Logs never include names, emails or payment details.

import { createClient } from "npm:@supabase/supabase-js@2";

const SECRET = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const TOLERANCE_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Stripe signs `${timestamp}.${body}` with HMAC-SHA256; the header is "t=...,v1=...,v1=...". */
async function verified(body: string, header: string | null): Promise<boolean> {
  if (!SECRET || !header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !signatures.length || Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return signatures.some((s) => sameText(s, expected));
}

/** Someone who paid through the plain link (not signed in) is matched by the email they typed. */
async function userByEmail(email: string | undefined): Promise<string | null> {
  if (!email) return null;
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) return null;
    const user = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

type Session = {
  id: string;
  payment_status: string;
  client_reference_id: string | null;
  amount_total: number | null;
  currency: string | null;
  customer_details?: { email?: string } | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const body = await req.text();
  if (!(await verified(body, req.headers.get("stripe-signature")))) {
    console.error("Rejected a request with a missing or wrong Stripe signature");
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(body) as { type: string; data: { object: Session } };
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return new Response("ignored");
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return new Response("not paid yet");

  const ref = session.client_reference_id ?? "";
  const userId = UUID.test(ref) ? ref : await userByEmail(session.customer_details?.email);
  if (!userId) {
    // Stripe retries on errors; this one won't fix itself, so answer 200 and fix it by hand in Admin.
    console.error("A payment arrived that matches no Nimbus account: mark it paid by hand in Admin");
    return new Response("no matching account");
  }

  const { error: paidError } = await db.from("profiles").update({ paid_at: new Date().toISOString() }).eq("id", userId).is("paid_at", null);
  if (paidError) {
    console.error(`Couldn't mark the account paid: ${paidError.message}`);
    return new Response("try again", { status: 500 });
  }
  const { error: payError } = await db.from("payments").upsert(
    { user_id: userId, amount_pence: session.amount_total ?? 0, currency: session.currency ?? "gbp", stripe_session: session.id },
    { onConflict: "stripe_session", ignoreDuplicates: true },
  );
  if (payError) console.error(`Couldn't record the payment: ${payError.message}`);
  console.log("Payment recorded");
  return new Response("ok");
});
