"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { companyRoles, setMuted, suggestCompany, type CompanyRole } from "@/app/(app)/companies/actions";
import { FIELD_EXTRAS } from "@/lib/companies-data";
import { DEGREES_BY_FIELD, FIELDS, SUGGEST } from "@/lib/onboarding-data";
import { timeAgo } from "@/lib/time";

export type DirectoryCompany = { name: string; place: string; open: number; radarNames: string[] };

type Props = {
  field: string;
  degree: string | null;
  sectors: string[];
  muted: string[];
  directory: Record<string, DirectoryCompany[]>;
  others: DirectoryCompany[];
  lastChecked: string | null;
};

const SERIF = "var(--font-newsreader), Georgia, serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const ALL = "All degrees";
const OTHERS = "More employers with open roles";
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[.08em] text-tx3";

// Programme pills in the drawer, by the radar's opportunity kinds
const PROGRAMMES: { label: string; kinds: string[]; bg: string; fg: string }[] = [
  { label: "Placement", kinds: ["placement"], bg: "rgba(143,199,255,.3)", fg: "#1D5C9C" },
  { label: "Summer internship", kinds: ["internship"], bg: "rgba(195,181,255,.35)", fg: "#5642B0" },
  { label: "Graduate scheme", kinds: ["grad_scheme", "graduate_job"], bg: "rgba(147,224,192,.4)", fg: "#1B6E4D" },
  { label: "Spring week", kinds: ["spring_week", "insight"], bg: "rgba(243,195,143,.4)", fg: "#8E5413" },
  { label: "Apprenticeship", kinds: ["apprenticeship"], bg: "rgba(127,214,214,.4)", fg: "#196A6A" },
  { label: "Research", kinds: ["research", "scholarship"], bg: "rgba(244,169,184,.38)", fg: "#9C3550" },
  { label: "Events", kinds: ["event"], bg: "rgba(244,169,184,.38)", fg: "#9C3550" },
];

const chip = (on: boolean) =>
  on ? { borderColor: "var(--l-sky)", background: "var(--b-sky)", color: "var(--t-sky)" } : { borderColor: "var(--line2)", background: "transparent", color: "var(--tx2)" };

