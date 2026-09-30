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
  const scoped = (columns: string, head = false) =>
    tab === "you" ? applyMatch(open(columns, head), filters) : open(columns, head);

  let list = scoped(OPPORTUNITY_SELECT);
  if (chip.kinds.length) list = list.in("kind", chip.kinds);
  if (chip.title === "hack") list = list.ilike("title", "%hack%");
  if (chip.title === "not-hack") list = list.not("title", "ilike", "%hack%");
  if (q) list = list.or(`title.ilike.%${q}%,company_name.ilike.%${q}%,location_text.ilike.%${q}%`);

  const since = new Date(Date.now() - DAY).toISOString();
  const [rows, forYou, all, fresh] = await Promise.all([
    list.order("first_seen_at", { ascending: false }).limit(limit),
    applyMatch(open("id", true), filters),
    open("id", true),
    scoped("id", true).gte("first_seen_at", since),
  ]);

  const now = Date.now();
  const opportunities = ((rows.data ?? []) as unknown as OpportunityRow[]).map((row) => toView(row, prefs, filters, now));

  const { data: applications } = opportunities.length
    ? await supabase
        .from("applications")
        .select("opportunity_id,stage")
        .in(
          "opportunity_id",
          opportunities.map((o) => o.id),
        )
    : { data: [] };
  const tracked = Object.fromEntries((applications ?? []).map((a) => [a.opportunity_id as string, a.stage as string]));

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
    error: rows.error ? "Couldn't load opportunities just now. Try again in a moment." : null,
  };
}
