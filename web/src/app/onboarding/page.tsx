import { redirect } from "next/navigation";
import { withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: telegram }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name,preferences").eq("id", user.id).maybeSingle(),
    supabase.from("notification_channels").select("id").eq("channel", "telegram").eq("enabled", true).limit(1),
  ]);

  return (
    <OnboardingFlow
      userId={user.id}
      email={user.email ?? ""}
      initialFirst={profile?.first_name ?? ""}
      initialLast={profile?.last_name ?? ""}
      initialPreferences={withDefaults(profile?.preferences)}
      telegramConnected={(telegram ?? []).length > 0}
    />
  );
}
