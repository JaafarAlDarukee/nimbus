/**
 * CV studio: the CV model and the Nimbus CV template, which follows the r/EngineeringResumes
 * template: one column, one page, name and contact line, Education, Experience, Projects,
 * Technical Skills, dates on the right, no summary for students. The check is in lib/ats.ts.
 */
import { atsReport, type AtsIssue, type AtsReport } from "@/lib/ats";
import { SOFTWARE, keywordsIn } from "@/lib/keywords";

export { keywordsIn } from "@/lib/keywords";

export type Experience = {
  role: string;
  org: string;
  dates: string;
  bullets: string;
  on: boolean;
  /** Work experience or a project (Formula Student, coursework, a personal build) */
  kind?: "work" | "project";
  place?: string;
};

export type BuiltCv = {
  name: string;
  email: string;
  phone: string;
  linkedin?: string;
  address: string;
  uni: string;
  degree: string;
  dates: string;
  grade: string;
  /** Relevant modules, one line */
  modules?: string;
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
  /** From an uploaded PDF: page count and whether it uses columns */
  cvMeta: { pages?: number; columns?: boolean } | null;
  cv: BuiltCv | null;
  step: number;
};

export const blankCv = (): BuiltCv => ({
  name: "", email: "", phone: "", linkedin: "", address: "", uni: "", degree: "", dates: "", grade: "", modules: "", skills: [], exp: [],
});

/** One line of the CV. `right` is what the template puts at the right margin (dates, place). */
export type Line = { t: string; kind: "name" | "contact" | "h" | "sum" | "role" | "sub" | "b" | "p" | "skills"; right?: string };

const SECTION = /^(education|experience|work experience|employment|skills|technical skills|projects|summary|profile|personal statement|achievements|awards|interests|certifications|languages|references|volunteering|leadership)$/i;

/** The CV as lines: built with the template, or read from an uploaded file. */
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
    { t: c.name || "Your Name", kind: "name" },
    { t: [c.phone, c.email, c.linkedin, c.address].filter(Boolean).join(" | ") || "Phone | Email | linkedin.com/in/you", kind: "contact" },
    { t: "Education", kind: "h" },
    { t: c.uni || "University", kind: "role", right: c.dates },
    { t: [c.degree, c.grade].filter(Boolean).join(", ") || "Degree", kind: "sub" },
  ];
  if (c.modules?.trim()) lines.push({ t: `Relevant modules: ${c.modules.trim()}`, kind: "p" });

  const entries = (kind: "work" | "project") => c.exp.filter((x) => x.on && (x.kind ?? "work") === kind);
  const bullets = (x: Experience) =>
    x.bullets
      .split("\n")
      .map((b) => b.replace(/^[•●▪◦\-*–]\s*/, "").trim())
      .filter(Boolean)
      .forEach((b) => lines.push({ t: `• ${b}`, kind: "b" }));

  if (entries("work").length) {
    lines.push({ t: "Experience", kind: "h" });
    for (const x of entries("work")) {
      lines.push({ t: x.role || "Role", kind: "role", right: x.dates });
      if (x.org || x.place) lines.push({ t: x.org, kind: "sub", right: x.place });
      bullets(x);
    }
  }
  if (entries("project").length) {
    lines.push({ t: "Projects", kind: "h" });
    for (const x of entries("project")) {
      lines.push({ t: [x.role || "Project", x.org].filter(Boolean).join(" | "), kind: "role", right: x.dates });
      bullets(x);
    }
  }
  const software = c.skills.filter((s) => SOFTWARE.has(s));
  const technical = c.skills.filter((s) => !SOFTWARE.has(s));
  lines.push({ t: "Technical Skills", kind: "h" });
  if (software.length) lines.push({ t: `Software: ${software.join(", ")}`, kind: "skills" });
  if (technical.length || !software.length) lines.push({ t: `Technical: ${technical.join(", ")}`, kind: "skills" });
  return lines;
}

/** Colour for each area of the check (the design's tags): keywords dawn, impact rose, layout lilac, sections sky. */
export const AREA_COLOUR: Record<AtsIssue["area"], string> = {
  keywords: "#F6CD9E",
  impact: "#F6B4C1",
  layout: "#CDC1FF",
  sections: "#9FD0FF",
};

export function analyse(job: CvJob): { lines: Line[]; report: AtsReport; score: number; matched: string[]; missing: string[]; req: string[] } {
  const lines = cvLines(job);
  const text = lines.map((l) => (l.right ? `${l.t} ${l.right}` : l.t)).join("\n");
  const report = atsReport(
    { text, pages: job.mode === "upload" ? job.cvMeta?.pages : 1, columns: job.mode === "upload" ? job.cvMeta?.columns : false, fileName: job.cvName ?? undefined },
    job.jd,
    job.title,
  );
  return { lines, report, score: report.score, matched: report.matched, missing: report.missing, req: [...report.matched, ...report.missing] };
}

