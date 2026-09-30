import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: lastChecked }, { data: telegram }] = await Promise.all([
    supabase.from("profiles").select("onboarded_at,is_admin").eq("id", user.id).maybeSingle(),
    supabase.rpc("radar_last_checked"),
    supabase.from("notification_channels").select("id").eq("channel", "telegram").eq("enabled", true).limit(1),
  ]);
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <AppShell
      lastChecked={(lastChecked as string | null) ?? null}
      telegramOn={(telegram ?? []).length > 0}
      isAdmin={!!profile.is_admin}
    >
      {children}
    </AppShell>
  );
}
