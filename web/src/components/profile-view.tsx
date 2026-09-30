"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { disconnectTelegram, savePreferences, signOut, telegramLinkCode } from "@/app/(app)/profile/actions";
import { TELEGRAM_BOT_URL } from "@/components/brand";
import { ABROAD_LOCATIONS, DEGREES_BY_FIELD, FIELDS, SECTOR_GROUPS, TYPES, UK_LOCATIONS, YEARS } from "@/lib/onboarding-data";
import type { Preferences } from "@/lib/preferences";

const SERIF = "var(--font-newsreader), Georgia, serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

type Props = {
  firstName: string;
  lastName: string;
  email: string;
  preferences: Preferences;
  count: number;
  telegram: { username: string | null } | null;
};

type Step = { key: string; title: string; single?: boolean; opts: string[]; soon?: string[]; value: string[] };

const yearLabel = (year: string) => year.match(/^(\d)(st|nd|rd|th) year$/)?.[1] ? `Year ${year[0]}` : year;

export function ProfileView(props: Props) {
  const [prefs, setPrefs] = useState(props.preferences);
  const [open, setOpen] = useState<string | null>("deg");
  const [telegram, setTelegram] = useState<"on" | "off" | "waiting">(props.telegram ? "on" : "off");
  const [, startSaving] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Every change is saved shortly after the last click
  const change = (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => startSaving(async () => void (await savePreferences(next))), 500);
  };

  const locations = [...prefs.uk, ...prefs.abroad];
  const steps: Step[] = [
    { key: "field", title: "Field", single: true, opts: FIELDS.map((f) => f.label), soon: FIELDS.filter((f) => f.soon).map((f) => f.label), value: [prefs.field] },
    { key: "deg", title: "Degree", opts: DEGREES_BY_FIELD[prefs.field] ?? [], value: prefs.degrees },
    { key: "year", title: "Year", single: true, opts: YEARS, value: [prefs.year] },
    { key: "sec", title: "Industries", opts: SECTOR_GROUPS.flatMap((g) => g.items), value: prefs.sectors },
    { key: "types", title: "Looking for", opts: TYPES.map((t) => t.t), value: prefs.types },
    { key: "loc", title: "Location", opts: [...UK_LOCATIONS, ...ABROAD_LOCATIONS], value: locations },
  ];

  const pick = (step: Step, option: string) => {
    if (step.soon?.includes(option)) return;
    const on = step.value.includes(option);
    const toggled = on ? step.value.filter((x) => x !== option) : [...step.value, option];
    if (step.key === "field") {
      if (option !== prefs.field) change({ field: option, degrees: [], sectors: [], sectorsAll: false });
    } else if (step.key === "deg") change({ degrees: toggled });
    else if (step.key === "year") change({ year: option });
    else if (step.key === "sec") change({ sectors: toggled, sectorsAll: false });
    else if (step.key === "types") change({ types: toggled });
    else if (step.key === "loc") {
      const inUk = UK_LOCATIONS.includes(option);
      const list = inUk ? prefs.uk : prefs.abroad;
      const updated = on ? list.filter((x) => x !== option) : [...list, option];
      change(inUk ? { uk: updated } : { abroad: updated });
    }
  };

  const summary = (step: Step) => {
    if (step.key === "sec" && prefs.sectorsAll) return "Everything";
    return step.value.filter(Boolean).length ? step.value.join(", ") : "Any";
  };

  const connectTelegram = async () => {
    const code = await telegramLinkCode();
    if (!code) return;
    window.open(`${TELEGRAM_BOT_URL}?start=${code}`, "_blank", "noopener");
    setTelegram("waiting");
  };

  const name = [props.firstName, props.lastName].filter(Boolean).join(" ");
  const degree = (prefs.degrees[0] ?? prefs.field).replace(/ Engineering$/, "");

  return (
    <main className="mx-auto flex max-w-[808px] flex-col gap-8 px-5 pb-24 pt-14 leading-[normal] sm:px-6">
      <div className="animate-fade-up flex flex-col items-center gap-3.5 text-center">
        <span className="grid size-14 place-items-center rounded-full border border-line2 bg-s2 text-[26px]" style={{ fontFamily: SERIF }}>
          {(props.firstName[0] ?? props.email[0] ?? "?").toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold uppercase tracking-[.1em] text-tx2">
          {[name, degree, yearLabel(prefs.year)].filter(Boolean).join(" · ")}
        </span>
        <h1 className="m-0 text-[44px] font-normal leading-[1.02] tracking-[-.035em] sm:text-[52px]" style={{ fontFamily: SERIF }}>
          Tune your <span className="text-t-sky">radar.</span>
        </h1>
        <p className="m-0 text-base leading-[1.55] text-tx2">Changes apply to the next check, within 30 minutes.</p>
      </div>

      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-s1 p-6" style={{ animationDelay: "80ms" }}>
        <div className="flex items-baseline gap-3.5">
          <span className="text-5xl leading-none tracking-[-.03em]" style={{ fontFamily: SERIF }}>
            {props.count.toLocaleString("en-GB")}
          </span>
          <span className="text-tx2">open roles match your radar</span>
        </div>
        <Link href="/" className="flex h-11 items-center whitespace-nowrap rounded-[10px] bg-[#8FC7FF] px-[18px] font-medium !text-[#06111D] hover:brightness-105">
          See matches
        </Link>
      </div>

      <div className="animate-fade-up overflow-hidden rounded-2xl border border-line bg-s1" style={{ animationDelay: "140ms" }}>
        {steps.map((step, i) => {
          const isOpen = open === step.key;
          return (
            <div key={step.key} className={i ? "border-t border-line" : ""}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : step.key)}
                aria-expanded={isOpen}
                className="grid min-h-16 w-full cursor-pointer grid-cols-[32px_minmax(0,1fr)_28px] items-center gap-3 px-5 text-left text-tx hover:bg-s2 sm:grid-cols-[32px_120px_minmax(0,1fr)_28px]"
              >
                <span className="text-[12px] text-tx3" style={{ fontFamily: MONO }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] font-medium">{step.title}</span>
                <span className="hidden truncate text-sm text-tx2 sm:block">{summary(step)}</span>
                <span className="grid size-7 place-items-center rounded-[7px] bg-s2 text-tx2">
                  <svg width="12" height="12" viewBox="0 0 12 12" className="transition-transform duration-150" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", transform: `rotate(${isOpen ? 180 : 0}deg)` }}>
                    <path d="m3 4.5 3 3 3-3" />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-2 px-5 pb-[22px] pt-1 sm:pl-16">
                  {step.opts.map((option) => {
                    const on = step.value.includes(option);
                    const soon = step.soon?.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => pick(step, option)}
                        aria-pressed={on}
                        disabled={soon}
                        className="h-11 cursor-pointer whitespace-nowrap rounded-full border px-[18px] text-sm font-medium disabled:cursor-default"
                        style={{
                          borderColor: on ? "var(--l-sky)" : "var(--line)",
                          background: on ? "rgba(21,112,239,.16)" : "transparent",
                          color: soon ? "var(--tx3)" : on ? "var(--tx)" : "var(--tx2)",
                        }}
                      >
                        {soon ? `${option} · soon` : option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="animate-fade-up flex flex-col rounded-2xl border border-line bg-s1" style={{ animationDelay: "200ms" }}>
        <div className="px-5 pb-2 pt-5">
          <span className="text-[26px] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
            Alerts
          </span>
        </div>
        <AlertRow
          title="Telegram"
          sub={
            telegram === "on"
              ? `Connected${props.telegram?.username ? ` · @${props.telegram.username}` : ""}`
              : telegram === "waiting"
                ? "Press Start in Telegram to finish"
                : "Not connected"
          }
          subColour={telegram === "on" ? "var(--t-mint)" : "var(--tx3)"}
        >
          {telegram === "on" ? (
            <RowButton onClick={async () => (await disconnectTelegram()).ok && setTelegram("off")}>Disconnect</RowButton>
          ) : (
            <RowButton onClick={connectTelegram} strong>
              {telegram === "waiting" ? "Open again" : "Connect"}
            </RowButton>
          )}
        </AlertRow>
        <AlertRow title="Discord" sub="DMs or a private channel in your server" subColour="var(--tx3)">
          <span className="flex h-10 items-center whitespace-nowrap rounded-[10px] border border-line2 px-3.5 text-[13px] font-medium text-tx3">Soon</span>
        </AlertRow>
        <AlertRow
          title="Morning digest"
          sub={
            <>
              Email at{" "}
              <span className="text-tx2" style={{ fontFamily: MONO }}>
                07:30
              </span>
              {prefs.emailDigest ? " · first one soon" : " · off"}
            </>
          }
          subColour="var(--tx3)"
        >
          <RowButton onClick={() => change({ emailDigest: !prefs.emailDigest })}>{prefs.emailDigest ? "Unsubscribe" : "Subscribe"}</RowButton>
        </AlertRow>
        <AlertRow title="WhatsApp" sub="Not connected" subColour="var(--tx3)" last>
          <span className="flex h-10 items-center whitespace-nowrap rounded-[10px] border border-line2 px-3.5 text-[13px] font-medium text-tx3">Soon</span>
        </AlertRow>
      </div>

      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-s1 px-5 py-[18px]" style={{ animationDelay: "260ms" }}>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="break-all font-medium">Signed in as {props.email}</span>
          <span className="text-[13px] text-tx3">
            CVs for each job live in <Link href="/cv-studio">CV studio</Link>
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-11 cursor-pointer items-center whitespace-nowrap rounded-[10px] border px-[18px] font-medium text-[#F6B4C1] hover:bg-[rgba(244,169,184,.15)] hover:text-white"
            style={{ borderColor: "rgba(244,169,184,.5)" }}
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}

function AlertRow({ title, sub, subColour, last, children }: { title: string; sub: React.ReactNode; subColour: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 px-5 ${last ? "pb-[18px] pt-3.5" : "border-b border-line py-3.5"}`}>
      <div className="flex flex-1 flex-col gap-[3px]">
        <span className="font-medium">{title}</span>
        <span className="text-[13px]" style={{ color: subColour }}>
          {sub}
        </span>
      </div>
      {children}
    </div>
  );
}

function RowButton({ onClick, strong, children }: { onClick: () => void; strong?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 cursor-pointer whitespace-nowrap rounded-[10px] border px-3 text-[13px] font-medium ${
        strong ? "border-transparent bg-sky text-on-sky" : "border-line2 bg-transparent text-tx2 hover:text-tx"
      }`}
    >
      {children}
    </button>
  );
}
