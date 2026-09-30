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

async function textOf(name: string, bytes: Uint8Array): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    let text = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
      }
      text += "\n";
    }
    return text;
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }
  if (lower.endsWith(".txt")) return new TextDecoder().decode(bytes);
  throw new Error("unsupported");
}

/** Read an uploaded CV or job description. Only the text is kept, never the file. */
export async function readFile(form: FormData): Promise<{ name: string; text: string } | { error: string }> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file first." };
  if (file.size > 5 * 1024 * 1024) return { error: "That file is over 5 MB. Try a smaller PDF." };
  try {
    const text = (await textOf(file.name, new Uint8Array(await file.arrayBuffer()))).trim();
    if (!text) return { error: "We couldn't find any text in that file. If it's a scan, paste the text instead." };
    return { name: file.name, text };
  } catch {
    return { error: file.name.toLowerCase().endsWith(".doc") ? "Save it as .docx or PDF and try again." : "We can read PDF, Word (.docx) and text files." };
  }
}

/** The CV uploaded during onboarding, read the same way. */
export async function readSignupCv(): Promise<{ name: string; text: string } | { error: string }> {
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
    return { name, text: (await textOf(prefs.cvPath, new Uint8Array(await blob.arrayBuffer()))).trim() };
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
