"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Approve or decline an access request. Approving emails the person a sign-in link. */
export async function decide(formData: FormData) {
  const id = String(formData.get("id"));
  const decision = formData.get("decision") === "approved" ? "approved" : "declined";

  const supabase = await createClient();
  // Row-level security only lets admins update requests
  const { data: request, error } = await supabase
    .from("access_requests")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", id)
    .select("email")
    .single();
  if (error || !request) redirect(`/admin?notice=${encodeURIComponent("Couldn't update that request.")}`);

  let notice = `${request.email} declined.`;
  if (decision === "approved") {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    // A plain client with no session: sends the email without touching the admin's own login
    const mailer = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
    });
    const { error: mailError } = await mailer.auth.signInWithOtp({
      email: request.email,
      options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
    });
    notice = mailError
      ? `${request.email} approved, but the email didn't send: ${mailError.message}`
      : `${request.email} approved. They've been emailed a sign-in link.`;
  }
  revalidatePath("/admin");
  redirect(`/admin?notice=${encodeURIComponent(notice)}`);
}
