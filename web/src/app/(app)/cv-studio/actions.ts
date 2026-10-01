"use server";

import { revalidatePath } from "next/cache";
import { fallbackIdeas, type BuiltCv, type CvJob, type Experience } from "@/lib/cv";
import { withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

const COLUMNS: Record<string, string> = {
  title: "title",
  company: "company",
  link: "link",
  jd: "jd",
  jdName: "jd_name",
  mode: "mode",
  cvName: "cv_name",
  cvText: "cv_text",
  cvMeta: "cv_meta",
  cv: "cv",
  step: "step",
};

export async function createJob(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("cv_jobs").insert({}).select("id").single();
  revalidatePath("/cv-studio");
  return (data?.id as string) ?? null;
}

/** Autosave: the fields of one job that changed. */
export async function saveJob(id: string, patch: Partial<Omit<CvJob, "id">>): Promise<{ ok: boolean }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(patch)) if (COLUMNS[key]) row[COLUMNS[key]] = value;
  if (typeof row.jd === "string") row.jd = (row.jd as string).slice(0, 20000);
  if (typeof row.cv_text === "string") row.cv_text = (row.cv_text as string).slice(0, 20000);
  const supabase = await createClient();
  const { error } = await supabase.from("cv_jobs").update(row).eq("id", id);
  return { ok: !error };
}

/** "Save my details and education for the next CV" */
export async function saveDetails(cv: BuiltCv): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("profiles").update({ cv_details: cv }).eq("id", user.id);
  return { ok: !error };
}

type FileText = { text: string; pages?: number; columns?: boolean };

/** Text in reading order, plus (for PDFs) the page count and whether lines sit in side-by-side columns. */
async function textOf(name: string, bytes: Uint8Array): Promise<FileText> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    let text = "";
    let rows = 0;
    let splitRows = 0;
    for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
      const page = await pdf.getPage(i);
      const width = page.getViewport({ scale: 1 }).width;
      const content = await page.getTextContent();
      const byRow = new Map<number, { x: number; end: number }[]>();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : "");
        if (!item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 3);
        const x = item.transform[4];
        byRow.set(y, [...(byRow.get(y) ?? []), { x, end: x + item.width }]);
      }
      // A two-column CV has many rows with text on both halves and a wide empty gap between them.
      // Right-aligned dates are fine: they're short and at the far right edge.
      for (const runs of byRow.values()) {
        if (runs.length < 2) continue;
        rows += 1;
        runs.sort((a, b) => a.x - b.x);
        for (let r = 1; r < runs.length; r++) {
          const gap = runs[r].x - runs[r - 1].end;
          const rightRun = runs.slice(r);
          const rightWidth = Math.max(...rightRun.map((q) => q.end)) - runs[r].x;
          if (gap > width * 0.08 && runs[r].x > width * 0.3 && runs[r].x < width * 0.7 && rightWidth > width * 0.2) {
            splitRows += 1;
            break;
          }
        }
      }
      text += "\n";
    }
    return { text, pages: pdf.numPages, columns: rows >= 6 && splitRows / rows > 0.3 };
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: value };
  }
  if (lower.endsWith(".txt")) return { text: new TextDecoder().decode(bytes) };
  throw new Error("unsupported");
}

/** Read an uploaded CV or job description. Only the text is kept, never the file. */
export async function readFile(form: FormData): Promise<({ name: string } & FileText) | { error: string }> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file first." };
  if (file.size > 5 * 1024 * 1024) return { error: "That file is over 5 MB. Try a smaller PDF." };
  try {
    const read = await textOf(file.name, new Uint8Array(await file.arrayBuffer()));
    const text = read.text.trim();
    if (!text) return { error: "We couldn't find any text in that file. If it's a scan or a picture, export it from Word or Google Docs as a PDF." };
    return { name: file.name, ...read, text };
  } catch {
    return { error: file.name.toLowerCase().endsWith(".doc") ? "Save it as .docx or PDF and try again." : "We can read PDF, Word (.docx) and text files." };
  }
}

/** The CV uploaded during onboarding, read the same way. */
export async function readSignupCv(): Promise<({ name: string } & FileText) | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const prefs = withDefaults(profile?.preferences);
  if (!prefs.cvPath) return { error: "No CV saved from sign-up." };
  const { data: blob } = await supabase.storage.from("cvs").download(prefs.cvPath);
  if (!blob) return { error: "Couldn't open your saved CV." };
  try {
    const name = prefs.cvName ?? prefs.cvPath.split("/").pop() ?? "CV";
    const read = await textOf(prefs.cvPath, new Uint8Array(await blob.arrayBuffer()));
    return { name, ...read, text: read.text.trim() };
  } catch {
    return { error: "Couldn't read your saved CV. Upload it again as PDF or Word." };
  }
}

