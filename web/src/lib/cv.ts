/**
 * CV studio: the CV model, the job-advert keywords and the ATS check, following the design's rules
 * (keywords from the advert found in the CV, points with a measurable result, the job title named).
 */

export type Experience = { role: string; org: string; dates: string; bullets: string; on: boolean };

export type BuiltCv = {
  name: string;
  email: string;
  phone: string;
  address: string;
  uni: string;
  degree: string;
  dates: string;
  grade: string;
  skills: string[];
  exp: Experience[];
};

export type CvJob = {
  id: string;
  title: string;
  company: string;
  link: string;
  jd: string;
  jdName: string | null;
  mode: "upload" | "build" | null;
  cvName: string | null;
  cvText: string | null;
  cv: BuiltCv | null;
  step: number;
};

export const blankCv = (): BuiltCv => ({ name: "", email: "", phone: "", address: "", uni: "", degree: "", dates: "", grade: "", skills: [], exp: [] });

/** Skills and keywords the check looks for in adverts (engineering first, then general). */
export const KEYWORDS = [
  "SolidWorks", "CATIA", "Siemens NX", "Creo", "AutoCAD", "Inventor", "Fusion 360", "ANSYS", "Abaqus", "FEA", "CFD",
  "MATLAB", "Simulink", "Python", "C++", "LabVIEW", "Excel", "GD&T", "DFMEA", "PFMEA", "FMEA", "Lean", "Six Sigma",
  "Kaizen", "5S", "OEE", "Root cause", "CNC", "Machining", "Prototyping", "Testing", "Data analysis", "CAD",
  "Additive manufacturing", "3D printing", "Composites", "PLC", "ROS", "Robotics", "Electronics", "Manufacturing",
  "Continuous improvement", "Project management", "Health and safety", "Report writing", "Problem solving",
  "Teamwork", "Communication", "Leadership",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, keyword: string) => new RegExp(`(^|[^a-z0-9])${escape(keyword.toLowerCase())}($|[^a-z0-9])`).test(text);

export const keywordsIn = (text: string) => {
  const lower = (text ?? "").toLowerCase();
  return KEYWORDS.filter((k) => has(lower, k));
};

export type Line = { t: string; kind: "name" | "contact" | "h" | "sum" | "role" | "b" | "p" | "skills" };

const SECTION = /^(education|experience|work experience|employment|skills|technical skills|projects|summary|profile|personal statement|achievements|awards|interests|certifications|languages|references|volunteering|leadership)$/i;

/** The CV as lines: built from the form, or read from an uploaded file. */
export function cvLines(job: CvJob): Line[] {
  if (job.mode === "upload") {
    return (job.cvText ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 160)
      .map((t): Line => {
        if (/^[•●▪◦\-*–]\s*/.test(t)) return { t: `• ${t.replace(/^[•●▪◦\-*–]\s*/, "")}`, kind: "b" };
        if (SECTION.test(t.replace(/[:\s]+$/, "")) || (/^[A-Z][A-Z &/]{3,30}$/.test(t) && !/\d/.test(t))) return { t, kind: "h" };
        return { t, kind: "p" };
      });
  }
  const c = job.cv;
  if (!c) return [];
  const lines: Line[] = [
    { t: c.name || "Your name", kind: "name" },
    { t: [c.address, c.email, c.phone].filter(Boolean).join(" · ") || "Contact details", kind: "contact" },
    { t: "Summary", kind: "h" },
    { t: `${c.degree || "Engineering"} student applying for the ${job.title || "role"} at ${job.company || "your company"}.`, kind: "sum" },
    { t: "Education", kind: "h" },
    { t: [c.uni, c.degree, c.dates, c.grade].filter(Boolean).join(", "), kind: "p" },
    { t: "Experience", kind: "h" },
  ];
  for (const x of c.exp.filter((e) => e.on)) {
    lines.push({ t: [x.role, x.org, x.dates].filter(Boolean).join(" · "), kind: "role" });
    for (const b of x.bullets.split("\n").filter((s) => s.trim())) lines.push({ t: `• ${b.trim()}`, kind: "b" });
  }
  lines.push({ t: "Skills", kind: "h" }, { t: c.skills.join(", "), kind: "skills" });
  return lines;
}

