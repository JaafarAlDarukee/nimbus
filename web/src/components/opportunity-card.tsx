import { ArrowUpRight, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DISCIPLINE_LABELS, KIND_LABELS, KIND_STYLES, type Opportunity } from "@/lib/opportunities";
import { isRecent, shortDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export function OpportunityCard({ opportunity: o, now }: { opportunity: Opportunity; now: number }) {
  const place = o.location_text || (o.country === "GB" ? "United Kingdom" : o.country) || "Location not given";
  const isNew = isRecent(o.first_seen_at, 24, now);

  return (
    <article className="group rounded-xl border bg-card/50 p-4 transition-colors hover:border-primary/25 hover:bg-card">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium ring-1 ring-inset",
                KIND_STYLES[o.kind] ?? "bg-muted text-muted-foreground ring-border",
              )}
            >
              {KIND_LABELS[o.kind] ?? "Opportunity"}
            </span>
            {isNew && (
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" /> New
              </span>
            )}
            {o.rolling && <span className="text-amber-200/90">Rolling deadline · apply early</span>}
          </div>

          <h3 className="mt-2 font-medium leading-snug">
            <a href={o.apply_url} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
              {o.title}
            </a>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span className="text-foreground/85">{o.company_name}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {place}
            </span>
          </p>

          {(o.disciplines.length > 0 || o.skills.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.disciplines.map((d) => (
                <span key={d} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                  {DISCIPLINE_LABELS[d] ?? d}
                </span>
              ))}
              {o.skills.map((s) => (
                <span key={s} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs text-muted-foreground">
          <span title="When Nimbus found it">Found {timeAgo(o.first_seen_at, now)}</span>
          {o.closes_at && <span className="text-foreground/80">Closes {shortDate(o.closes_at)}</span>}
          <a
            href={o.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "sm" }), "mt-1.5 gap-1")}
          >
            Apply <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
      {o.source_kind === "adzuna" && <p className="mt-3 text-[11px] text-muted-foreground">Jobs by Adzuna</p>}
    </article>
  );
}
