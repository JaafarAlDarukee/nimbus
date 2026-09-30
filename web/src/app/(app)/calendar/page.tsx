import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { createClient } from "@/lib/supabase/server";
import { groupOf } from "@/lib/tracker";

type Application = {
  id: string;
  stage: string;
  title: string | null;
  company_name: string | null;
  applied_at: string | null;
  next_step: string | null;
  due_on: string | null;
  opportunity: { title: string; company_name: string; closes_at: string | null } | null;
};

const TZ = "Europe/London";

export default async function CalendarPage() {
  return <CalendarView {...await loadEvents()} />;
}

async function loadEvents(): Promise<React.ComponentProps<typeof CalendarView>> {
  const supabase = await createClient();
  const [{ data: apps }, { data: reminders }] = await Promise.all([
    supabase
      .from("applications")
      .select("id,stage,title,company_name,applied_at,next_step,due_on,opportunity:opportunities(title,company_name,closes_at)"),
    supabase.from("calendar_events").select("application_id,kind").eq("remind", true),
  ]);

  const reminded = new Set((reminders ?? []).map((r) => `${r.application_id}:${r.kind}`));
  const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
  const events: CalendarEvent[] = [];

  for (const a of (apps ?? []) as unknown as Application[]) {
    const group = groupOf(a.stage).name;
    if (group === "Closed") continue;
    const title = a.opportunity?.title ?? a.title ?? "Untitled role";
    const company = a.opportunity?.company_name ?? a.company_name ?? "Company";
    const stageNote =
      group === "Saved" ? "Saved in your tracker. Not applied yet." : a.applied_at ? `Applied on ${short(a.applied_at)}.` : "In your tracker.";

    // The employer's closing date, while applying still matters
    const closes = a.opportunity?.closes_at;
    if (closes && (group === "Saved" || group === "Applied")) {
      const at = new Date(closes);
      events.push({
        id: `${a.id}:deadline`,
        applicationId: a.id,
        day: dayOf(at),
        kind: "deadline",
        remindKind: "deadline",
        title,
        company,
        meta: time(at) === "00:00" ? "closing date" : time(at),
        note: stageNote,
        startsAt: at.toISOString(),
        reminded: reminded.has(`${a.id}:deadline`),
      });
    }

    // A due date set in the tracker: a test, an interview, or a deadline of the user's own
    if (a.due_on) {
      const kind = group === "Online test" ? "online_test" : group === "Interview" ? "interview" : "deadline";
      const remindKind = kind === "deadline" ? "other" : kind;
      events.push({
        id: `${a.id}:${kind}:due`,
        applicationId: a.id,
        day: a.due_on,
        kind,
        remindKind,
        title: kind === "deadline" && group === "Offer" ? "Reply to offer" : title,
        company,
        meta: a.next_step ?? (kind === "interview" ? "interview" : kind === "online_test" ? "online test" : "due"),
        note: stageNote,
        startsAt: new Date(`${a.due_on}T09:00:00Z`).toISOString(),
        reminded: reminded.has(`${a.id}:${remindKind}`),
      });
    }
  }

  return { events, today: dayOf(new Date()) };
}
