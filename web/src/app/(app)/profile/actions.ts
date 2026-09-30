"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withDefaults, type Preferences } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

const EDITABLE = ["field", "degrees", "year", "sectors", "sectorsAll", "types", "uk", "abroad", "emailDigest", "muted"] as const;

/** Save the radar choices edited on Profile (the rest of the stored preferences are kept). */
export async function savePreferences(next: Partial<Preferences>): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
  const merged: Record<string, unknown> = { ...withDefaults(profile?.preferences) };
  for (const key of EDITABLE) if (next[key] !== undefined) merged[key] = next[key];

  const { error } = await supabase.from("profiles").update({ preferences: merged }).eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/companies");
  return { ok: true };
}

/** A one-time code for the bot: /start <code> links this account's Telegram chat. */
export async function telegramLinkCode(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("telegram_links").insert({ user_id: user.id }).select("code").single();
  return data?.code ?? null;
}

export async function disconnectTelegram(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("notification_channels").update({ enabled: false }).eq("channel", "telegram");
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Has the bot linked this account yet? (Profile and onboarding check after Connect.) */
export async function telegramStatus(): Promise<{ on: boolean; username: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_channels").select("config").eq("channel", "telegram").eq("enabled", true).maybeSingle();
  const config = (data?.config ?? null) as { username?: string } | null;
  return { on: !!data, username: config?.username ?? null };
}