export function CompaniesView(props: Props) {
  const fields = FIELDS.filter((f) => !f.soon).map((f) => f.label);
  const [field, setField] = useState(fields.includes(props.field) ? props.field : fields[0]);
  const degreesOf = (f: string) => DEGREES_BY_FIELD[f] ?? [];
  const [degree, setDegree] = useState(props.degree && degreesOf(field).includes(props.degree) ? props.degree : (degreesOf(field)[0] ?? ALL));
  const [q, setQ] = useState("");
  const [muted, setMutedList] = useState(new Set(props.muted));
  const [selected, setSelected] = useState<{ company: DirectoryCompany; sector: string } | null>(null);
  const [sug, setSug] = useState("");
  const [sent, setSent] = useState(false);

  // Industries shown: the degree's suggestions plus the field's extras, or every industry in the field
  const fieldAll = [...new Set([...degreesOf(field).flatMap((d) => SUGGEST[d] ?? []), ...(FIELD_EXTRAS[field] ?? [])])];
  const base = (degree === ALL ? fieldAll : [...new Set([...(SUGGEST[degree] ?? fieldAll.slice(0, 6)), ...(FIELD_EXTRAS[field] ?? [])])]).filter(
    (s) => props.directory[s],
  );
  const firstOpen = base.find((s) => props.sectors.includes(s)) ?? base[0];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(firstOpen ? { [firstOpen]: true } : {});

  const ql = q.trim().toLowerCase();
  const matches = (c: DirectoryCompany) => !ql || `${c.name} ${c.place}`.toLowerCase().includes(ql);
  const groups = [
    ...base.map((name) => ({ name, cos: props.directory[name].filter(matches) })),
    { name: OTHERS, cos: props.others.filter(matches).slice(0, ql ? 300 : 90), total: props.others.filter(matches).length },
  ]
    .map((g) => ({
      ...g,
      count: "total" in g && g.total !== undefined ? g.total : g.cos.length,
      open: g.cos.reduce((sum, c) => sum + c.open, 0),
      isOpen: ql ? true : !!openGroups[g.name],
    }))
    .filter((g) => g.cos.length);
  const allOpen = groups.length > 0 && groups.every((g) => g.isOpen);
  const shown = groups.reduce((sum, g) => sum + g.count, 0);
  const openRoles = groups.reduce((sum, g) => sum + g.open, 0);

  const toggleMute = async (company: string) => {
    const next = !muted.has(company);
    setMutedList((m) => {
      const copy = new Set(m);
      if (next) copy.add(company);
      else copy.delete(company);
      return copy;
    });
    await setMuted(company, next);
  };

  return (
    <main className="mx-auto flex max-w-[1144px] flex-col gap-7 px-5 pb-24 pt-14 leading-[normal] sm:px-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-[44px] font-normal leading-none tracking-[-.03em] sm:text-[52px]" style={{ fontFamily: SERIF }}>
            Companies
          </h1>
          <p className="m-0 max-w-[560px] text-base leading-[1.55] text-tx2">
            The best-known employers that hire <span className="text-tx">{degree === ALL ? field.toLowerCase() : degree}</span> students,
            grouped by industry. Nimbus watches far more than these: {props.others.length.toLocaleString("en-GB")} other employers have open
            roles right now, under &ldquo;More employers with open roles&rdquo;, and search finds them all. Mute any you are not interested in.
          </p>
        </div>
        <div className="flex gap-7">
          <div className="flex flex-col gap-0.5">
            <span className="text-[36px] leading-none" style={{ fontFamily: SERIF }}>
              {shown.toLocaleString("en-GB")}
            </span>
            <span className="text-[12px] text-tx3">companies shown</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[36px] leading-none text-t-sky" style={{ fontFamily: SERIF }}>
              {openRoles.toLocaleString("en-GB")}
            </span>
            <span className="text-[12px] text-tx3">open roles</span>
          </div>
        </div>
      </div>

      <div className="animate-fade-up flex flex-col gap-2.5" style={{ animationDelay: "80ms" }}>
        <span className={EYEBROW}>Field</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setField(f);
                setDegree(degreesOf(f)[0] ?? ALL);
                setOpenGroups({});
              }}
              className="h-10 cursor-pointer whitespace-nowrap rounded-xl border px-4 text-sm font-semibold"
              style={chip(f === field)}
            >
              {f}
            </button>
          ))}
        </div>
        <span className={EYEBROW}>Your degree</span>
        <div className="flex flex-wrap gap-1.5">
          {[...degreesOf(field), ALL].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDegree(d)}
              className="h-[38px] cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium"
              style={chip(d === degree)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-up flex gap-2" style={{ animationDelay: "140ms" }}>
        <label className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line2 bg-s1 px-3.5 text-tx3 focus-within:border-l-sky">
          <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies or towns"
            aria-label="Search companies or towns"
            className="h-full min-w-0 flex-1 border-none bg-transparent text-sm text-tx outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpenGroups(Object.fromEntries(groups.map((g) => [g.name, !allOpen])))}
          className="h-[46px] cursor-pointer whitespace-nowrap rounded-xl border border-line2 bg-s2 px-4 text-sm font-medium text-tx"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="animate-fade-up overflow-hidden rounded-2xl border border-line bg-s1" style={{ animationDelay: "200ms" }}>
        {groups.length === 0 && <div className="px-5 py-10 text-center text-tx3">No companies match that search.</div>}
        {groups.map((g, gi) => (
          <div key={g.name} className={gi ? "border-t border-line" : ""}>
            <button
              type="button"
              onClick={() => setOpenGroups((o) => ({ ...o, [g.name]: !g.isOpen }))}
              aria-expanded={g.isOpen}
              className="grid min-h-[60px] w-full cursor-pointer grid-cols-[minmax(0,1fr)_32px] items-center gap-3 px-5 text-left text-tx hover:bg-s2 sm:grid-cols-[minmax(0,1fr)_120px_110px_32px]"
            >
              <span className="text-base font-medium">{g.name}</span>
              <span className="hidden text-[13px] text-tx3 sm:block">{g.count} companies</span>
              <span className="hidden text-[12px] text-t-sky sm:block" style={{ fontFamily: MONO }}>
                {g.open} open
              </span>
              <span className="grid size-8 place-items-center rounded-lg bg-s2 text-tx2">
                <svg width="12" height="12" viewBox="0 0 12 12" className="transition-transform duration-150" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", transform: `rotate(${g.isOpen ? 180 : 0}deg)` }}>
                  <path d="m3 4.5 3 3 3-3" />
                </svg>
              </span>
            </button>
            {g.isOpen && (
              <div className="grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                {g.cos.map((c) => {
                  const isMuted = muted.has(c.name);
                  return (
                    <div
                      key={c.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected({ company: c, sector: g.name === OTHERS ? "" : g.name })}
                      onKeyDown={(e) => e.key === "Enter" && setSelected({ company: c, sector: g.name === OTHERS ? "" : g.name })}
                      className="grid cursor-pointer grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 bg-bg px-4 py-3.5 hover:bg-s2"
                      style={{ opacity: isMuted ? 0.45 : 1 }}
                    >
                      <span className="grid size-9 place-items-center rounded-[9px] border border-line2 bg-s2 text-lg" style={{ fontFamily: SERIF }}>
                        {c.name[0]}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="text-[12px] text-tx3">
                          {c.place && `${c.place} · `}
                          <span style={{ fontFamily: MONO, color: c.open ? "var(--t-sky)" : "var(--tx3)" }}>{c.open} open</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute(c.name);
                        }}
                        title={isMuted ? "Muted" : "Watching"}
                        aria-label={isMuted ? `Watch ${c.name}` : `Mute ${c.name}`}
                        className="grid size-9 cursor-pointer place-items-center rounded-[9px] border border-line2 bg-transparent"
                      >
                        <svg width="14" height="14" viewBox="0 0 10 10" style={{ fill: isMuted ? "transparent" : "#F3C38F", stroke: isMuted ? "var(--tx3)" : "#F3C38F", strokeWidth: 0.8 }}>
                          <path d="M5 .5l1.2 3.3L9.5 5 6.2 6.2 5 9.5 3.8 6.2.5 5l3.3-1.2z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-dashed border-line2 px-[18px] py-4">
        <span className="text-sm text-tx2">Missing a company? Tell us and we&apos;ll add its careers page to the radar.</span>
        <div className="flex gap-2">
          <input
            value={sug}
            onChange={(e) => {
              setSug(e.target.value);
              setSent(false);
            }}
            placeholder="Company name"
            aria-label="Company name"
            className="h-[42px] w-[220px] max-w-full rounded-[10px] border border-line2 bg-bg px-3 text-sm text-tx outline-none focus:border-l-sky"
          />
          <button
            type="button"
            onClick={async () => {
              if (!sug.trim()) return;
              if ((await suggestCompany(sug)).ok) {
                setSent(true);
                setSug("");
              }
            }}
            className="h-[42px] cursor-pointer whitespace-nowrap rounded-[10px] bg-[#8FC7FF] px-4 text-sm font-semibold text-[#06111D]"
          >
            {sent ? "Thanks, added" : "Suggest"}
          </button>
        </div>
      </div>
      <span className="text-[13px] text-tx3">Click a company for details. Filled star means watching.</span>

      {selected && (
        <CompanyDrawer
          company={selected.company}
          sector={selected.sector}
          watching={!muted.has(selected.company.name)}
          lastChecked={props.lastChecked}
          onToggle={() => toggleMute(selected.company.name)}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function CompanyDrawer({
  company,
  sector,
  watching,
  lastChecked,
  onToggle,
  onClose,
}: {
  company: DirectoryCompany;
  sector: string;
  watching: boolean;
  lastChecked: string | null;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [roles, setRoles] = useState<CompanyRole[] | null>(null);
  const [, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => setRoles(await companyRoles(company.radarNames)));
  }, [company]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const found = company.open > 0;
  const programmes = PROGRAMMES.filter((p) => roles?.some((r) => p.kinds.includes(r.kind)));
  const label = "text-[11px] font-semibold uppercase tracking-[.06em] text-[#626C7C]";
  const section = "text-[12px] font-semibold uppercase tracking-[.08em] text-[#626C7C]";

  return (
    <>
      <div onClick={onClose} className="animate-scrim-in fixed inset-0 z-10" style={{ background: "rgba(6,9,14,.5)" }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={company.name}
        className="animate-drawer-in fixed bottom-3 right-3 top-3 z-[11] flex w-[460px] max-w-[calc(100%-24px)] flex-col overflow-auto rounded-[20px] bg-white leading-[normal] text-[#0E131A]"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,.55)" }}
      >
        <div className="flex flex-col gap-4 border-b border-[#E3E8EE] px-6 py-[22px]" style={{ background: "linear-gradient(180deg,#EAF4FF,#fff)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3.5">
              <span className="grid size-[52px] place-items-center rounded-[13px] bg-[#0E131A] text-[26px] text-white" style={{ fontFamily: SERIF }}>
                {company.name[0]}
              </span>
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[28px] leading-[1.05] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                  {company.name}
                </span>
                {(sector || company.place) && <span className="text-sm text-[#465061]">{[sector, company.place].filter(Boolean).join(" · ")}</span>}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="size-10 flex-none cursor-pointer rounded-[10px] border border-[#E3E8EE] bg-white text-[#465061]">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-[#E3E8EE] bg-white">
            <Fact label="Open now" value={String(company.open)} colour="#1D5C9C" className={label} />
            <Fact label="Usually opens" value="Learning" className={label} border />
            <Fact label="Checked" value={found && lastChecked ? timeAgo(lastChecked) : "Not yet"} className={label} border />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Link
              href={`/?tab=all&q=${encodeURIComponent(company.radarNames[0] ?? company.name)}`}
              className="flex h-[46px] items-center justify-center rounded-xl bg-[#0E131A] font-semibold !text-white"
            >
              See open roles
            </Link>
            <button type="button" onClick={onToggle} className="h-[46px] cursor-pointer rounded-xl border border-[#CFD6DF] bg-white px-4 text-sm font-medium text-[#0E131A]">
              {watching ? "Watching" : "Muted"}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-5 px-6 py-[22px]">
          {programmes.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={section}>Programmes they run</span>
              <div className="flex flex-wrap gap-1.5">
                {programmes.map((p) => (
                  <span key={p.label} className="flex h-7 items-center rounded-full px-2.5 text-[12px] font-semibold" style={{ background: p.bg, color: p.fg }}>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className={section}>Open roles</span>
            <div className="rounded-xl border border-[#E3E8EE]">
              {roles === null && found && <div className="p-3.5 text-sm text-[#626C7C]">Loading…</div>}
              {roles?.slice(0, 8).map((r, i) => (
                <a
                  key={`${r.title}-${i}`}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex justify-between gap-3 px-3.5 py-3 !text-[#0E131A] hover:bg-[#F5F7FA] ${i ? "border-t border-[#E3E8EE]" : ""}`}
                >
                  <span className="text-sm">{r.title}</span>
                  <span className="whitespace-nowrap text-[12px] text-[#8E5413]" style={{ fontFamily: MONO }}>
                    {r.closes ? `closes ${r.closes}` : r.rolling ? "rolling" : "open"}
                  </span>
                </a>
              ))}
              {(!found || roles?.length === 0) && (
                <div className="p-3.5 text-sm text-[#626C7C]">Nothing open right now. We will message you when something appears.</div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={section}>Where we look</span>
            <span className="text-sm leading-normal text-[#1F2733]">
              {found
                ? "Their own careers page and early-careers portal, every 30 minutes. Never a job board copy."
                : "We haven't matched their careers page yet. It's on our list, and you can nudge it with Suggest."}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Fact({ label, value, colour, border, className }: { label: string; value: string; colour?: string; border?: boolean; className: string }) {
  return (
    <div className={`flex flex-col gap-[3px] px-3 py-2.5 ${border ? "border-l border-[#E3E8EE]" : ""}`}>
      <span className={className}>{label}</span>
      <span className="text-sm" style={{ fontFamily: MONO, color: colour }}>
        {value}
      </span>
    </div>
  );
}
