import { ProfileView } from "@/components/profile-view";
import { applyMatch, matchFilters, withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  return <ProfileView {...await loadProfile()} />;
}

async function loadProfile(): Promise<React.ComponentProps<typeof ProfileView>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: telegram }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name,preferences,is_admin").eq("id", user!.id).maybeSingle(),
    supabase.from("notification_channels").select("config").eq("channel", "telegram").eq("enabled", true).limit(1),
  ]);
  const preferences = withDefaults(profile?.preferences);
  const { count } = await applyMatch(
    supabase.from("opportunities").select("id" as string, { count: "exact", head: true }).eq("status", "open"),
    matchFilters(preferences),
  );
  const config = (telegram?.[0]?.config ?? null) as { username?: string } | null;

  return {
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    email: user!.email ?? "",
    preferences,
    count: count ?? 0,
    telegram: telegram?.length ? { username: config?.username ?? null } : null,
    isAdmin: !!profile?.is_admin,
  };
}