export type Issue = { key: "kw" | "num" | "title" | "sum"; colour: string; title: string; detail: string };

export function analyse(job: CvJob) {
  const lines = cvLines(job);
  const text = lines.map((l) => l.t).join(" ").toLowerCase();
  const req = keywordsIn(job.jd);
  const matched = req.filter((k) => has(text, k));
  const missing = req.filter((k) => !has(text, k));
  const bullets = lines.filter((l) => l.kind === "b");
  const weak = bullets.filter((b) => !/\d/.test(b.t));
  const titleWord = (job.title || "").toLowerCase().split(/\s+/)[0] || "~";
  const titleMissing = !text.includes(titleWord);
  const hasSummary = lines.some((l) => l.kind === "sum") || /\b(summary|profile|personal statement)\b/i.test(text.slice(0, 600));

  const issues: Issue[] = [];
  if (missing.length)
    issues.push({ key: "kw", colour: "#F6CD9E", title: `${missing.length} keywords from the advert are missing`, detail: `Add ${missing.slice(0, 5).join(", ")} where you really used them.` });
  if (weak.length)
    issues.push({ key: "num", colour: "#F6B4C1", title: `${weak.length} points have no result`, detail: "Add a number to each highlighted point: a percentage, time saved or parts made." });
  if (titleMissing && job.title) issues.push({ key: "title", colour: "#CDC1FF", title: "Job title not mentioned", detail: `Say "${job.title}" once near the top.` });
  if (!hasSummary) issues.push({ key: "sum", colour: "#CDC1FF", title: "No summary line", detail: "Two lines at the top on who you are and what you want." });

  const score = req.length
    ? Math.max(20, Math.min(98, Math.round(30 + (matched.length / req.length) * 50 + (bullets.length ? (1 - weak.length / bullets.length) * 15 : 0) + (titleMissing ? 0 : 5))))
    : 0;
  return { lines, req, matched, missing, weak, issues, score };
}

export const scoreColour = (s: number) => (s >= 80 ? "#9FE6C8" : s >= 65 ? "#F6CD9E" : "#F6B4C1");

/** A plain document for Word, "Save as PDF" and Google Docs. */
export function cvHtml(lines: Line[], title: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = lines
    .map((l) =>
      l.kind === "name"
        ? `<h1>${esc(l.t)}</h1>`
        : l.kind === "contact"
          ? `<p class="c">${esc(l.t)}</p>`
          : l.kind === "h"
            ? `<h2>${esc(l.t)}</h2>`
            : l.kind === "role"
              ? `<p><b>${esc(l.t)}</b></p>`
              : `<p>${esc(l.t)}</p>`,
    )
    .join("");
  return `<html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:11pt/1.5 Georgia,serif;margin:20mm;color:#111}h1{font-size:20pt;text-align:center;margin:0}p.c{text-align:center;margin:4px 0 14px}h2{font-size:10pt;letter-spacing:.08em;text-transform:uppercase;color:#1D5C9C;margin:16px 0 4px}p{margin:2px 0}</style></head><body>${body}</body></html>`;
}

/** Ideas used when no AI key is set: templates that leave room for the student's own result. */
export function fallbackIdeas(x: Experience, jd: string): string[] {
  const req = keywordsIn(jd);
  return [
    `${x.role ? "Led" : "Worked on"} ${req[0] ?? "an improvement"} work on ${x.org || "the project"}, saving about X hours a week`,
    `Used ${req.slice(1, 3).join(" and ") || "data"} to find the root cause of a recurring problem and fix it`,
    `Presented results to ${x.org ? `the ${x.org} team` : "the team"}, leading to a change that was adopted`,
  ];
}
