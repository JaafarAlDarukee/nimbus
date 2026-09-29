import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DISCIPLINE_FILTERS, KIND_FILTERS, WHERE_FILTERS } from "@/lib/opportunities";
import { cn } from "@/lib/utils";

export type Filters = { type?: string; discipline?: string; where: string; q?: string };

function hrefWith(filters: Filters, key: keyof Filters, value?: string) {
  const params = new URLSearchParams();
  const next = { ...filters, [key]: value };
  for (const [k, v] of Object.entries(next)) {
    if (v && !(k === "where" && v === "uk")) params.set(k, v);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function FilterBar({ filters }: { filters: Filters }) {
  return (
    <div className="space-y-3">
      <Form action="/" className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={filters.q} placeholder="Search roles or companies" className="h-10 pl-9" />
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        {filters.discipline && <input type="hidden" name="discipline" value={filters.discipline} />}
        {filters.where !== "uk" && <input type="hidden" name="where" value={filters.where} />}
      </Form>

      <div className="flex flex-wrap gap-1.5">
        <Chip href={hrefWith(filters, "type")} active={!filters.type}>
          All types
        </Chip>
        {KIND_FILTERS.map((k) => (
          <Chip key={k.value} href={hrefWith(filters, "type", k.value)} active={filters.type === k.value}>
            {k.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip href={hrefWith(filters, "discipline")} active={!filters.discipline}>
          All disciplines
        </Chip>
        {DISCIPLINE_FILTERS.map((d) => (
          <Chip key={d.value} href={hrefWith(filters, "discipline", d.value)} active={filters.discipline === d.value}>
            {d.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {WHERE_FILTERS.map((w) => (
          <Chip key={w.value} href={hrefWith(filters, "where", w.value)} active={filters.where === w.value}>
            {w.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
