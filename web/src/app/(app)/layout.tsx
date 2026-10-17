import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PRICE, accessState, timeLeft } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: lastChecked }, { data: telegram }] = await Promise.all([
    supabase.from("profiles").select("onboarded_at,is_admin,first_name,paid_at,trial_ends_at").eq("id", user.id).maybeSingle(),
    supabase.rpc("radar_last_checked"),
    supabase.from("notification_channels").select("id").eq("channel", "telegram").eq("enabled", true).limit(1),
  ]);
  if (!profile?.onboarded_at) redirect("/onboarding");

  // 2 days free, then pay once (lib/access.ts)
  const access = accessState(profile);
  if (access === "locked") redirect("/pay");

  return (
    <AppShell
      lastChecked={(lastChecked as string | null) ?? null}
      telegramOn={(telegram ?? []).length > 0}
      isAdmin={!!profile.is_admin}
      initial={(profile.first_name?.[0] ?? user.email?.[0] ?? "").toUpperCase()}
    >
      {access === "trial" && (
        <Link
          href="/pay"
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#C3B5FF] px-4 py-2.5 text-center text-[14px] font-semibold !text-[#120B2A]"
        >
          <span>Free trial: {timeLeft(profile.trial_ends_at)} left · 5 jobs and 2 CVs</span>
          <span className="rounded-full bg-[#120B2A] px-3 py-1 text-[13px] !text-[#C3B5FF]">Unlock everything for {PRICE} once →</span>
        </Link>
      )}
      {children}
    </AppShell>
  );
}
