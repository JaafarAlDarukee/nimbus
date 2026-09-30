import { TrackerView, type TrackerRow } from "@/components/tracker-view";
import { kindView } from "@/lib/opportunity-view";
import { createClient } from "@/lib/supabase/server";
import { groupOf } from "@/lib/tracker";

type Application = {
  id: string;
  stage: string;
  title: string | null;
  company_name: string | null;
  applied_at: string | null;
  next_follow_up_at: string | null;
  next_step: string | null;
  due_on: string | null;
  created_at: string;
  opportunity: { title: string; company_name: string; kind: string; closes_at: string | null } | null;
};

const DAY = 86_400_000;
const TZ = "Europe/London";

export default async function TrackerPage() {
  return <TrackerView rows={await loadRows()} />;
}

async function loadRows(): Promise<TrackerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "id,stage,title,company_name,applied_at,next_follow_up_at,next_step,due_on,created_at,opportunity:opportunities(title,company_name,kind,closes_at)",
    )
    .order("created_at", { ascending: false });

  const now = new Date();
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = dayKey(now);
  const short = (d: Date) => (dayKey(d) === today ? "today" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ }));
  const weekday = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });

  return ((data ?? []) as unknown as Application[]).map((a) => {
    const group = groupOf(a.stage);
    const role = a.opportunity?.title ?? a.title ?? "Untitled role";
    const company = a.opportunity?.company_name ?? a.company_name ?? "Company";
    const closes = a.opportunity?.closes_at ? new Date(a.opportunity.closes_at) : null;
    const followUp = a.next_follow_up_at ? new Date(a.next_follow_up_at) : null;
    const appliedAt = a.applied_at ? new Date(a.applied_at) : null;
    const daysSinceApplied = appliedAt ? Math.floor((now.getTime() - appliedAt.getTime()) / DAY) : 0;

    // Due: a date the user set, else the closing date while it still matters, else the follow-up
    let due: Date | null = a.due_on ? new Date(`${a.due_on}T12:00:00Z`) : null;
    let deadline = false;
    if (!due && closes && (group.name === "Saved" || group.name === "Applied")) {
      due = closes;
      deadline = true;
    }
    if (!due && group.name === "Applied" && followUp) due = followUp;

    let next = a.next_step ?? "";
    if (!next) {
      if (group.name === "Saved") next = closes ? "Apply before it closes" : "Apply when you're ready";
      else if (group.name === "Applied") {
        if (daysSinceApplied >= 21) next = `No reply in ${daysSinceApplied} days`;
        else if (followUp && followUp.getTime() - now.getTime() < 7 * DAY)
          next = followUp < now ? "Follow up now" : `Follow up ${weekday(followUp)}`;
        else next = "Waiting";
      } else if (group.name === "Online test") next = "Do the test";
      else if (group.name === "Interview") next = "Prepare for the interview";
      else if (group.name === "Offer") next = "Reply to offer";
      else if (a.stage === "ghosted") next = `Ghosted · ${daysSinceApplied} days`;
      else next = a.stage[0].toUpperCase() + a.stage.slice(1);
    }

    const dueSoon = due ? due.getTime() - now.getTime() < 3 * DAY : false;
    return {
      id: a.id,
      stage: a.stage,
      group: group.name,
      role,
      company,
      initial: (company.trim()[0] ?? "?").toUpperCase(),
      type: a.opportunity ? kindView({ kind: a.opportunity.kind, title: a.opportunity.title }).type : "Other",
      applied: appliedAt ? short(appliedAt) : "—",
      next,
      due: due ? short(due) : "—",
      dueAt: due ? due.getTime() : Number.MAX_SAFE_INTEGER,
      urgent: group.name !== "Closed" && !!due && (deadline || dueSoon),
      fresh: now.getTime() - new Date(a.created_at).getTime() < DAY,
      ghosted: a.stage === "ghosted",
    };
  });
}
