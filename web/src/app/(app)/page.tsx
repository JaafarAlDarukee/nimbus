import Link from "next/link";
import { FilterBar, type Filters } from "@/components/filter-bar";
import { OpportunityCard } from "@/components/opportunity-card";
import { KIND_FILTERS, OPPORTUNITY_COLUMNS, type Opportunity } from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

/** Letters, numbers, spaces and a few name characters only: keeps search text safe inside the query. */
const safeSearch = (text?: string) => text?.replace(/[^\p{L}\p{N} &'.-]/gu, " ").replace(/\s+/g, " ").trim() || undefined;

export default async function OpportunitiesPage(props: PageProps<"/">) {
  const params = await props.searchParams;
  const filters: Filters = {
    type: first(params.type),
    discipline: first(params.discipline),
    where: first(params.where) ?? "uk",
    q: safeSearch(first(params.q)),
  };
  const page = Math.max(1, Number(first(params.page)) || 1);

  const supabase = await createClient();
  let query = supabase.from("opportunities").select(OPPORTUNITY_COLUMNS, { count: "exact" }).eq("status", "open");

  if (filters.where === "uk") query = query.eq("country", "GB");
  if (filters.where === "abroad") query = query.neq("country", "GB");
  const kind = KIND_FILTERS.find((k) => k.value === filters.type);
  if (kind) query = query.in("kind", kind.kinds);
  if (filters.discipline) query = query.contains("disciplines", [filters.discipline]);
  if (filters.q) query = query.or(`title.ilike.%${filters.q}%,company_name.ilike.%${filters.q}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("first_seen_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const opportunities = (data ?? []) as Opportunity[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = Date.now();

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && !(key === "where" && value === "uk")) next.set(key, value);
    }
    if (target > 1) next.set("page", String(target));
    const text = next.toString();
    return text ? `/?${text}` : "/";
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total.toLocaleString("en-GB")} open · newest first · checked every 30 minutes
        </p>
      </div>

      <FilterBar filters={filters} />

      <div className="mt-6 space-y-3">
        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            Couldn&apos;t load opportunities: {error.message}
          </p>
        )}
        {!error && opportunities.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nothing matches these filters yet. Nimbus checks again every 30 minutes.
          </div>
        )}
        {opportunities.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} now={now} />
        ))}
      </div>

      {lastPage > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm">
          <Link
            href={pageHref(page - 1)}
            className={cn("rounded-lg border px-3 py-1.5", page <= 1 && "pointer-events-none opacity-40")}
          >
            ← Newer
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {lastPage}
          </span>
          <Link
            href={pageHref(page + 1)}
            className={cn("rounded-lg border px-3 py-1.5", page >= lastPage && "pointer-events-none opacity-40")}
          >
            Older →
          </Link>
        </nav>
      )}
    </main>
  );
}
