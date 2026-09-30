import type { MatchFilters, Preferences } from "@/lib/preferences";
import { timeAgo } from "@/lib/time";

/** A database opportunity row (the columns the Opportunities page selects). */
export type OpportunityRow = {
  id: string;
  title: string;
  company_name: string;
  kind: string;
  disciplines: string[];
  skills: string[];
  location_text: string | null;
  country: string | null;
  apply_url: string;
  description: string | null;
  published_contacts: { type?: string; value?: string; label?: string }[] | null;
  first_seen_at: string;
  closes_at: string | null;
  rolling: boolean | null;
};

export const OPPORTUNITY_SELECT =
  "id,title,company_name,kind,disciplines,skills,location_text,country,apply_url,description,published_contacts,first_seen_at,closes_at,rolling";

export type Tone = "sky" | "lil" | "dawn" | "mint" | "teal" | "rose";

/** What a card and the detail drawer show. */
export type OpportunityView = {
  id: string;
  title: string;
  company: string;
  initial: string;
  logo: string | null;
  loc: string;
  type: string;
  tone: Tone;
  found: string;
  isNew: boolean;
  match: number;
  why: string[];
  deadline: string;
  source: string;
  applyUrl: string;
  contact: string;
  contactNote: string;
  advert: string;
};

/** The type chips on the page, in the design's order, and which radar kinds each one covers. */
export const TYPE_CHIPS: { label: string; kinds: string[]; title?: "hack" | "not-hack" }[] = [
  { label: "All types", kinds: [] },
  { label: "Placement", kinds: ["placement"] },
  { label: "Internship", kinds: ["internship"] },
  { label: "Spring week", kinds: ["spring_week", "insight"] },
  { label: "Hackathon", kinds: ["event"], title: "hack" },
  { label: "Conference", kinds: ["event"], title: "not-hack" },
  { label: "Graduate", kinds: ["grad_scheme", "graduate_job"] },
  { label: "Apprenticeship", kinds: ["apprenticeship"] },
  { label: "Research", kinds: ["research", "scholarship"] },
];

const KIND_VIEW: Record<string, { type: string; tone: Tone; plural: string }> = {
  placement: { type: "Placement", tone: "sky", plural: "Placements are" },
  internship: { type: "Internship", tone: "lil", plural: "Internships are" },
  spring_week: { type: "Spring week", tone: "dawn", plural: "Spring weeks are" },
  insight: { type: "Insight", tone: "dawn", plural: "Insight programmes are" },
  grad_scheme: { type: "Graduate", tone: "mint", plural: "Graduate roles are" },
  graduate_job: { type: "Graduate", tone: "mint", plural: "Graduate roles are" },
  apprenticeship: { type: "Apprenticeship", tone: "teal", plural: "Apprenticeships are" },
  research: { type: "Research", tone: "rose", plural: "Research roles are" },
  scholarship: { type: "Scholarship", tone: "rose", plural: "Scholarships are" },
};

const DISCIPLINE_WORD: Record<string, string> = {
  mechanical: "Mechanical engineering",
  manufacturing: "Manufacturing",
  robotics: "Robotics",
  electrical: "Electrical engineering",
  aerospace: "Aerospace",
  automotive: "Automotive",
  materials: "Materials",
  civil: "Civil engineering",
  chemical: "Chemical engineering",
  software: "Software",
};

/** Hosts that belong to hiring systems or job boards rather than the employer: no useful logo there. */
const NOT_EMPLOYER =
  /(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|myworkdaysite\.com|adzuna\.|successfactors\.|sapsf\.|taleo\.net|icims\.com|gradcracker\.com|linkedin\.com|indeed\.|joinhandshake\.|ratemyplacement\.|brightnetwork\.|targetjobs\.|prospects\.ac\.uk|teamtailor\.com|pinpointhq\.com|oraclecloud\.com)/i;

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** careers.rolls-royce.com → rolls-royce.com, jobs.example.co.uk → example.co.uk */
function siteOf(hostname: string): string {
  const parts = hostname.split(".");
  const secondLevel = /^(co|ac|org|gov|com|net)$/.test(parts[parts.length - 2] ?? "") && parts.length > 2;
  return parts.slice(secondLevel ? -3 : -2).join(".");
}

function kindView(row: OpportunityRow) {
  if (row.kind === "event") {
    return /hack/i.test(row.title)
      ? { type: "Hackathon", tone: "mint" as const, plural: "Hackathons are" }
      : { type: /conference|summit|expo/i.test(row.title) ? "Conference" : "Event", tone: "rose" as const, plural: "Events are" };
  }
  return KIND_VIEW[row.kind] ?? { type: "Opportunity", tone: "sky" as const, plural: "" };
}

const HOUR = 3_600_000;

export function toView(row: OpportunityRow, prefs: Preferences, filters: MatchFilters, now: number): OpportunityView {
  const kind = kindView(row);
  const why: string[] = [];
  let match = 58;

  // Every point here is a real overlap with what the user picked in onboarding
  if (filters.kinds.includes(row.kind) && kind.plural) {
    match += 16;
    why.push(`${kind.plural} one of the types you picked`);
  }
  const overlap = (row.disciplines ?? []).filter((d) => filters.disciplines.includes(d));
  if (overlap.length) {
    match += 12 + Math.min(4, (overlap.length - 1) * 2);
    why.push(`${DISCIPLINE_WORD[overlap[0]] ?? overlap[0]} fits your ${prefs.degrees[0] ?? "degree"}`);
  }
  if (!filters.countries || (row.country && filters.countries.includes(row.country))) {
    match += 6;
    if (row.country === "GB") why.push("Based in the UK, where you said you'd work");
  }
  if (row.skills?.length) {
    match += Math.min(4, row.skills.length);
    why.push(`Asks for ${row.skills.slice(0, 3).join(", ")}`);
  }
  if (row.rolling) why.push("Rolling applications, so applying early matters");
  if (!why.length) why.push("Posted on the employer's own site");

  const source = host(row.apply_url);
  const contact = row.published_contacts?.[0];
  // Adverts often list an email for questions: that is a published contact too
  const advertEmail = row.description?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0];
  const age = now - new Date(row.first_seen_at).getTime();

  return {
    id: row.id,
    title: row.title,
    company: row.company_name,
    initial: (row.company_name.trim()[0] ?? "?").toUpperCase(),
    logo: source && !NOT_EMPLOYER.test(source) ? `https://www.google.com/s2/favicons?sz=64&domain=${siteOf(source)}` : null,
    loc: row.location_text || (row.country === "GB" ? "United Kingdom" : (row.country ?? "Location not given")),
    type: kind.type,
    tone: kind.tone,
    found: timeAgo(row.first_seen_at, now),
    isNew: age < 6 * HOUR,
    match: Math.min(97, match),
    why: why.slice(0, 3),
    deadline: row.closes_at
      ? new Date(row.closes_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : row.rolling
        ? "Rolling"
        : "Not stated",
    source: source || "employer site",
    applyUrl: row.apply_url,
    contact: contact?.label || contact?.value || advertEmail || "Not published yet",
    contactNote: contact ? "Listed by the employer" : advertEmail ? "Email in the job advert" : "Shown here once the employer lists one",
    advert: (row.description ?? "").replace(/\s+/g, " ").trim().slice(0, 1500),
  };
}
