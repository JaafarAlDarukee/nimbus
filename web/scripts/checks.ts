/**
 * Smoke checks for the website's logic: matching for every degree, the CV checker, reading and
 * tailoring an uploaded CV, prompts, the example CV and LinkedIn tips. No network, no database.
 *
 *   cd web && npx tsx scripts/checks.ts
 */
import { fitRole, isSameRole, kindView, sameRoleKey, toView, type OpportunityRow } from "../src/lib/opportunity-view";
import { matchFilters, withDefaults, DEGREE_DISCIPLINES } from "../src/lib/preferences";
import { DEGREES_BY_FIELD, DEFAULT_TYPES } from "../src/lib/onboarding-data";
import { analyse, attachPrompt, cvHtml, cvLines, tailorPrompt, type CvJob } from "../src/lib/cv";
import { cvFromText, tailorCv } from "../src/lib/cv-tailor";
import { EXAMPLE_CV, EXAMPLE_NOTES } from "../src/lib/cv-example";
import { keywordsIn } from "../src/lib/keywords";
import { peopleToFind, shortDegree } from "../src/components/apply-tips";
import { PRICE, TRIAL_CVS, TRIAL_JOBS, accessState, payLink, timeLeft } from "../src/lib/access";
import { safeNext } from "../src/lib/next-path";

let ok = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) ok++;
  else {
    fail++;
    console.log("FAIL", name, detail);
  }
};

// Every degree in onboarding has subject tags and sensible filters
for (const [field, degrees] of Object.entries(DEGREES_BY_FIELD)) {
  for (const d of degrees) {
    check(`tags ${d}`, !!DEGREE_DISCIPLINES[d]);
    const f = matchFilters(withDefaults({ field, degrees: [d] }));
    check(`filters ${d}`, f.disciplines.length > 0 && f.kinds.includes("event") && f.countries?.includes("GB") === true);
  }
}
check("typed degree falls back to its field", matchFilters(withDefaults({ field: "Science", degrees: ["Astrobiology"] })).disciplines.includes("life_sciences"));
check("Expo is a default type", DEFAULT_TYPES.includes("Expo or careers fair"));

// The CV checker
const base: CvJob = { id: "t", title: "Mechanical Design Placement", company: "Acme Engineering", link: "", jd: "", jdName: null, mode: "build", cvName: null, cvText: null, cvMeta: null, cv: EXAMPLE_CV, step: 4 };
const jd = "Mechanical design placement. You will use SolidWorks, FEA and MATLAB, support Lean and 5S, read technical drawings, CNC machining, and work with Excel.";
check("example CV scores high", analyse({ ...base, jd }).score >= 80, String(analyse({ ...base, jd }).score));
check("junk advert gives no keyword credit", analyse({ ...base, jd: "blah blah nothing" }).report.areas[0].score === 0);
check("example notes all land", EXAMPLE_NOTES.every((n) => cvLines(base).some((l) => l.t.startsWith(n.starts))));

// Reading an uploaded CV into the template, then tailoring it
const text = `ALEX SAMPLE
Leeds, UK | 07700 900000 | alex.sample@example.ac.uk
EDUCATION
University of Leeds — BEng (Hons) Mechanical Engineering 2024 – 2028
• Year 1 result: 2:1
ENGINEERING PROJECTS
Catapult Build — Design Challenge Feb – Apr 2026
• Used first-principles calculations with the team to set launch angles, then
checked them against test results.
• Kept the bill of materials up to date in Excel, helping cut the build cost by 30%.
Clock Build — University Workshop Sept – Dec 2025
• Machined clock parts from aluminium on manual lathes and milling machines.
EXPERIENCE
Work Experience — Acme Construction | Leeds Feb 2024
• Surveyed a proposed site with a team of 4, then presented the recommended layout.
TECHNICAL SKILLS
Software: SolidWorks, MATLAB, Python
Teamwork, Communication, 3D printing`;
const parsed = cvFromText(text);
check("upload: name", parsed.name === "Alex Sample", parsed.name);
check("upload: email", parsed.email === "alex.sample@example.ac.uk");
check("upload: university", parsed.uni === "University of Leeds", parsed.uni);
check("upload: entries", parsed.exp.length === 3, String(parsed.exp.length));
check("upload: wrapped bullet joined", parsed.exp[0].bullets.includes("then checked them"));
check("upload: skills split", parsed.skills.includes("Python") && parsed.skills.includes("Teamwork"), parsed.skills.join("|"));
const t = tailorCv(parsed, jd);
check("tailor adds proven skills", t.cv.skills.includes("Excel") && t.cv.skills.includes("Machining"), t.cv.skills.join("|"));
check("tailor drops unasked soft skills", !t.cv.skills.includes("Communication"));
check("prompt leaves out contact details", !tailorPrompt(cvLines({ ...base, cv: parsed }), jd, "x", "y", []).includes("alex.sample@example.ac.uk"));
check("attach prompt includes the advert", attachPrompt(jd, "Mechanical Design Placement", "Acme", []).includes("SolidWorks"));
check("printable CV renders", cvHtml(cvLines(base), "x").includes("Sam Taylor"));