export const scoreColour = (s: number) => (s >= 80 ? "#9FE6C8" : s >= 65 ? "#F6CD9E" : "#F6B4C1");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The template as a printable page (Save as PDF) and for Google Docs / old Word. */
export function cvHtml(lines: Line[], title: string) {
  const row = (l: Line, cls: string) =>
    `<div class="row ${cls}"><span>${esc(l.t)}</span>${l.right ? `<span>${esc(l.right)}</span>` : ""}</div>`;
  const body = lines
    .map((l) =>
      l.kind === "name"
        ? `<h1>${esc(l.t)}</h1>`
        : l.kind === "contact"
          ? `<p class="c">${esc(l.t)}</p>`
          : l.kind === "h"
            ? `<h2>${esc(l.t)}</h2>`
            : l.kind === "role"
              ? row(l, "role")
              : l.kind === "sub"
                ? row(l, "sub")
                : l.kind === "b"
                  ? `<p class="b">${esc(l.t.replace(/^•\s*/, ""))}</p>`
                  : `<p>${esc(l.t)}</p>`,
    )
    .join("");
  return `<html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:14mm 16mm}
body{font:10.5pt/1.32 "Times New Roman",Times,serif;color:#000;margin:0}
h1{font-size:22pt;font-weight:normal;text-align:center;margin:0 0 2px;letter-spacing:.02em}
p.c{text-align:center;margin:0 0 8px;font-size:10pt}
h2{font-size:11pt;font-variant:small-caps;letter-spacing:.04em;border-bottom:1px solid #000;margin:9px 0 4px;padding-bottom:1px;font-weight:bold}
.row{display:flex;justify-content:space-between;gap:12px}.role{font-weight:bold;margin-top:4px}.sub{font-style:italic}
p{margin:1px 0}p.b{margin:1px 0 1px 14px;text-indent:-9px}p.b:before{content:"• "}
</style></head><body>${body}</body></html>`;
}

/** The template as a real Word document (.docx), built in the browser. */
export async function cvDocx(lines: Line[]): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } = await import("docx");
  const RIGHT = 9638; // twips: A4 width minus the margins below
  const font = "Times New Roman";
  const run = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    new TextRun({ text, font, size: opts.size ?? 21, bold: opts.bold, italics: opts.italics });
  const withRight = (l: Line, opts: { bold?: boolean; italics?: boolean }) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }],
      spacing: { before: l.kind === "role" ? 80 : 0, after: 0 },
      children: [run(l.t, opts), ...(l.right ? [run(`\t${l.right}`, opts)] : [])],
    });

  const children = lines.map((l) => {
    switch (l.kind) {
      case "name":
        return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(l.t, { size: 44 })] });
      case "contact":
        return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(l.t, { size: 20 })] });
      case "h":
        return new Paragraph({
          spacing: { before: 160, after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
          children: [run(l.t.toUpperCase(), { bold: true, size: 22 })],
        });
      case "role":
        return withRight(l, { bold: true });
      case "sub":
        return withRight(l, { italics: true });
      case "b":
        return new Paragraph({ bullet: { level: 0 }, spacing: { after: 0 }, children: [run(l.t.replace(/^•\s*/, ""))] });
      default:
        return new Paragraph({ spacing: { after: 0 }, children: [run(l.t)] });
    }
  });

  const doc = new Document({
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 794, bottom: 794, left: 907, right: 907 } } }, children }],
  });
  return Packer.toBlob(doc);
}

/** Ideas used without an AI key: templates that leave room for the student's own result. */
export function fallbackIdeas(x: Experience, jd: string): string[] {
  const req = keywordsIn(jd);
  return [
    `${x.kind === "project" ? "Designed" : "Delivered"} ${req[0] ?? "an improvement"} work on ${x.org || x.role || "the project"}, cutting X by Y%`,
    `Used ${req.slice(1, 3).join(" and ") || "data"} to find the root cause of a recurring problem and fix it, saving X hours a week`,
    `Presented results to ${x.org ? `the ${x.org} team` : "the team"}, leading to a change that was adopted`,
  ];
}

/** A prompt for Claude (Copy to Claude) to suggest bullets, with nothing personal in it. */
export function ideasPrompt(x: Experience, title: string, company: string, jd: string): string {
  return `Suggest 3 strong CV bullet points for a UK engineering student, in the r/EngineeringResumes style (start with a past-tense action verb, include a number, one line each).
Role or project: ${x.role || "(not given)"} at ${x.org || "(not given)"}.
What I did (my own notes): ${x.bullets || "(none yet)"}
Target job: ${title} at ${company}.
Job advert keywords to use where true: ${keywordsIn(jd).join(", ") || "(none found)"}.
Don't invent anything I didn't do; use X or Y where I need to fill in the real number.`;
}
