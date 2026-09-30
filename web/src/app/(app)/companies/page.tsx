import { CompaniesView, type DirectoryCompany } from "@/components/companies-view";
import { COMPANIES } from "@/lib/companies-data";
import { normaliseCompany, radarNamesFor } from "@/lib/company-match";
import { withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

export default async function CompaniesPage() {
  return <CompaniesView {...await loadDirectory()} />;
}

async function loadDirectory(): Promise<React.ComponentProps<typeof CompaniesView>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: counts }, { data: lastChecked }] = await Promise.all([
    supabase.from("profiles").select("preferences").eq("id", user!.id).maybeSingle(),
    supabase.rpc("open_roles_by_company"),
    supabase.rpc("radar_last_checked"),
  ]);
  const prefs = withDefaults(profile?.preferences);
  const open = (counts ?? {}) as Record<string, number>;
  const radarNames = Object.keys(open).map((name) => ({ name, norm: normaliseCompany(name) }));
  const matched = new Set<string>();

  const directory: Record<string, DirectoryCompany[]> = {};
  for (const [sector, entries] of Object.entries(COMPANIES)) {
    directory[sector] = entries.map((entry) => {
      const [name, place] = entry.split("|");
      const names = radarNamesFor(name, radarNames);
      names.forEach((n) => matched.add(n));
      return { name, place, open: names.reduce((sum, n) => sum + open[n], 0), radarNames: names };
    });
  }

  // Everyone else the radar found with open roles, biggest first
  const others: DirectoryCompany[] = radarNames
    .filter((r) => !matched.has(r.name) && open[r.name] > 0)
    .map((r) => ({ name: r.name, place: "", open: open[r.name], radarNames: [r.name] }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  return {
    field: prefs.field,
    degree: prefs.degrees[0] ?? null,
    sectors: prefs.sectors,
    muted: prefs.muted,
    directory,
    others,
    lastChecked: (lastChecked as string | null) ?? null,
  };
}
