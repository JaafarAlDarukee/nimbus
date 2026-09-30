"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark, Wordmark } from "@/components/brand";
import { timeAgo } from "@/lib/time";

const NAV = [
  { href: "/", label: "Opportunities" },
  { href: "/tracker", label: "Tracker" },
  { href: "/calendar", label: "Calendar" },
  { href: "/companies", label: "Companies" },
  { href: "/cv-studio", label: "CV studio" },
  { href: "/profile", label: "Profile" },
];

const glow = (top: string, mid: string, end: string) =>
  `radial-gradient(110% 420px at 50% -160px, ${top} 0%, ${mid} 45%, ${end} 80%)`;

// Phones get a floating tab bar instead of the pill menu (mobile design)
const TABS = [
  { href: "/", label: "Discover", d: "M3.5 11a4.5 4.5 0 0 1 9 0M2 13.5h12" },
  { href: "/tracker", label: "Tracker", d: "M2.5 3.5h11v9h-11zM2.5 7h11M6.5 3.5v9" },
  { href: "/calendar", label: "Calendar", d: "M3 4.5h10v9H3zM3 7.5h10M6 2.5v3M10 2.5v3" },
  { href: "/profile", label: "Profile", d: "M8 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 14a5 5 0 0 1 10 0" },
];

// Each screen's palette, top glow and logo size, as in its design file
const LOOKS: Record<string, { theme: string; glow: string; logo: number }> = {
  "/": { theme: "bright", glow: "none", logo: 26 },
  "/tracker": { theme: "ink", glow: glow("rgba(30,90,180,.45)", "rgba(14,40,80,.22)", "rgba(8,9,11,0)"), logo: 22 },
  "/profile": { theme: "ink", glow: glow("rgba(30,70,140,.45)", "rgba(14,30,60,.2)", "rgba(11,14,19,0)"), logo: 22 },
  "/calendar": { theme: "calm", glow: glow("rgba(50,100,190,.4)", "rgba(20,45,90,.18)", "rgba(15,20,29,0)"), logo: 26 },
  "/cv-studio": { theme: "calm", glow: glow("rgba(50,100,190,.4)", "rgba(20,45,90,.18)", "rgba(15,20,29,0)"), logo: 26 },
  "/companies": { theme: "dark", glow: glow("rgba(30,70,140,.45)", "rgba(14,30,60,.2)", "rgba(11,14,19,0)"), logo: 26 },
};
const DEFAULT_LOOK = LOOKS["/companies"];

export function AppShell({
  children,
  lastChecked,
  telegramOn,
  isAdmin,
  initial = "",
  previewPath,
}: {
  children: React.ReactNode;
  lastChecked: string | null;
  telegramOn: boolean;
  isAdmin: boolean;
  /** First letter of the user's name, for the phone header */
  initial?: string;
  /** Design previews (development only) pretend to be this screen */
  previewPath?: string;
}) {
  const realPath = usePathname();
  const pathname = previewPath ?? realPath;
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const [checked, setChecked] = useState<string | null>(null);
  const look = LOOKS[Object.keys(LOOKS).find((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p))) ?? ""] ?? DEFAULT_LOOK;

  // Relative time is worked out in the browser so it stays current
  useEffect(() => {
    const update = () => setChecked(lastChecked ? timeAgo(lastChecked) : null);
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [lastChecked]);

  return (
    <div
      data-theme={look.theme}
      className="relative min-h-screen text-sm text-tx"
      style={{ background: look.glow === "none" ? "var(--bg)" : `${look.glow}, var(--bg)` }}
    >
      <header className="relative z-[2] flex h-[65px] items-center justify-between border-b border-line px-5 md:grid md:grid-cols-[1fr_auto_1fr] md:px-7">
        <Link href="/" className="flex items-center gap-2 !text-tx md:gap-[9px]">
          <LogoMark size={look.logo} />
          <Wordmark size={23} />
        </Link>
        <nav aria-label="Main" className="hidden gap-0.5 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className={`flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] transition-colors ${
                active(item.href) ? "bg-s2 !text-tx" : "!text-tx2 hover:!text-tx"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 justify-self-end md:flex">
          {isAdmin && (
            <Link href="/admin" className="flex h-8 items-center rounded-full px-3 text-xs !text-tx3 hover:!text-tx">
              Admin
            </Link>
          )}
          <Link
            href="/profile"
            className="flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 text-xs !text-tx2"
          >
            <span className="size-1.5 rounded-full" style={{ background: telegramOn ? "var(--t-mint)" : "var(--tx3)" }} />
            Telegram {telegramOn ? "on" : "off"}
            {checked && <span className="font-mono text-tx3">· checked {checked}</span>}
          </Link>
        </div>
        {/* Phones: search and your initial, as in the mobile design */}
        <div className="flex gap-2 md:hidden">
          <Link
            href="/?find=1"
            onClick={(e) => {
              // Already on For you: open its search box instead of reloading the page
              if (pathname === "/") {
                e.preventDefault();
                window.dispatchEvent(new Event("nimbus:search"));
              }
            }}
            aria-label="Search opportunities"
            className="grid size-11 place-items-center rounded-full border !text-tx"
            style={{ borderColor: "rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)" }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5 14 14" />
            </svg>
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="grid size-11 place-items-center rounded-full bg-[#F4F6F8] text-xl !text-[#08090B]"
            style={{ fontFamily: "var(--font-newsreader), Georgia, serif" }}
          >
            {initial}
          </Link>
        </div>
      </header>
      {children}
      {/* Room for the tab bar, then the tab bar itself (phones only) */}
      <div className="h-24 md:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-4 bottom-[26px] z-[9] grid h-16 grid-cols-4 items-center rounded-[22px] border backdrop-blur-md md:hidden"
        style={{ background: "rgba(23,26,31,.92)", borderColor: "rgba(255,255,255,.08)" }}
      >
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active(tab.href) ? "page" : undefined}
            className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium"
            style={{ color: active(tab.href) ? "#F4F6F8" : "var(--tx3)" }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d={tab.d} />
            </svg>
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
