"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGE_GROUPS, mainStageOf, parseDue } from "@/lib/tracker";

const DAY = 86_400_000;
const ALL_STAGES: string[] = STAGE_GROUPS.flatMap((g) => [...g.stages]);

/** Move an application to another stage. Moving to Applied starts the 14-day follow-up clock. */
export async function setStage(id: string, stage: string): Promise<{ ok: boolean }> {
  if (!ALL_STAGES.includes(stage)) return { ok: false };
  const supabase = await createClient();
  const { data: row } = await supabase.from("applications").select("applied_at").eq("id", id).maybeSingle();
  if (!row) return { ok: false };

  const now = new Date();
  const { error } = await supabase
    .from("applications")
    .update({
      stage,
      last_update_at: now.toISOString(),
      ...(stage === "applied" && !row.applied_at
        ? { applied_at: now.toISOString(), next_follow_up_at: new Date(now.getTime() + 14 * DAY).toISOString() }
        : {}),
    })
    .eq("id", id);
  if (error) return { ok: false };
  revalidatePath("/tracker");
  revalidatePath("/calendar");
  return { ok: true };
}

/** "New" in the tracker: a role found anywhere, added by hand. */
export async function addApplication(form: {
  role: string;
  company: string;
  group: string;
  next: string;
  due: string;
}): Promise<{ ok: boolean; error?: string }> {
  const role = form.role.trim().slice(0, 200);
  const company = form.company.trim().slice(0, 120);
  if (!role || !company) return { ok: false, error: "Add the role and the company." };
  const due = form.due.trim() ? parseDue(form.due) : null;
  if (form.due.trim() && !due) return { ok: false, error: "Write the due date like 12 Oct." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again." };

  const stage = mainStageOf(form.group);
  const now = new Date();
  const applied = stage !== "saved";
  const { error } = await supabase.from("applications").insert({
    user_id: user.id,
    title: role,
    company_name: company,
    stage,
    next_step: form.next.trim().slice(0, 120) || null,
    due_on: due,
    applied_at: applied ? now.toISOString() : null,
    next_follow_up_at: stage === "applied" ? new Date(now.getTime() + 14 * DAY).toISOString() : null,
  });
  if (error) return { ok: false, error: "Couldn't save it. Try again." };
  revalidatePath("/tracker");
  revalidatePath("/calendar");
  return { ok: true };
}
