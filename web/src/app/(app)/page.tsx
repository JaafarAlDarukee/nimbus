import { OpportunityFeed } from "@/components/opportunity-feed";
import { TRIAL_JOBS, accessState } from "@/lib/access";
import { OPPORTUNITY_SELECT, TYPE_CHIPS, TYPE_COLUMNS, isSameRole, sameRoleKey, toView, type OpportunityRow, type OpportunityView } from "@/lib/opportunity-view";
import { COVERED_COUNTRIES, applyMatch, matchFilters, withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 40;
/** Cards per column when For you is shown side by side */
const COLUMN_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = 86_400_000;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

/** Letters, numbers, spaces and a few name characters only: keeps search text safe inside the query. */
const safeSearch = (text?: string) =>
  text
    ?.replace(/[^\p{L}\p{N} &'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim() || undefined;

/** One card per role: the same title at the same employer in several places becomes "Leeds +3 more". */
function collapse(list: OpportunityView[]): OpportunityView[] {
  // The same role from several places (employer, Gradcracker, Bright Network, Adzuna) shows once
  const seen: { key: [string, string]; card: OpportunityView; more: number }[] = [];
  for (const card of list) {
    const key = sameRoleKey(card.title, card.company);
    const first = seen.find((s) => isSameRole(s.key, key));
    if (first) first.more += 1;
    else seen.push({ key, card, more: 0 });
  }
  return seen.map(({ card, more }) => (more ? { ...card, loc: `${card.loc} +${more} more` } : card));
}

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
  const tab = first(params.tab) === "all" ? "all" : first(params.tab) === "abroad" ? "abroad" : "you";
  // A column group ("Graduate jobs"), or one of the older, finer types still used in links ("Placement")
  const chip: { label: string; kinds: string[]; title?: "hack" | "not-hack" } =
    TYPE_COLUMNS.find((c) => c.label === first(params.type)) ?? TYPE_CHIPS.find((c) => c.label === first(params.type)) ?? TYPE_CHIPS[0];
  const openId = first(params.open);
  const q = safeSearch(first(params.q));
  const limit = Math.min(400, Math.max(PAGE_SIZE, Number(first(params.n)) || PAGE_SIZE));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: hiddenRows }, { data: telegram }] = await Promise.all([
    supabase.from("profiles").select("preferences,cv_details,is_admin,paid_at,trial_ends_at").eq("id", user!.id).maybeSingle(),
    // "Not for me" in Telegram
    supabase.from("hidden_opportunities").select("opportunity_id").limit(500),
    supabase.from("notification_channels").select("id").eq("channel", "telegram").eq("enabled", true).limit(1),
  ]);
  const hidden = (hiddenRows ?? []).map((h) => h.opportunity_id as string);
  const prefs = withDefaults(profile?.preferences);
  const filters = matchFilters(prefs);

  // Everything open in the UK and Ireland (plus online events, which aren't tied to a country)
  const openAnywhere = (columns: string, head = false) => {
    const query = supabase.from("opportunities").select(columns, { count: "exact", head }).eq("status", "open");
    return prefs.defence ? query : query.eq("defence", false);
  };
  const open = (columns: string, head = false) =>
    openAnywhere(columns, head).or(`country.in.(${COVERED_COUNTRIES.join(",")}),and(kind.eq.event,remote.is.true)`);
  // Roles elsewhere are still saved: shown on their own tab, marked "(abroad)" (owner, 18 Oct)
  const abroad = (columns: string, head = false) =>
    openAnywhere(columns, head).not("country", "in", `(${COVERED_COUNTRIES.join(",")})`).not("country", "is", null);
  // For you: the user's matches, minus companies muted on the Companies page
  const matched = (columns: string, head = false) => {
    let query = applyMatch(open(columns, head), filters);
    for (const name of prefs.muted) query = query.not("company_name", "ilike", `${name.replace(/[%_\\]/g, "\\$&")}%`);
    if (hidden.length) query = query.not("id", "in", `(${hidden.join(",")})`);
    return query;
  };
  const scoped = (columns: string, head = false) => (tab === "you" ? matched(columns, head) : tab === "abroad" ? abroad(columns, head) : open(columns, head));

  let list = scoped(OPPORTUNITY_SELECT);
  if (chip.kinds.length) list = list.in("kind", chip.kinds);
  if (chip.title === "hack") list = list.ilike("title", "%hack%");
  if (chip.title === "not-hack") list = list.not("title", "ilike", "%hack%");
  const search = <Q extends { or: (filters: string) => Q }>(query: Q) =>
    q ? query.or(`title.ilike.%${q}%,company_name.ilike.%${q}%,location_text.ilike.%${q}%`) : query;
  list = search(list);
  // One column per type group: counts always (phone tabs, chips), cards only when shown side by side
  const trial = accessState(profile) === "trial";
  const columnsView = chip.label === "All types" && !trial && tab !== "abroad";

  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - DAY).toISOString();
  // Newest first by when roles really opened, not when Nimbus happened to find them (owner, 18 Oct)
  const [rows, forYou, all, abroadCount, fresh, today, closing, savedApps, opened, ...columnRows] = await Promise.all([
    list.order("opened_at", { ascending: false }).order("first_seen_at", { ascending: false }).limit(limit),
    matched("id", true),
    open("id", true),
    abroad("id", true),
    scoped("id", true).gte("opened_at", since),
    // Phone layout: "N new today", Closing soon and Saved
    matched("id", true).gte("opened_at", londonMidnight()),
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
    // Opened from a Telegram alert: that role, whatever the filters
    openId && UUID.test(openId)
      ? supabase.from("opportunities").select(OPPORTUNITY_SELECT).eq("id", openId).maybeSingle()
      : Promise.resolve({ data: null }),
    ...TYPE_COLUMNS.map((col) =>
      columnsView
        ? search(scoped(OPPORTUNITY_SELECT)).in("kind", col.kinds).order("opened_at", { ascending: false }).order("first_seen_at", { ascending: false }).limit(COLUMN_SIZE)
        : search(scoped("id", true)).in("kind", col.kinds),
    ),
  ]);

  const now = Date.now();
  const view = (list: unknown) => ((list ?? []) as OpportunityRow[]).map((row) => toView(row, prefs, filters, now));
  // Free trial: the first few roles; the rest wait behind the paywall
  const allCards = collapse(view(rows.data));
  const opportunities = trial ? allCards.slice(0, TRIAL_JOBS) : allCards;
  const closingSoon = trial ? collapse(view(closing.data)).slice(0, 2) : collapse(view(closing.data));
  const trialLocked = trial ? Math.max(0, (rows.count ?? allCards.length) - opportunities.length) : 0;
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
    hasMore: !trial && (rows.count ?? 0) > (rows.data?.length ?? 0),
    counts: { you: forYou.count ?? 0, all: all.count ?? 0, abroad: abroadCount.count ?? 0 },
    newCount: fresh.count ?? 0,
    tracked,
    phone: {
      closingSoon,
      saved,
      today: today.count ?? 0,
      weekday: new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" }),
    },
    find: first(params.find) === "1",
    telegramLinked: (telegram ?? []).length > 0,
    error: rows.error ? "Couldn't load opportunities just now. Try again in a moment." : null,
    columns: TYPE_COLUMNS.map((col, i) => ({
      label: col.label,
      count: columnRows[i].count ?? 0,
      items: columnsView ? collapse(view(columnRows[i].data)) : [],
    })),
    columnsView,
    openRole: opened.data ? view([opened.data])[0] : null,
    trialLocked,
  };
}
