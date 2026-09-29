import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { NimbusLogo } from "@/components/nimbus-logo";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <AppSidebar email={user.email ?? ""} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center border-b px-5 py-3 md:hidden">
          <NimbusLogo />
        </header>
        {children}
      </div>
    </div>
  );
}