// Small helpers
check("acronyms only in capitals", !keywordsIn("we sell spices").includes("SPICE") && keywordsIn("simulated in SPICE").includes("SPICE"));
check("short degree", shortDegree("BEng (Hons) Mechanical Engineering (with Foundation Year)") === "Mechanical Engineering");
check("LinkedIn searches", peopleToFind("Jaguar Land Rover", "Industrial Placement 2027: Mechanical", "University of Leeds").length === 4);
check("card labels", kindView({ kind: "event", title: "DurHack" }).type === "Hackathon" && kindView({ kind: "event", title: "Lab Innovations 2026 (expo)" }).type === "Expo");

// Match: facts only (no % or label, no CV skills), every type and the whole field (owner, 17 Oct), each role once
const mechPrefs = withDefaults({ field: "Engineering", degrees: ["Mechanical Engineering"], types: ["Placement"], sectors: ["Automotive"] });
const mechFilters = matchFilters(mechPrefs);
const role = (title: string, disciplines: string[], extra: Partial<OpportunityRow> = {}) =>
  ({ id: "r", title, company_name: "Jaguar Land Rover", kind: "placement", disciplines, skills: ["CAD", "MATLAB"], country: "GB", ...extra }) as OpportunityRow;
check("UK and Ireland only, whatever was picked before", JSON.stringify(matchFilters(withDefaults({ abroad: ["Worldwide", "Germany", "USA"] })).countries) === JSON.stringify(["GB", "IE"]));
check("every type shows", ["placement", "apprenticeship", "grad_scheme", "graduate_job", "event"].every((k) => mechFilters.kinds.includes(k)));
check("the whole field shows, plus the channel's computing and science", ["chemical", "civil", "electrical", "engineering", "software", "science"].every((d) => mechFilters.disciplines.includes(d)) && !mechFilters.disciplines.includes("healthcare"));
const own = fitRole(role("Industrial Placement 2027: Mechanical", ["mechanical"]), mechPrefs, mechFilters);
check("fit: your degree in the title", own.rank === 2 && own.ticks[0] === "Mechanical in the title" && !own.ticks.some((t) => t.includes("CV")), `${own.rank} ${own.ticks}`);
check("fit: another subject in your field", fitRole(role("Chemical Engineer Placement", ["chemical"], { company_name: "Acme Ltd" }), mechPrefs, mechFilters).ticks[0] === "Chemical engineering");
const generic = fitRole(role("Placement Student - Quality", ["engineering"], { company_name: "Acme Ltd", skills: [] }), mechPrefs, mechFilters);
check("fit: general engineering role", generic.rank === 0 && generic.ticks[0] === "Engineering role", `${generic.rank} ${generic.ticks}`);
check("fit: computing for an engineer says so", fitRole(role("Cyber Security Placement", ["software"], { company_name: "Acme Ltd" }), mechPrefs, mechFilters).ticks[0] === "Software");
check("fit: outside the field has no subject tick", fitRole(role("Staff Nurse Placement", ["healthcare"], { company_name: "Acme Ltd" }), mechPrefs, mechFilters).ticks.length === 0);
check("fit: film production isn't manufacturing in the title", fitRole(role("Post Production Technology Internship", ["manufacturing"]), withDefaults({ degrees: ["Mechanical Engineering"] }), matchFilters(withDefaults({ degrees: ["Mechanical Engineering"] }))).ticks[0] !== "Manufacturing in the title");
check("same role from two places", isSameRole(sameRoleKey("Industrial Placement - Vehicle Motion", "Bentley Motors Ltd"), sameRoleKey("Industrial Placement Vehicle Motion 2027", "via Bright Network")));
check("same title, other employer is new", !isSameRole(sameRoleKey("Mechanical Engineering Industrial Placement", "Phillips 66"), sameRoleKey("Mechanical Engineering Industrial Placement", "Cummins")));

