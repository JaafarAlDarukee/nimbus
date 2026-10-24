import { degreeDisciplines, type MatchFilters, type Preferences } from "@/lib/preferences";
import { shortDate, timeAgo } from "@/lib/time";
import { industryMatch } from "@/lib/industries";
import type { OpportunityView, Tone } from "@/lib/opportunity-types";

export type { OpportunityView, Tone } from "@/lib/opportunity-types";
export { TYPE_CHIPS, TYPE_COLUMNS } from "@/lib/opportunity-types";

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
  /** When it really opened: the employer's date, or the same role seen earlier (job-site emails resend old roles) */
  opened_at: string | null;
  closes_at: string | null;
  rolling: boolean | null;
  source_kind: string | null;
  defence?: boolean | null;
};

export const OPPORTUNITY_SELECT =
  "id,title,company_name,kind,disciplines,skills,location_text,country,apply_url,description,published_contacts,first_seen_at,opened_at,closes_at,rolling,source_kind,defence";

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
  business: "Business",
  biomedical: "Biomedical",
  life_sciences: "Life sciences",
  healthcare: "Healthcare",
  environmental: "Environmental science",
  engineering: "Engineering",
  science: "Science",
};

/** Hosts that belong to hiring systems or job boards rather than the employer: no useful logo there. */
const NOT_EMPLOYER =
  /(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|myworkdaysite\.com|adzuna\.|successfactors\.|sapsf\.|taleo\.net|icims\.com|gradcracker\.com|linkedin\.com|indeed\.|joinhandshake\.|ratemyplacement\.|higherin\.com|devpost\.com|brightnetwork\.|targetjobs\.|prospects\.ac\.uk|teamtailor\.com|pinpointhq\.com|oraclecloud\.com|reed\.co\.uk)/i;

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

export function kindView(row: { kind: string; title: string }) {
  if (row.kind === "event") {
    if (/hack/i.test(row.title)) return { type: "Hackathon", tone: "mint" as const, plural: "Hackathons are" };
    const type = /careers? (fair|festival)|graduate fair/i.test(row.title)
      ? "Careers fair"
      : /\b(expo|exhibition|show|week)\b|\((expo|science festival)\)/i.test(row.title)
        ? "Expo"
        : /conference|summit|symposium|congress/i.test(row.title)
          ? "Conference"
          : /competition|challenge/i.test(row.title)
            ? "Competition"
            : "Event";
    return { type, tone: "rose" as const, plural: "Events are" };
  }
  return KIND_VIEW[row.kind] ?? { type: "Opportunity", tone: "sky" as const, plural: "" };
}

const HOUR = 3_600_000;

/** Job sites whose alert emails Nimbus reads, by their link */
const JOB_SITES: [RegExp, string][] = [
  [/gradcracker\./i, "Gradcracker"], [/brightnetwork\./i, "Bright Network"], [/(higherin|ratemyplacement)\./i, "Higherin"],
  [/linkedin\./i, "LinkedIn"], [/targetjobs\./i, "TARGETjobs"], [/prospects\.ac\.uk/i, "Prospects"], [/indeed\./i, "Indeed"],
  [/joinhandshake\./i, "Handshake"],
];

/** A discipline named in the title itself is a much stronger match than one found in the advert.
 *  The same title words the radar tags with (radar/pipeline/classify.py DISCIPLINES). */
