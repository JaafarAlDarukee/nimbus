/**
 * The easy path in CV studio: turn an uploaded CV into the Nimbus template (cvFromText), then
 * tailor it to one advert (tailorCv). No AI: the same keyword rules as the checker, so every change
 * can be explained in a sentence, and nothing is made up.
 */
import { blankCv, uploadedLines, type BuiltCv, type Experience } from "@/lib/cv";
import { EVIDENCE, SOFT, keywordsIn } from "@/lib/keywords";

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Summer|Spring|Autumn|Winter)";
const WHEN = `(?:${MONTH}\\.?\\s+)?(?:19|20)\\d{2}`;
const DATES = new RegExp(`(?:${MONTH}\\.?\\s*[–-]\\s*)?${WHEN}(?:\\s*(?:[–-]|to)\\s*(?:${WHEN}|${MONTH}\\.?|present|now|current|ongoing))?`, "i");
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE = /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/;
const LINKEDIN = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?/i;
const BULLET = /^•\s*/;
// Skills a bullet can prove beyond doubt with other words (see EVIDENCE); softer ones are left to the student
const PROVABLE = new Set(["Machining", "CNC", "CAD", "FEA", "CFD", "3D printing", "Additive manufacturing", "Technical drawings", "Prototyping", "Electronics", "Arduino", "Statistics"]);

type Section = "education" | "work" | "project" | "skills" | "other";

function sectionOf(heading: string): Section {
  if (/educat|qualif|academic/i.test(heading)) return "education";
  if (/project/i.test(heading)) return "project";
  if (/skill|software|technical/i.test(heading)) return "skills";
  if (/experience|employment|work|leadership|activit|volunteer|position|extra/i.test(heading)) return "work";
  return "other";
}

