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
  previewPath,
}: {
  children: React.ReactNode;
  lastChecked: string | null;
  telegramOn: boolean;
  isAdmin: boolean;
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
      <header className="relative z-[2] grid min-h-[65px] grid-cols-[1fr_auto] items-center border-b border-line px-5 md:grid-cols-[1fr_auto_1fr] md:px-7">
        <Link href="/" className="flex items-center gap-[9px] !text-tx">
          <LogoMark size={look.logo} />
          <Wordmark size={23} />
        </Link>
        <nav aria-label="Main" className="order-3 col-span-2 -mx-5 flex gap-0.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:order-none md:col-span-1 md:mx-0 md:overflow-visible md:p-0">
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
        <div className="flex items-center gap-2 justify-self-end">
          {isAdmin && (
            <Link href="/admin" className="hidden h-8 items-center rounded-full px-3 text-xs !text-tx3 hover:!text-tx sm:flex">
              Admin
            </Link>
          )}
          <Link
            href="/profile"
            className="flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 text-xs !text-tx2"
          >
            <span className="size-1.5 rounded-full" style={{ background: telegramOn ? "var(--t-mint)" : "var(--tx3)" }} />
            Telegram {telegramOn ? "on" : "off"}
            {checked && <span className="hidden font-mono text-tx3 sm:inline">· checked {checked}</span>}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