const TITLE_DISCIPLINE: Record<string, RegExp> = {
  mechanical: /\b(mechanical|mech|design engineer\w*|stress|thermo\w*|fluids?|hvac|cfd)\b/i,
  manufacturing: /\b(manufactur\w*|(?<!post[- ])production(?! (assistant|runner|coordinator|company|data))|industrial engineer\w*|process engineer\w*|lean|quality engineer\w*|operations engineer\w*|calibration|metrolog\w*|maintenance engineer\w*|continuous improvement|operational excellence)\b/i,
  robotics: /\b(robot\w*|(industrial|robotics?|factory|manufacturing|controls?|plc|process|electrical|building|warehouse) automation|(?<!(test|&|and) )automation (engineer\w*|technician|intern\w*|placement|apprentic\w*|graduate)|^automation|mechatronic\w*|controls? (systems?|engineer)|autonom\w*|gnc)\b/i,
  electrical: /\b(electrical|electronic\w*|power systems|embedded|firmware|hardware|high voltage|protection (and|&) control|fpga|semiconductor\w*|pcb|rf engineer\w*|signal processing)\b/i,
  aerospace: /\b(aerospace|aeronautic\w*|aircraft|propulsion|gas turbines?|avionic\w*)\b/i,
  automotive: /\b(automotive|vehicles?|powertrain|chassis|motorsport)\b/i,
  materials: /\b(materials(?! (management|handl\w*|planner|planning|controller|coordinator|buyer|purchas\w*|supply))|material (science|scientist|engineer\w*|testing|characteri[sz]ation|development)|metallurg\w*|composites?|ndt|non-destructive|polymer\w*|corrosion|welding)\b/i,
  civil: /\b(civil|structural|geotechnic\w*|dams?|infrastructure engineer\w*|water engineer\w*)\b/i,
  chemical: /\b(chemical|chemistry)\b/i,
  software: /\b(software|data|computer science|computing|developer|programmer|cyber|machine learning|deep learning|ai|ml|llms?|nlp|computer vision|devops|full[- ]?stack|front[- ]?end|back[- ]?end|cloud|site reliability|sre|web|mobile|ios|android|platform engineer\w*|technology (graduate|analyst|programme|intern\w*)|information security|test automation|games? (developer|programmer))\b/i,
  biomedical: /\b(biomedical|medical (device|technolog|engineer|physics|imaging)\w*|medtech|clinical engineer\w*|healthcare science|prosthet\w*|orthot\w*|diagnostic\w*|bioengineer\w*|biomaterial\w*)\b/i,
  life_sciences: /\b(bio(logy|logical|logist|logics|chem\w*|tech\w*|pharma\w*|process\w*|informatic\w*|science\w*)|microbio\w*|genetic\w*|genomic\w*|molecular|cell (biology|culture|therapy|line)|immuno\w*|pharmacolog\w*|pharmaceutical\w*|drug (discovery|development|safety|substance|product)|neuroscien\w*|toxicolog\w*|virolog\w*|proteins?|vaccines?|life sciences?|lab(oratory)? (scientist|technician|analyst)|formulation|forensic\w*|food scien\w*)\b/i,
  healthcare: /\b(clinical|clinicians?|msk|audiolog\w*|health screen\w*|wellbeing|practitioners?|therapists?|mental health|cwp|pharmac(y|ist)|nurs(e|es|ing)|medic(al|ine)(?! (device|technolog|engineer|physics|imaging))|nhs|health ?care|patients?|physiotherap\w*|radiograph\w*|dental|dentist\w*|veterinar\w*|midwi\w*|optometr\w*|paramedic\w*|psycholog\w*|public health|digital health|occupational therap\w*|dietit\w*|nutrition\w*|speech and language|sports? scien\w*|exercise scien\w*)\b/i,
  environmental: /\b(environment(al)?|ecolog\w*|marine (biolog|scien|conservation|environment|survey)\w*|conservation|sustainab\w*|climate|wildlife|ocean\w*|geolog\w*|geoscien\w*|earth scien\w*|hydrolog\w*|water (science|quality|resources)|fisheries|aquacult\w*|biodiversity|zoolog\w*|net zero)\b/i,
};

const SHORT_WORD: Record<string, string> = {
  mechanical: "Mechanical", manufacturing: "Manufacturing", robotics: "Robotics", electrical: "Electrical", aerospace: "Aerospace",
  automotive: "Automotive", materials: "Materials", civil: "Civil", chemical: "Chemical", software: "Computing", business: "Business",
  biomedical: "Biomedical", life_sciences: "Life sciences", healthcare: "Healthcare", environmental: "Environmental",
  engineering: "Engineering", science: "Science",
};
const GENERIC = new Set(["engineering", "science"]);

/**
 * Facts about how a role fits, no score or label (owner, 17 Oct). Ticks: "Mechanical in the title"
 * (your degree), "Asks for mechanical engineering", "Chemical engineering" (another subject in your
 * field), "Engineering role" (no field named), "Any subject", your industry. CV skills aren't used:
 * most adverts don't list them. `why` says the same in sentences for the drawer. `rank` only orders
 * things: 2 = your degree in the title, 1 = your degree in the advert or your industry, 0 = the rest.
 * Mirrored in radar/match.py `fit`.
 */
export function fitRole(row: OpportunityRow, prefs: Preferences, filters: MatchFilters) {
  const degree = prefs.degrees[0] ?? "degree";
  const mine = new Set(degreeDisciplines(prefs));
  const tags = row.disciplines ?? [];
  const own = tags.filter((d) => mine.has(d) && !GENERIC.has(d));
  const other = tags.filter((d) => filters.disciplines.includes(d) && !mine.has(d) && !GENERIC.has(d));
  const inTitle = own.find((d) => TITLE_DISCIPLINE[d]?.test(row.title));
  const ticks: string[] = [];
  const why: string[] = [];
  if (inTitle) {
    ticks.push(`${SHORT_WORD[inTitle] ?? inTitle} in the title`);
    why.push(`${DISCIPLINE_WORD[inTitle] ?? inTitle} is in the title, and it's part of your ${degree}`);
  } else if (own.length) {
    ticks.push(`Asks for ${(DISCIPLINE_WORD[own[0]] ?? own[0]).toLowerCase()}`);
    why.push(`The advert asks for ${(DISCIPLINE_WORD[own[0]] ?? own[0]).toLowerCase()}, part of your ${degree}`);
  } else if (other.length) {
    ticks.push(DISCIPLINE_WORD[other[0]] ?? other[0]);
    why.push(`${DISCIPLINE_WORD[other[0]] ?? other[0]}: another subject in your field, outside your ${degree}`);
  } else if (tags.some((d) => GENERIC.has(d) && filters.disciplines.includes(d))) {
    const general = tags.find((d) => GENERIC.has(d)) ?? "engineering";
    ticks.push(`${SHORT_WORD[general]} role`);
    why.push(`A general ${general} role: the title doesn't name a field, so check what it involves`);
  } else if (row.kind === "event" && !tags.length) {
    ticks.push("Any subject");
    why.push("Open to students of any subject");
  }
  const industry = prefs.sectors.length ? industryMatch(prefs.sectors, row.company_name, `${row.title} ${row.company_name} ${(row.description ?? "").slice(0, 800)}`) : null;
  if (industry) {
    ticks.push(industry);
    why.push(`${industry} is one of your industries`);
  }
  if (row.skills?.length) why.push(`Asks for ${row.skills.slice(0, 3).join(", ")}`);
  if (row.rolling) why.push("Rolling applications, so applying early matters");
  if (!why.length) why.push("Posted on the employer's own site");
  return { rank: inTitle ? 2 : own.length || industry ? 1 : 0, ticks, why: why.slice(0, 4) };
}

