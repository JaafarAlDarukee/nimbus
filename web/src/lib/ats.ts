/**
 * The ATS checker: scores a CV against a job advert the way screening software and recruiters read
 * it, using the r/EngineeringResumes rules. Four areas, as in the design (Profile ATS bars):
 * keywords for this role, parsing and layout, measurable impact, sections and length.
 * Pure functions: the same report for an uploaded file or a CV built in CV studio.
 */
import { evidenceFor, keywordsIn } from "@/lib/keywords";

export type CvFacts = {
  /** The CV as text, one line per line */
  text: string;
  /** From an uploaded PDF: pages, and whether text sat in side-by-side columns */
  pages?: number;
  columns?: boolean;
  fileName?: string;
};

export type AtsIssue = { area: Area; severity: "fix" | "improve"; title: string; detail: string; lines?: string[] };
type Area = "keywords" | "layout" | "impact" | "sections";

export type AtsReport = {
  score: number;
  areas: { key: Area; label: string; score: number }[];
  matched: string[];
  missing: string[];
  issues: AtsIssue[];
  bullets: { text: string; hasNumber: boolean; strongStart: boolean }[];
};

const STRONG_VERBS =
  /^(designed|built|developed|led|managed|created|reduced|increased|improved|optimi[sz]ed|analy[sz]ed|tested|validated|modelled|modeled|simulated|machined|manufactured|assembled|programmed|automated|implemented|delivered|launched|cut|saved|achieved|won|coordinated|organi[sz]ed|researched|investigated|calculated|prototyped|fabricated|wrote|presented|trained|mentored|redesigned|streamlined|integrated|installed|commissioned|diagnosed|resolved|produced|drafted|conducted|evaluated|measured|characteri[sz]ed|lowered|raised|halved|doubled|engineered|planned|scheduled|supervised|captained|founded|initiated)\b/i;
