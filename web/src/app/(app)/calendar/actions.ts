"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["deadline", "online_test", "interview"] as const;

/** "Remind me the day before": stored as a calendar event with remind on, linked to the application. */
export async function setReminder(event: {
  applicationId: string;
  kind: (typeof KINDS)[number];
  title: string;
  startsAt: string;
  on: boolean;
}): Promise<{ ok: boolean }> {
  if (!KINDS.includes(event.kind)) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase.from("calendar_events").delete().eq("application_id", event.applicationId).eq("kind", event.kind);
  if (event.on) {
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      application_id: event.applicationId,
      kind: event.kind,
      title: event.title.slice(0, 200),
      starts_at: event.startsAt,
      remind: true,
    });
    if (error) return { ok: false };
  }
  revalidatePath("/calendar");
  return { ok: true };
}