const YEARS = /\b20\d\d\b/g;
const COMPANY_WORDS = /\b(ltd|limited|plc|llp|inc|group|uk|gmbh|co|the|and|ireland|services|holdings)\b/g;
const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

/** (title, employer) with years, punctuation and company suffixes removed; employer "" when a job
 *  site didn't say ("via Bright Network"). Mirrored in radar/notify/personal.py `same_role_key`. */
export function sameRoleKey(title: string, company: string): [string, string] {
  const c = company.toLowerCase().startsWith("via ") ? "" : norm(company.toLowerCase().replace(COMPANY_WORDS, " "));
  return [norm(title.replace(YEARS, " ")), c];
}

export function isSameRole([title, company]: [string, string], [t, c]: [string, string]): boolean {
  return t === title && (!c || !company || c.startsWith(company) || company.startsWith(c));
}

export function toView(row: OpportunityRow, prefs: Preferences, filters: MatchFilters, now: number): OpportunityView {
  const kind = kindView(row);
  const { ticks, why } = fitRole(row, prefs, filters);

  const source = host(row.apply_url);
  const contact = row.published_contacts?.[0];
  // Adverts often list an email for questions: that is a published contact too
  const advertEmail = row.description?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0];
  // Job-site emails and job boards can't say when a role opened (they resend old ones), so they're
  // never "just opened"; a role first listed over a day before Nimbus found it says so
  const jobSite = row.source_kind === "inbox" || row.source_kind === "adzuna" || row.source_kind === "reed";
  const opened = row.opened_at ?? row.first_seen_at;
  const openedAge = now - new Date(opened).getTime();
  const listedEarlier = new Date(row.first_seen_at).getTime() - new Date(opened).getTime() > 24 * HOUR;
  const abroad = !!row.country && row.country !== "GB" && row.country !== "IE";

  return {
    id: row.id,
    title: row.title,
    company: row.company_name,
    initial: (row.company_name.trim()[0] ?? "?").toUpperCase(),
    logo: source && !NOT_EMPLOYER.test(source) ? `https://www.google.com/s2/favicons?sz=64&domain=${siteOf(source)}` : null,
    loc: (row.location_text || (row.country === "GB" ? "United Kingdom" : (row.country ?? "Location not given"))) + (abroad ? " (abroad)" : ""),
    type: kind.type,
    tone: kind.tone,
    // No opening date: from a job site's "closing soon" reminder email, so it has been open a while
    found: row.opened_at === null && jobSite ? "from a closing-soon email"
      : listedEarlier ? `listed since ${shortDate(opened)}` : jobSite ? `found ${timeAgo(row.first_seen_at, now)}` : `posted ${timeAgo(opened, now)}`,
    isNew: !jobSite && openedAge < 6 * HOUR,
    via: row.source_kind === "adzuna" ? "Adzuna" : row.source_kind === "reed" ? "Reed" : row.source_kind === "inbox" ? (JOB_SITES.find(([re]) => re.test(row.apply_url))?.[1] ?? "a job site") : null,
    ticks,
    why,
    deadline: row.closes_at
      ? new Date(row.closes_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : row.rolling
        ? "Rolling"
        : "Not stated",
    closing: row.closes_at
      ? `closes ${new Date(row.closes_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`
      : row.rolling
        ? "rolling"
        : "",
    source: source || "employer site",
    applyUrl: row.apply_url,
    contact: contact?.label || contact?.value || advertEmail || "Not published yet",
    contactNote: contact ? "Listed by the employer" : advertEmail ? "Email in the job advert" : "Shown here once the employer lists one",
    advert: (row.description ?? "").replace(/\s+/g, " ").trim().slice(0, 1500),
  };
}