/**
 * "Give me ideas": three bullet ideas for one experience entry. Uses Gemini when GEMINI_API_KEY is
 * set (only the role, organisation, points and advert are sent, never name or contact details);
 * otherwise template ideas.
 */
export async function ideas(input: { exp: Experience; title: string; company: string; jd: string }): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  const { exp, title, company, jd } = input;
  if (!key) return fallbackIdeas(exp, jd);
  const prompt = `Suggest 3 short CV bullet ideas (one per line, no numbering) for a student's "${exp.role}" at "${exp.org}". Existing points: ${exp.bullets}. Target job: ${title} at ${company}. Advert: ${jd.slice(0, 800)}. Use the advert's keywords, include a place for a measurable result, never invent employers.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? "gemini-2.5-flash"}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const list = text
      .split("\n")
      .map((s) => s.replace(/^[-•*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    return list.length ? list : fallbackIdeas(exp, jd);
  } catch {
    return fallbackIdeas(exp, jd);
  }
}

const USER_AGENT = "Mozilla/5.0 (compatible; NimbusRadar/0.1; student job alerts)";

/** Hosts a student's link must never make the server call: this machine and private networks. */
function publicUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!/^https?:$/.test(url.protocol) || !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return null;
  if (/(^|\.)(localhost|local|internal|lan|home)$/.test(host)) return null;
  return url;
}

/** robots.txt: is this path open to tools? (User-agent: * rules, longest match wins.) */
async function robotsAllow(url: URL): Promise<boolean> {
  try {
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return true;
    let applies = false;
    let best: { len: number; allow: boolean } = { len: -1, allow: true };
    for (const raw of (await res.text()).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const [field, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (/^user-agent$/i.test(field)) applies = value === "*";
      else if (applies && /^(dis)?allow$/i.test(field) && value && url.pathname.startsWith(value.replace(/\*.*$/, ""))) {
        const len = value.length;
        if (len > best.len) best = { len, allow: /^allow$/i.test(field) };
      }
    }
    return best.allow;
  } catch {
    return true;
  }
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const textOfHtml = (html: string) =>
  decode(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h\d|\/div|\/tr)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    // Empty list items and page furniture ("Apply", "Back to jobs") aren't part of the advert
    .filter((l) => l.replace(/^•\s*/, "").length > 1 && !/^(•\s*)?(apply( now| for this job)?|back to jobs|share( this job)?|save( job)?)$/i.test(l))
    .join("\n");

type JobPosting = { title?: string; description?: string; hiringOrganization?: { name?: string } | string };

/** The schema.org JobPosting many careers sites embed for Google Jobs: the cleanest copy of the advert. */
function jobPosting(html: string): JobPosting | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items: unknown[] = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const found = items.find((i) => i && typeof i === "object" && (i as { "@type"?: unknown })["@type"] === "JobPosting");
      if (found) return found as JobPosting;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * "Read it from the link": the advert for a job link. A role Nimbus already saved comes from the
 * database; otherwise the page is fetched once (only if its robots.txt allows tools) and the advert
 * text taken from it. Pages that build the advert with JavaScript, or block tools, can't be read:
 * the student pastes the advert instead.
 */
export async function readJobLink(link: string): Promise<{ title: string; company: string; text: string } | { error: string }> {
  const url = publicUrl(link);
  if (!url) return { error: "That doesn't look like a web link. Copy it from your browser's address bar." };

  const supabase = await createClient();
  const { data: saved } = await supabase
    .from("opportunities")
    .select("title,company_name,description")
    .eq("apply_url", url.toString())
    .not("description", "is", null)
    .limit(1)
    .maybeSingle();
  if (saved?.description && saved.description.length > 200) {
    return { title: saved.title, company: saved.company_name, text: saved.description };
  }

  if (!(await robotsAllow(url))) {
    return { error: "This site asks tools not to read its pages, so Nimbus won't. Copy the advert from the page and paste it below." };
  }
  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { error: "This site blocks tools, so Nimbus can't read it. Copy the advert from the page and paste it below." };
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return { error: "Couldn't open that page. Check the link, or paste the advert below." };
    html = (await res.text()).slice(0, 2_000_000);
  } catch {
    return { error: "That page took too long to answer. Paste the advert below instead." };
  }

  const posting = jobPosting(html);
  const company = typeof posting?.hiringOrganization === "string" ? posting.hiringOrganization : (posting?.hiringOrganization?.name ?? "");
  const text = posting?.description ? textOfHtml(decode(posting.description)) : textOfHtml(html);
  if (text.length < 300) {
    return { error: "This page loads the advert with JavaScript, so Nimbus can't read it from the link. Copy the advert from the page and paste it below." };
  }
  return { title: decode(posting?.title ?? "").trim(), company: decode(company).trim(), text: text.slice(0, 20000) };
}
