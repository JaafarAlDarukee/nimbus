"use server";

import { revalidatePath } from "next/cache";
import { withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

export type CompanyRole = { title: string; kind: string; closes: string | null; rolling: boolean; url: string };

/** Open roles for the company drawer (the radar's names for that company). */
export async function companyRoles(radarNames: string[]): Promise<CompanyRole[]> {
  if (!radarNames.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("title,kind,closes_at,rolling,apply_url")
    .eq("status", "open")
    .in("company_name", radarNames.slice(0, 20))
    .order("first_seen_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((r) => ({
    title: r.title as string,
    kind: r.kind as string,
    closes: r.closes_at
      ? new Date(r.closes_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })
      : null,
    rolling: !!r.rolling,
    url: r.apply_url as string,
  }));
}

/** Star on a company: muted companies stay out of For you. */
export async function setMuted(company: string, muted: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const prefs = withDefaults(profile?.preferences);
  const list = new Set(prefs.muted);
  if (muted) list.add(company);
  else list.delete(company);
  const { error } = await supabase
    .from("profiles")
    .update({ preferences: { ...prefs, muted: [...list] } })
    .eq("id", user.id);
  revalidatePath("/");
  return { ok: !error };
}

export async function suggestCompany(name: string): Promise<{ ok: boolean }> {
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("company_suggestions").insert({ name: clean });
  return { ok: !error };
}