const WEAK_START = /^(responsible for|helped|assisted|worked on|involved in|duties included|tasked with|participated in|was|did)\b/i;
const PRONOUNS = /\b(I|me|my|myself)\b/;
// "three to four days a week", "halved", "a dozen" are results too
const NUMBER = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundreds?|thousands?|dozens?|half|halved|double[ds]?|twice|tripled?)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE = /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b|\+?\d[\d\s()-]{8,}\d/;
const LINKEDIN = /linkedin\.com\/in\//i;
const SECTION = (name: RegExp) => new RegExp(`^\\s*(${name.source})\\s*:?\\s*$`, "im");
const SECTIONS = {
  education: SECTION(/education|academic background|qualifications/),
  experience: SECTION(/experience|work experience|employment|professional experience|relevant experience|leadership( (and|&) activities)?|volunteering/),
  projects: SECTION(/projects|technical projects|engineering projects|personal projects/),
  skills: SECTION(/skills|technical skills|skills and interests|software/),
  summary: SECTION(/summary|profile|personal statement|objective|about me/),
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function atsReport(cv: CvFacts, advert: string, jobTitle = ""): AtsReport {
  const lines = cv.text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.join("\n");
  const lower = text.toLowerCase();
  const issues: AtsIssue[] = [];

  // 1. Keywords for this role: the advert's skills and tools found in the CV
  const wanted = keywordsIn(advert);
  const have = new Set(keywordsIn(text));
  const matched = wanted.filter((k) => have.has(k));
  const missing = wanted.filter((k) => !have.has(k));
  const titleWords = jobTitle.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !["intern", "internship", "placement", "graduate", "student", "summer"].includes(w));
  const titleHit = titleWords.length === 0 || titleWords.some((w) => lower.includes(w));
  const keywords = wanted.length ? (matched.length / wanted.length) * 90 + (titleHit ? 10 : 0) : 0;
  if (!advert.trim()) {
    issues.push({ area: "keywords", severity: "fix", title: "Add the job advert", detail: "Paste the advert (or pick a saved role) so the check knows which keywords this employer screens for." });
  } else if (!wanted.length) {
    issues.push({
      area: "keywords",
      severity: "fix",
      title: "No skills found in this advert",
      detail: "Paste the full advert, including the requirements or \u201cwhat you\u2019ll need\u201d part. The check looks for skills like CAD, MATLAB, Python, Lean or lab techniques; without them it can\u2019t score keywords.",
    });
  } else if (missing.length) {
    // Skills the CV already shows in other words: the quickest wins, since the student did them
    const shown = missing.map((k) => ({ k, line: evidenceFor(k, lines) })).filter((x): x is { k: string; line: string } => !!x.line);
    const absent = missing.filter((k) => !shown.some((x) => x.k === k));
    if (shown.length)
      issues.push({
        area: "keywords",
        severity: "fix",
        title: `You show ${shown.length} of the missing skill${shown.length > 1 ? "s" : ""}, in other words`,
        detail: `Screening software looks for the advert's exact words. Use ${shown.map((x) => `“${x.k}”`).slice(0, 5).join(", ")} in these lines and in Technical Skills.`,
        lines: shown.slice(0, 4).map((x) => `${x.k}: ${x.line.replace(/^[•●▪◦\-*–]\s*/, "")}`),
      });
    if (absent.length)
      issues.push({
        area: "keywords",
        severity: absent.length > 3 ? "fix" : "improve",
        title: `${absent.length} keyword${absent.length > 1 ? "s" : ""} from the advert missing`,
        detail: `Add ${absent.slice(0, 6).join(", ")} where you genuinely used them: in a bullet that shows how, and in Technical Skills. Never add one you can't talk about in an interview.`,
      });
  }
  if (wanted.length && !titleHit) {
    issues.push({ area: "keywords", severity: "improve", title: "The role's own words don't appear", detail: `Use words from the job title ("${jobTitle}") where they're true, for example in a project or experience line.` });
  }

  // 2. Measurable impact: bullets under experience and projects that start strong and show a result
  // (course lists under Education and lists of skills aren't achievements)
  let section = "";
  const bullets: AtsReport["bullets"] = [];
  for (const l of lines) {
    const heading = (Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).find((k) => SECTIONS[k].test(l));
    if (heading) {
      section = heading;
      continue;
    }
    if (section === "education" || section === "skills" || section === "summary") continue;
    if (!/^[•●▪◦\-*–]/.test(l) && !(l.length > 40 && STRONG_VERBS.test(l))) continue;
    const text = l.replace(/^[•●▪◦\-*–]\s*/, "");
    bullets.push({ text, hasNumber: NUMBER.test(text), strongStart: STRONG_VERBS.test(text) });
  }
  const withNumbers = bullets.filter((b) => b.hasNumber).length;
  const strong = bullets.filter((b) => b.strongStart).length;
  const weak = bullets.filter((b) => WEAK_START.test(b.text));
  const impact = bullets.length ? (withNumbers / bullets.length) * 65 + (strong / bullets.length) * 35 : 0;
  if (!bullets.length) {
    issues.push({ area: "impact", severity: "fix", title: "No bullet points found", detail: "Under each role and project, write 2 to 4 bullets: what you did, with what, and the result." });
  } else {
    const noNumber = bullets.filter((b) => !b.hasNumber);
    if (noNumber.length)
      issues.push({
        area: "impact",
        severity: noNumber.length > bullets.length / 2 ? "fix" : "improve",
        title: `${noNumber.length} of ${bullets.length} bullets have no number`,
        detail: "Add a result: a percentage, time or money saved, parts made, a tolerance, a team size. Use the XYZ shape: did X, measured by Y, by doing Z.",
        lines: noNumber.slice(0, 4).map((b) => b.text),
      });
    if (weak.length)
      issues.push({
        area: "impact",
        severity: "improve",
        title: `${weak.length} bullet${weak.length > 1 ? "s start" : " starts"} weakly`,
        detail: "Start with a past-tense action verb (Designed, Machined, Reduced, Tested) instead of “Responsible for” or “Helped”.",
        lines: weak.slice(0, 3).map((b) => b.text),
      });
  }

  // 3. Parsing and layout: can software read it in order?
  let layout = 100;
  if (cv.columns) {
    layout -= 35;
    issues.push({ area: "layout", severity: "fix", title: "Two columns detected", detail: "Screening software often reads columns across the page and jumbles your CV. Use one column (the Nimbus template does)." });
  }
  if (cv.pages && cv.pages > 1) {
    layout -= 20;
    issues.push({ area: "layout", severity: "fix", title: `${cv.pages} pages`, detail: "Students should fit on one page. Cut older or less relevant points first." });
  }
  if (PRONOUNS.test(text)) {
    layout -= 10;
    issues.push({ area: "layout", severity: "improve", title: "Uses “I” or “my”", detail: "CVs leave out personal pronouns: “Designed a gearbox…”, not “I designed…”." });
  }
  if (cv.text.length < 400) {
    layout -= 40;
    issues.push({ area: "layout", severity: "fix", title: "Very little text could be read", detail: "If your CV is a scan or a picture, screening software sees almost nothing. Export it from Word or Google Docs as a text PDF." });
  }
  if (cv.fileName && !/\.(pdf|docx)$/i.test(cv.fileName)) {
    layout -= 10;
    issues.push({ area: "layout", severity: "improve", title: "Send PDF or Word", detail: "Use .pdf (or .docx if the employer asks)." });
  }

  // 4. Sections and length
  let sections = 100;
  const has = (k: keyof typeof SECTIONS) => SECTIONS[k].test(text);
  for (const [key, label] of [["education", "Education"], ["experience", "Experience"], ["skills", "Technical Skills"]] as const) {
    if (!has(key)) {
      sections -= 18;
      issues.push({ area: "sections", severity: "fix", title: `No ${label} section`, detail: `Add a heading called “${label}” so software files your details in the right place.` });
    }
  }
  if (!has("projects")) {
    sections -= 8;
    issues.push({ area: "sections", severity: "improve", title: "No Projects section", detail: "Engineering students should show projects (Formula Student, coursework, personal builds) with what you made and the result." });
  }
  if (has("summary")) {
    sections -= 5;
    issues.push({ area: "sections", severity: "improve", title: "Summary at the top", detail: "The r/EngineeringResumes guide drops the summary for students: use the space for a project instead." });
  }
  if (!EMAIL.test(text) || !PHONE.test(text)) {
    sections -= 15;
    issues.push({ area: "sections", severity: "fix", title: "Contact details incomplete", detail: "Put your phone and email under your name (and LinkedIn if you have one). No full address or photo." });
  } else if (!LINKEDIN.test(text)) {
    issues.push({ area: "sections", severity: "improve", title: "No LinkedIn link", detail: "Add linkedin.com/in/your-name next to your email." });
  }
  const words = text.split(/\s+/).length;
  if (words > 750) {
    sections -= 10;
    issues.push({ area: "sections", severity: "improve", title: `${words} words`, detail: "Aim for about 400 to 650 words so it fits one page and gets read." });
  }

  const areas = [
    { key: "keywords" as const, label: "Keywords for this role", score: clamp(keywords) },
    { key: "layout" as const, label: "Parsing and layout", score: clamp(layout) },
    { key: "impact" as const, label: "Measurable impact", score: clamp(impact) },
    { key: "sections" as const, label: "Sections and length", score: clamp(sections) },
  ];
  // Keywords count most: they decide whether a person ever sees the CV
  const score = clamp(areas[0].score * 0.4 + areas[1].score * 0.2 + areas[2].score * 0.25 + areas[3].score * 0.15);
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "fix" ? -1 : 1));
  return { score, areas, matched, missing, issues, bullets };
}
