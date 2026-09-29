"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, CalendarDays, KanbanSquare, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { NimbusLogo } from "@/components/nimbus-logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Opportunities", icon: LayoutDashboard, ready: true },
  { href: "/tracker", label: "Tracker", icon: KanbanSquare, ready: false },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, ready: false },
  { href: "/companies", label: "Companies", icon: Building2, ready: false },
  { href: "/profile", label: "Profile", icon: UserRound, ready: false },
];

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
      <Link href="/" className="px-2">
        <NimbusLogo />
      </Link>

      <nav className="mt-8 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon, ready }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const classes = cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            !ready && "pointer-events-none opacity-45",
          );
          return ready ? (
            <Link key={href} href={href} className={classes}>
              <Icon className="size-4" />
              {label}
            </Link>
          ) : (
            <span key={href} className={classes} aria-disabled>
              <Icon className="size-4" />
              {label}
              <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
            </span>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-4">
        <p className="truncate px-2.5 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <button
          onClick={signOut}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
