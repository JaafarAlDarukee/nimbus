import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { ROUTES } from "@/lib/company-routes";
import { applyMatch, matchFilters, withDefaults } from "@/lib/preferences";
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
  opportunity: { id: string; title: string; company_name: string; closes_at: string | null; apply_url: string } | null;
};

type Match = { id: string; title: string; company_name: string; first_seen_at: string; closes_at: string | null; apply_url: string };

const TZ = "Europe/London";
const DAY = 86_400_000;

export default async function CalendarPage() {
  return <CalendarView {...await loadEvents()} />;
}

async function loadEvents(): Promise<React.ComponentProps<typeof CalendarView>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user!.id).maybeSingle();
  const filters = matchFilters(withDefaults(profile?.preferences));

  const [{ data: apps }, { data: reminders }, { data: matchRows }] = await Promise.all([
    supabase
      .from("applications")
      .select("id,stage,title,company_name,applied_at,next_step,due_on,opportunity:opportunities(id,title,company_name,closes_at,apply_url)"),
    supabase.from("calendar_events").select("application_id,kind").eq("remind", true),
    // Roles that fit your radar: when they opened and when they close
    applyMatch(
      supabase.from("opportunities").select("id,title,company_name,first_seen_at,closes_at,apply_url" as string).eq("status", "open"),
      filters,
    )
      .order("first_seen_at", { ascending: false })
      .limit(400),
  ]);

  const reminded = new Set((reminders ?? []).map((r) => `${r.application_id}:${r.kind}`));
  const now = new Date();
  const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
  const events: CalendarEvent[] = [];
  const tracked = new Set<string>();

  for (const a of (apps ?? []) as unknown as Application[]) {
    const group = groupOf(a.stage).name;
    const title = a.opportunity?.title ?? a.title ?? "Untitled role";
    const company = a.opportunity?.company_name ?? a.company_name ?? "Company";
    if (a.opportunity) tracked.add(a.opportunity.id);
    const stageNote =
      group === "Saved" ? "Saved in your tracker. Not applied yet." : a.applied_at ? `Applied on ${short(a.applied_at)}.` : "In your tracker.";
    const link = a.opportunity ? { href: a.opportunity.apply_url, label: "Open the advert" } : undefined;

    // The day you applied
    if (a.applied_at && group !== "Saved") {
      events.push({
        id: `${a.id}:applied`,
        day: dayOf(new Date(a.applied_at)),
        kind: "applied",
        title,
        company,
        meta: "you applied",
        note: `Now: ${group === "Closed" ? a.stage : group.toLowerCase()}. Follow up 14 days after applying if you've heard nothing.`,
        link,
      });
    }
    if (group === "Closed") continue;

    // The employer's closing date, while applying still matters
    const closes = a.opportunity?.closes_at;
    if (closes && (group === "Saved" || group === "Applied")) {
      const at = new Date(closes);
      events.push({
        id: `${a.id}:deadline`,
        day: dayOf(at),
        kind: "deadline",
        title,
        company,
        meta: time(at) === "00:00" ? "closing date" : time(at),
        note: stageNote,
        link,
        reminder: { applicationId: a.id, remindKind: "deadline", startsAt: at.toISOString(), on: reminded.has(`${a.id}:deadline`) },
      });
    }

    // A due date set in the tracker: a test, an interview, or a deadline of your own
    if (a.due_on) {
      const kind = group === "Online test" ? "online_test" : group === "Interview" ? "interview" : "deadline";
      const remindKind = kind === "deadline" ? "other" : kind;
      events.push({
        id: `${a.id}:${kind}:due`,
        day: a.due_on,
        kind,
        title: kind === "deadline" && group === "Offer" ? "Reply to offer" : title,
        company,
        meta: a.next_step ?? (kind === "interview" ? "interview" : kind === "online_test" ? "online test" : "due"),
        note: stageNote,
        link,
        reminder: {
          applicationId: a.id,
          remindKind,
          startsAt: new Date(`${a.due_on}T09:00:00Z`).toISOString(),
          on: reminded.has(`${a.id}:${remindKind}`),
        },
      });
    }
  }

  // Your matches: closing dates (not already in the tracker) and the day each company opened
  const opened = new Map<string, { day: string; company: string; roles: Match[] }>();
  for (const m of (matchRows ?? []) as unknown as Match[]) {
    if (m.closes_at && !tracked.has(m.id) && new Date(m.closes_at).getTime() > now.getTime() - 31 * DAY) {
      const at = new Date(m.closes_at);
      events.push({
        id: `${m.id}:closing`,
        day: dayOf(at),
        kind: "closing",
        title: m.title,
        company: m.company_name,
        meta: "closes · fits your radar",
        note: "A role that matches you closes this day. Save it in Opportunities to get a reminder and track it.",
        link: { href: m.apply_url, label: "Open the advert" },
      });
    }
    const firstSeen = new Date(m.first_seen_at);
    if (now.getTime() - firstSeen.getTime() < 60 * DAY) {
      const key = `${m.company_name}|${dayOf(firstSeen)}`;
      const entry = opened.get(key) ?? { day: dayOf(firstSeen), company: m.company_name, roles: [] };
      entry.roles.push(m);
      opened.set(key, entry);
    }
  }
  for (const [key, o] of opened) {
    events.push({
      id: `opened:${key}`,
      day: o.day,
      kind: "opened",
      title: o.roles.length === 1 ? o.roles[0].title : `${o.roles.length} roles that fit you`,
      company: o.company,
      meta: "first seen by Nimbus",
      note: o.roles.length > 1 ? o.roles.map((r) => r.title).slice(0, 5).join(" · ") : "Nimbus spotted this the day it appeared.",
      link: { href: `/?q=${encodeURIComponent(o.company)}`, label: "See them in Opportunities" },
    });
  }

  // Expected to open: the opening window each company publishes on its own site
  for (const [company, route] of Object.entries(ROUTES)) {
    if (!route.opensMonth) continue;
    const month = route.opensMonth - 1;
    const year = now.getMonth() > month ? now.getFullYear() + 1 : now.getFullYear();
    events.push({
      id: `expected:${company}`,
      day: `${year}-${String(month + 1).padStart(2, "0")}-01`,
      kind: "expected",
      title: `Applications usually open: ${route.opens}`,
      company,
      meta: "from their own site",
      note: route.how,
      link: { href: route.careers, label: "Their careers page" },
    });
  }

  return { events, today: dayOf(now) };
}