/** "Role — Company | Place  Jun 2025 – Present" → its parts. */
function entryParts(line: string): { role: string; org: string; place: string; dates: string } {
  const dates = (line.match(DATES)?.[0] ?? "").trim();
  const rest = line.replace(dates, " ").replace(/\s+/g, " ").replace(/[\s|,–—-]+$/, "").trim();
  const parts = rest.split(/\s+[—–|]\s+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  return { role: parts[0] ?? rest, org: parts[1] ?? "", place: parts.slice(2).join(", "), dates };
}

/** An uploaded CV (its text) as the template's fields. Anything it can't place is left for the student. */
export function cvFromText(text: string, fallback: Partial<BuiltCv> = {}): BuiltCv {
  const cv: BuiltCv = { ...blankCv(), ...fallback, skills: [], exp: [] };
  let section: Section = "other";
  let current: Experience | null = null;
  let educationDone = false;

  for (const line of uploadedLines(text)) {
    const t = line.t.replace(BULLET, "").trim();
    if (line.kind === "name") {
      cv.name = t.replace(/\b([A-Z])([A-Z']+)\b/g, (_, a: string, b: string) => a + b.toLowerCase());
      continue;
    }
    if (line.kind === "contact") {
      cv.email = t.match(EMAIL)?.[0] ?? cv.email;
      cv.phone = t.match(PHONE)?.[0] ?? cv.phone;
      cv.linkedin = t.match(LINKEDIN)?.[0]?.replace(/^https?:\/\/(www\.)?/i, "") ?? cv.linkedin;
      const town = t.split(/\s*[|•·]\s*/).find((p) => p && !/\d|@|linkedin|github|http/i.test(p));
      if (town) cv.address = town;
      continue;
    }
    if (line.kind === "h") {
      section = sectionOf(t);
      current = null;
      continue;
    }

    if (section === "education") {
      if (line.kind === "p" && !educationDone && !cv.uni) {
        const { role, org, dates } = entryParts(t);
        cv.uni = role;
        cv.degree = org || cv.degree;
        cv.dates = dates || cv.dates;
      } else if (line.kind === "p") {
        educationDone = true; // a college or school after the university: the template keeps the degree only
      } else if (!educationDone && /(2:1|2:2|first|1st|grade|result|predicted|average|gpa|distinction|\d{2}%)/i.test(t)) {
        cv.grade = t.replace(/^(year \d )?(result|grade|predicted)s?:?\s*/i, "");
      } else if (!educationDone && /modules?|core study|relevant|courses?|study/i.test(t)) {
        cv.modules = t.replace(/^[^:]{0,40}:\s*/, "").replace(/\.$/, "");
      }
      continue;
    }

    if (section === "skills") {
      for (const s of t.replace(/^[^:,]{0,30}:\s*/, "").split(/\s*[,;|•]\s*|\s+and\s+/)) {
        const skill = s.replace(/[.()]/g, "").trim();
        if (skill.length >= 2 && skill.length <= 40 && !cv.skills.includes(skill)) cv.skills.push(skill);
      }
      continue;
    }

    if (section === "work" || section === "project") {
      if (line.kind === "b") {
        if (!current) {
          current = { role: "", org: "", dates: "", bullets: "", on: true, kind: section };
          cv.exp.push(current);
        }
        current.bullets = current.bullets ? `${current.bullets}\n${t}` : t;
      } else if (current && !current.bullets && !current.org) {
        // A second header line before any bullets: usually the company and place
        const { role, org, dates } = entryParts(t);
        current.org = role;
        current.place = org || current.place;
        current.dates = current.dates || dates;
      } else {
        const { role, org, place, dates } = entryParts(t);
        current = { role, org, place, dates, bullets: "", on: true, kind: section };
        cv.exp.push(current);
      }
    }
  }
  cv.name = cv.name || fallback.name || "";
  return cv;
}

const STRONG = /^(designed|built|developed|led|managed|created|reduced|increased|improved|optimi[sz]ed|analy[sz]ed|tested|validated|modell?ed|simulated|machined|manufactured|assembled|programmed|automated|implemented|delivered|cut|saved|achieved|won|coordinated|organi[sz]ed|researched|investigated|calculated|prototyped|fabricated|wrote|presented|trained|mentored|redesigned|engineered|planned|diagnosed|resolved|produced|conducted|evaluated|measured)\b/i;

function bulletScore(b: string, wanted: string[]): number {
  const found = keywordsIn(b).filter((k) => wanted.includes(k)).length;
  const shown = wanted.filter((k) => EVIDENCE[k]?.test(b)).length;
  return found * 3 + shown + (/\d/.test(b) ? 1.5 : 0) + (STRONG.test(b) ? 1 : 0);
}

const lines = (x: Experience) => x.bullets.split("\n").map((b) => b.trim()).filter(Boolean);
const label = (x: Experience) => x.role || x.org || "an entry";

/**
 * Tailor a CV to one advert: strongest bullet first in each entry, the advert's skills that the
 * CV already shows added to Skills, soft skills moved out of Skills, and (only if it won't fit on
 * one page) the entries with nothing for this job left out. Returns what changed, in plain words.
 */
export function tailorCv(input: BuiltCv, advert: string): { cv: BuiltCv; changes: string[] } {
  const wanted = keywordsIn(advert);
  const changes: string[] = [];
  const cv: BuiltCv = { ...input, skills: [...input.skills], exp: input.exp.map((x) => ({ ...x })) };

  for (const x of cv.exp) {
    const before = lines(x);
    const after = [...before].sort((a, b) => bulletScore(b, wanted) - bulletScore(a, wanted));
    if (after.join("\n") !== before.join("\n")) {
      x.bullets = after.join("\n");
      changes.push(`Moved the bullet that fits this job best to the top of “${label(x)}”.`);
    }
  }

  const everything = [cv.modules ?? "", ...cv.exp.map((x) => `${x.role} ${x.org} ${x.bullets}`)].join("\n");
  const have = new Set(cv.skills.map((s) => s.toLowerCase()));
  const proven = keywordsIn(everything).filter((k) => wanted.includes(k) && !SOFT.has(k) && !have.has(k.toLowerCase()));
  if (proven.length) {
    cv.skills.push(...proven);
    changes.push(`Added ${proven.join(", ")} to Skills: the advert asks for ${proven.length > 1 ? "them" : "it"} and your bullets already show ${proven.length > 1 ? "them" : "it"}.`);
  }
  // Hard skills a bullet clearly proves in other words ("machined on lathes" is Machining): add the
  // advert's own word, since screening software looks for that exact word
  for (const k of wanted.filter((k) => PROVABLE.has(k) && !cv.skills.some((s) => s.toLowerCase() === k.toLowerCase()))) {
    const line = cv.exp.flatMap(lines).find((l) => EVIDENCE[k]?.test(l));
    if (!line) continue;
    cv.skills.push(k);
    changes.push(`Added ${k} to Skills, in the advert's own word: your “${line.slice(0, 60).trim()}…” shows it.`);
  }
  // Listed soft skills only earn their place when the advert asks for them (screening software counts them)
  const soft = cv.skills.filter((s) => SOFT.has(s) && !wanted.includes(s));
  if (soft.length) {
    cv.skills = cv.skills.filter((s) => !soft.includes(s));
    changes.push(`Took ${soft.join(", ")} out of Skills. Recruiters skip listed soft skills: show them in a bullet instead.`);
  }

  // About 18 bullets fill one page with the template; beyond that, leave out what doesn't fit this job
  const relevance = (x: Experience) => lines(x).reduce((sum, b) => sum + bulletScore(b, wanted), 0) + keywordsIn(`${x.role} ${x.org}`).filter((k) => wanted.includes(k)).length * 3;
  let total = cv.exp.filter((x) => x.on).reduce((n, x) => n + lines(x).length, 0);
  const leastRelevant = cv.exp.filter((x) => x.on).sort((a, b) => relevance(a) - relevance(b));
  for (const x of leastRelevant) {
    if (total <= 18) break;
    if (relevance(x) >= 4) break;
    x.on = false;
    total -= lines(x).length;
    changes.push(`Left out “${label(x)}” for this job so the CV fits on one page (tick it to bring it back).`);
  }
  if (!changes.length) changes.push("Your CV was already in good order for this job.");
  return { cv, changes };
}
