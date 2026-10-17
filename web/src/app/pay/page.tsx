import { redirect } from "next/navigation";
import { PayView } from "@/components/pay-view";
import { accessState, payLink, timeLeft } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

/** Pay once (Stripe), or see that you're in. Stripe sends people back here with ?paid=1. */
export default async function PayPage(props: PageProps<"/pay">) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("is_admin,paid_at,trial_ends_at,onboarded_at").eq("id", user.id).maybeSingle(),
    supabase.from("app_settings").select("key,value"),
  ]);
  const setting = (key: string) => (settings ?? []).find((s) => s.key === key)?.value?.trim() ?? "";
  return (
    <PayView
      access={accessState(profile)}
      justPaid={params.paid === "1"}
      left={timeLeft(profile?.trial_ends_at)}
      link={payLink(setting("stripe_link"), user.id, user.email)}
      home={profile?.onboarded_at ? "/" : "/onboarding"}
    />
  );
}

