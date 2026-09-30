"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

/** Save an opportunity to the tracker, or mark it applied (follow-up reminder in 14 days). */
export async function track(opportunityId: string, stage: "saved" | "applied"): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id,title,company_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opportunity) return { ok: false };

  const now = new Date();
  const fields = {
    stage,
    last_update_at: now.toISOString(),
    ...(stage === "applied"
      ? { applied_at: now.toISOString(), next_follow_up_at: new Date(now.getTime() + 14 * DAY).toISOString() }
      : {}),
  };

  const { data: existing } = await supabase
    .from("applications")
    .select("id,stage")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  let error;
  if (existing) {
    // Saving never moves an application backwards once it has been applied for
    if (stage === "saved" && existing.stage !== "saved") return { ok: true };
    ({ error } = await supabase.from("applications").update(fields).eq("id", existing.id));
  } else {
    ({ error } = await supabase.from("applications").insert({
      user_id: user.id,
      opportunity_id: opportunity.id,
      company_id: opportunity.company_id,
      title: opportunity.title,
      ...fields,
    }));
  }
  if (error) return { ok: false };

  revalidatePath("/");
  revalidatePath("/tracker");
  return { ok: true };
}
