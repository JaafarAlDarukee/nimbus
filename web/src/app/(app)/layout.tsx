import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PRICE, TRIAL_CVS, TRIAL_JOBS, accessState, hoursLeft, timeLeft } from "@/lib/access";
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
      {access === "trial" && <TrialBanner endsAt={profile.trial_ends_at} />}
      {children}
    </AppShell>
  );
}

/** Free trial: how long is left, what it's limited to, and the way out. Turns orange in the last 12 hours. */
function TrialBanner({ endsAt }: { endsAt: string | null }) {
  const urgent = hoursLeft(endsAt) < 12;
  return (
    <Link
      href="/pay"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3.5 text-center !text-[#120B2A]"
      style={{ background: urgent ? "#F3C38F" : "#C3B5FF" }}
    >
      <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
        <span className="text-[16px] font-bold">
          ⏳ {urgent ? `Your free trial ends in ${timeLeft(endsAt)}` : `Free trial: ${timeLeft(endsAt)} left`}
        </span>
        <span className="text-[14px] font-medium">
          You can see {TRIAL_JOBS} roles, make {TRIAL_CVS} CVs and get {TRIAL_JOBS} Telegram alerts.
        </span>
      </span>
      <span className="rounded-full bg-[#120B2A] px-4 py-2 text-[14px] font-semibold" style={{ color: urgent ? "#F3C38F" : "#C3B5FF" }}>
        Unlock everything for {PRICE} once →
      </span>
    </Link>
  );
}