// After signing in: back to the role a Telegram alert opened, never to another site
check("return to the role", safeNext("/?open=abc") === "/?open=abc");
check("never another site", [null, "", "//evil.example", "/\\evil.example", "https://evil.example", "/login?next=/", "/auth/callback"].every((v) => safeNext(v) === null));

// Newest by when roles really opened (owner, 18 Oct: a Gradcracker email resent a Caterpillar placement from September)
const NOW = Date.parse("2026-10-18T17:20:00Z");
const resent = toView(role("Manufacturing Engineering (12 Month Placement Scheme)", ["manufacturing"], {
  company_name: "Caterpillar Uk Ltd", source_kind: "inbox", apply_url: "https://www.gradcracker.com/hub/219/caterpillar-uk-ltd/work-placement-internship/83716/x",
  first_seen_at: "2026-10-18T17:08:00Z", opened_at: "2026-09-30T17:10:00Z" }), mechPrefs, mechFilters, NOW);
check("resent role: not just opened, says since when, and where from", !resent.isNew && resent.found.startsWith("listed since 30 Sep") && resent.via === "Gradcracker", `${resent.isNew} ${resent.found} ${resent.via}`);
const emailed = toView(role("Graduate Engineer", ["engineering"], { source_kind: "inbox", apply_url: "https://www.brightnetwork.co.uk/graduate-jobs/acme/x", first_seen_at: "2026-10-18T17:00:00Z", opened_at: "2026-10-18T17:00:00Z" }), mechPrefs, mechFilters, NOW);
check("job-site email: never 'just opened'", !emailed.isNew && emailed.found === "found 20m ago" && emailed.via === "Bright Network", `${emailed.found}`);
const direct = toView(role("Mechanical Engineering Placement", ["mechanical"], { source_kind: "workday", apply_url: "https://acme.wd3.myworkdayjobs.com/x", first_seen_at: "2026-10-18T17:05:00Z", opened_at: "2026-10-18T16:50:00Z" }), mechPrefs, mechFilters, NOW);
check("employer's own site: just opened", direct.isNew && direct.found === "posted 30m ago", direct.found);
check("abroad roles say so", toView(role("Graduate Engineer", ["engineering"], { country: "DE", location_text: "Munich", first_seen_at: "2026-10-18T17:00:00Z", opened_at: null }), mechPrefs, mechFilters, NOW).loc === "Munich (abroad)");
check("defence hidden unless turned on", mechFilters.defence === false && matchFilters(withDefaults({ defence: true })).defence === true);

// Paid access: 2 days free with 5 jobs and 2 CVs, then £5 once
const HOUR = 3_600_000;
const soon = new Date(Date.now() + 28 * HOUR).toISOString();
const past = new Date(Date.now() - HOUR).toISOString();
check("trial rules", PRICE === "£5" && TRIAL_JOBS === 5 && TRIAL_CVS === 2);
check("admin always paid", accessState({ is_admin: true, trial_ends_at: past }) === "paid");
check("payer paid after trial", accessState({ paid_at: past, trial_ends_at: past }) === "paid");
check("trial while it lasts", accessState({ trial_ends_at: soon }) === "trial");
check("locked after trial", accessState({ trial_ends_at: past }) === "locked" && accessState(null) === "locked");
check("time left wording", timeLeft(new Date(Date.now() + 28 * HOUR + 60_000).toISOString()) === "1 day 4 hours" && timeLeft(past) === "no time", timeLeft(soon));
const link = payLink("https://buy.stripe.com/test_abc", "u-1", "a@example.com");
check("pay link carries who pays", !!link && link.includes("client_reference_id=u-1") && link.includes("prefilled_email=a%40example.com"), String(link));
check("pay link only to Stripe", payLink("https://evil.example.com/pay", "u-1") === null && payLink("", "u-1") === null);

console.log(`${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
