import { OpportunityFeed } from "@/components/opportunity-feed";
import { OPPORTUNITY_SELECT, TYPE_CHIPS, toView, type OpportunityRow } from "@/lib/opportunity-view";
import { applyMatch, matchFilters, withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 40;
const DAY = 86_400_000;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

/** Letters, numbers, spaces and a few name characters only: keeps search text safe inside the query. */
const safeSearch = (text?: string) =>
  text
    ?.replace(/[^\p{L}\p{N} &'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim() || undefined;

/** Midnight today in the UK, as an ISO time (handles BST). */
function londonMidnight(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const offset = now.toLocaleString("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).match(/GMT([+-]\d+)?/)?.[1] ?? "0";
  return new Date(`${day}T00:00:00${Number(offset) >= 0 ? "+" : "-"}${String(Math.abs(Number(offset))).padStart(2, "0")}:00`).toISOString();
}

export default async function OpportunitiesPage(props: PageProps<"/">) {
  return <OpportunityFeed {...await loadFeed(await props.searchParams)} />;
}

async function loadFeed(params: Awaited<PageProps<"/">["searchParams"]>): Promise<React.ComponentProps<typeof OpportunityFeed>> {
  const tab = first(params.tab) === "all" ? "all" : "you";
  const chip = TYPE_CHIPS.find((c) => c.label === first(params.type)) ?? TYPE_CHIPS[0];
  const q = safeSearch(first(params.q));
  const limit = Math.min(400, Math.max(PAGE_SIZE, Number(first(params.n)) || PAGE_SIZE));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user!.id).maybeSingle();
  const prefs = withDefaults(profile?.preferences);
  const filters = matchFilters(prefs);

  const open = (columns: string, head = false) =>
    supabase.from("opportunities").select(columns, { count: "exact", head }).eq("status", "open");
  // For you: the user's matches, minus companies muted on the Companies page
  const matched = (columns: string, head = false) => {
    let query = applyMatch(open(columns, head), filters);
    for (const name of prefs.muted) query = query.not("company_name", "ilike", `${name.replace(/[%_\\]/g, "\\$&")}%`);
    return query;
  };
  const scoped = (columns: string, head = false) => (tab === "you" ? matched(columns, head) : open(columns, head));

  let list = scoped(OPPORTUNITY_SELECT);
  if (chip.kinds.length) list = list.in("kind", chip.kinds);
  if (chip.title === "hack") list = list.ilike("title", "%hack%");
  if (chip.title === "not-hack") list = list.not("title", "ilike", "%hack%");
  if (q) list = list.or(`title.ilike.%${q}%,company_name.ilike.%${q}%,location_text.ilike.%${q}%`);

  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - DAY).toISOString();
  const [rows, forYou, all, fresh, today, closing, savedApps] = await Promise.all([
    list.order("first_seen_at", { ascending: false }).limit(limit),
    matched("id", true),
    open("id", true),
    scoped("id", true).gte("first_seen_at", since),
    // Phone layout: "N new today", Closing soon and Saved
    matched("id", true).gte("first_seen_at", londonMidnight()),
    matched(OPPORTUNITY_SELECT)
      .gte("closes_at", nowIso)
      .lte("closes_at", new Date(Date.now() + 21 * DAY).toISOString())
      .order("closes_at", { ascending: true })
      .limit(30),
    supabase
      .from("applications")
      .select(`opportunity:opportunities(${OPPORTUNITY_SELECT})`)
      .eq("stage", "saved")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const now = Date.now();
  const view = (list: unknown) => ((list ?? []) as OpportunityRow[]).map((row) => toView(row, prefs, filters, now));
  const opportunities = view(rows.data);
  const closingSoon = view(closing.data);
  const saved = view(((savedApps.data ?? []) as unknown as { opportunity: OpportunityRow | null }[]).map((a) => a.opportunity).filter(Boolean));

  const ids = [...new Set([...opportunities, ...closingSoon].map((o) => o.id))];
  const { data: applications } = ids.length
    ? await supabase.from("applications").select("opportunity_id,stage").in("opportunity_id", ids)
    : { data: [] };
  const tracked = Object.fromEntries([
    ...saved.map((o) => [o.id, "saved"]),
    ...(applications ?? []).map((a) => [a.opportunity_id as string, a.stage as string]),
  ]);

  return {
    tab,
    type: chip.label,
    q: q ?? "",
    limit,
    opportunities,
    hasMore: (rows.count ?? 0) > opportunities.length,
    counts: { you: forYou.count ?? 0, all: all.count ?? 0 },
    newCount: fresh.count ?? 0,
    tracked,
    phone: {
      closingSoon,
      saved,
      today: today.count ?? 0,
      weekday: new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" }),
    },
    find: first(params.find) === "1",
    error: rows.error ? "Couldn't load opportunities just now. Try again in a moment." : null,
  };
}
