"use client";

import Link from "next/link";
import { useState } from "react";
import { setReminder } from "@/app/(app)/calendar/actions";

export type CalendarEvent = {
  id: string;
  applicationId: string;
  /** YYYY-MM-DD, UK time */
  day: string;
  kind: "deadline" | "online_test" | "interview";
  title: string;
  company: string;
  meta: string;
  note: string;
  startsAt: string;
  reminded: boolean;
};

const SERIF = "var(--font-newsreader), Georgia, serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STYLE = {
  deadline: { bg: "var(--b-dawn)", fg: "var(--t-dawn)", label: "Deadline" },
  interview: { bg: "var(--b-sky)", fg: "var(--t-sky)", label: "Interview" },
  online_test: { bg: "var(--b-lil)", fg: "var(--t-lil)", label: "Online test" },
} as const;

/** "What do the colours mean?": the calendar explained in plain words. */
const GUIDE: { title: string; text: string; swatch: React.CSSProperties }[] = [
  {
    title: "Deadline",
    text: "The last day to apply for a role you saved or applied to, or a date you set in the Tracker. Apply before it.",
    swatch: { background: "var(--b-dawn)", borderColor: "var(--t-dawn)" },
  },
  {
    title: "Interview",
    text: "An interview or assessment centre. Move a role to Interview in the Tracker and give it a due date to see it here.",
    swatch: { background: "var(--b-sky)", borderColor: "var(--t-sky)" },
  },
  {
    title: "Online test",
    text: "A test or video interview to finish by that day. Move a role to Online test in the Tracker and set the date.",
    swatch: { background: "var(--b-lil)", borderColor: "var(--t-lil)" },
  },
  {
    title: "Expected to open (dashed)",
    text: "When a company usually opens applications, predicted from past years. These appear once Nimbus has a year of history.",
    swatch: { background: "transparent", borderColor: "var(--t-mint)", borderStyle: "dashed" },
  },
  {
    title: "Today and the day you picked",
    text: "Today's date has a filled blue circle. Click any day to see it on the right; the day you picked has a blue outline.",
    swatch: { background: "var(--bg)", borderColor: "var(--l-sky)", boxShadow: "inset 0 0 0 2px var(--l-sky)" },
  },
  {
    title: "Reminders",
    text: "Click an event, then Remind me the day before. The reminder comes to you on Telegram once you connect it in Profile.",
    swatch: { background: "#8FC7FF", borderColor: "transparent" },
  },
];

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function CalendarView({ events, today }: { events: CalendarEvent[]; today: string }) {
  const todayDate = parseKey(today);
  const [month, setMonth] = useState({ y: todayDate.getFullYear(), m: todayDate.getMonth() });
  const [sel, setSel] = useState(today);
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  // The guide starts open while the calendar is still empty (new users)
  const [guide, setGuide] = useState(events.length === 0);

  // Monday-first weeks covering the whole month
  const first = new Date(month.y, month.m, 1);
  const last = new Date(month.y, month.m + 1, 0);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  const byDay = (k: string) => events.filter((e) => e.day === k);
  const selDate = parseKey(sel);
  const selEvents = byDay(sel);
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  const toggleReminder = async (e: CalendarEvent) => {
    const on = !(reminders[e.id] ?? e.reminded);
    setReminders((r) => ({ ...r, [e.id]: on }));
    const result = await setReminder({ applicationId: e.applicationId, kind: e.kind, title: `${e.title} · ${e.company}`, startsAt: e.startsAt, on });
    if (!result.ok) setReminders((r) => ({ ...r, [e.id]: !on }));
  };

  return (
    <div className="grid items-start leading-[normal] lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="flex min-w-0 flex-col gap-[22px] px-4 pb-14 pt-11 sm:px-9">
        <div className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-baseline gap-4">
            <h1 className="m-0 text-[44px] font-normal leading-none tracking-[-.03em] sm:text-[52px]" style={{ fontFamily: SERIF }}>
              Calendar
            </h1>
            <span className="whitespace-nowrap text-[26px] italic text-t-sky sm:text-[30px]" style={{ fontFamily: SERIF }}>
              {MONTHS[month.m]} {month.y}
            </span>
          </div>
          <div className="flex gap-1.5">
            <NavButton onClick={() => shift(-1)} label="Previous month" d="M8.5 3 4.5 7l4 4" />
            <button
              type="button"
              onClick={() => {
                setMonth({ y: todayDate.getFullYear(), m: todayDate.getMonth() });
                setSel(today);
                setOpenEvent(null);
              }}
              className="h-11 cursor-pointer rounded-[10px] border border-line2 bg-s1 px-3.5 text-[13px] font-medium text-tx"
            >
              Today
            </button>
            <NavButton onClick={() => shift(1)} label="Next month" d="M5.5 3l4 4-4 4" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-[12px] text-tx2">
          {(["deadline", "interview", "online_test"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="size-2.5 rounded-[3px] border" style={{ background: STYLE[k].bg, borderColor: STYLE[k].fg }} />
              {STYLE[k].label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2.5 rounded-[3px] border border-dashed border-t-mint" />
            Expected to open
          </span>
          <button type="button" onClick={() => setGuide((g) => !g)} aria-expanded={guide} className="cursor-pointer whitespace-nowrap text-t-sky hover:text-tx">
            {guide ? "Hide the guide" : "What do the colours mean?"}
          </button>
        </div>

        {guide && (
          <div className="animate-fade-up grid gap-x-6 gap-y-3.5 rounded-2xl border border-line bg-s1 p-5 sm:grid-cols-2">
            {GUIDE.map((g) => (
              <div key={g.title} className="flex gap-3">
                <span className="mt-0.5 h-5 w-9 flex-none rounded-md border" style={g.swatch} />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-tx">{g.title}</span>
                  <span className="text-[13px] leading-normal text-tx2">{g.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="animate-fade-up grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line" style={{ animationDelay: "80ms" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="flex h-9 items-center bg-s1 px-2 text-[12px] font-medium text-tx3 sm:px-3">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const k = keyOf(d);
            const inMonth = d.getMonth() === month.m;
            const isToday = k === today;
            const dayEvents = byDay(k);
            return (
              <div
                key={k}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSel(k);
                  setOpenEvent(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && setSel(k)}
                className="flex min-h-[72px] cursor-pointer flex-col gap-1 p-1.5 hover:!bg-s2 sm:min-h-[116px] sm:p-2"
                style={{ background: inMonth ? "var(--bg)" : "var(--s1)", boxShadow: k === sel ? "inset 0 0 0 2px var(--l-sky)" : undefined }}
              >
                <span
                  className="flex h-[22px] min-w-[22px] items-center justify-center self-start rounded-full px-[5px] text-[12px]"
                  style={{
                    fontFamily: MONO,
                    color: isToday ? "var(--on-sky)" : inMonth ? "var(--tx)" : "var(--tx3)",
                    background: isToday ? "var(--sky)" : "transparent",
                  }}
                >
                  {d.getDate()}
                </span>
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSel(k);
                      setOpenEvent(e.id);
                    }}
                    className="hidden cursor-pointer rounded-md border border-transparent px-[7px] py-1 text-left text-[12px] font-medium leading-[1.3] sm:block"
                    style={{ background: STYLE[e.kind].bg, color: STYLE[e.kind].fg }}
                  >
                    <span className="line-clamp-2">
                      {e.company} · {STYLE[e.kind].label.toLowerCase()}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 0 && (
                  <span className="flex gap-1 sm:hidden">
                    {dayEvents.map((e) => (
                      <span key={e.id} className="h-1.5 flex-1 rounded-full" style={{ background: STYLE[e.kind].fg }} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {events.length === 0 && (
          <p className="m-0 text-sm text-tx3">
            Closing dates of roles you save, and the tests and interviews you add in the <Link href="/tracker">Tracker</Link>, show up here.
          </p>
        )}
      </main>

      <aside className="flex flex-col gap-[22px] border-t border-line bg-s1 px-6 py-10 lg:sticky lg:top-0 lg:min-h-[calc(100vh-65px)] lg:border-l lg:border-t-0">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-tx3">{DOW[selDate.getDay()]}</span>
          <h2 className="m-0 text-[32px] font-normal tracking-[-.02em]" style={{ fontFamily: SERIF }}>
            {selDate.getDate()} {MONTHS[selDate.getMonth()]}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {selEvents.map((e) => {
            const isOpen = openEvent === e.id;
            const on = reminders[e.id] ?? e.reminded;
            return (
              <div
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenEvent(isOpen ? null : e.id)}
                onKeyDown={(ev) => ev.key === "Enter" && setOpenEvent(isOpen ? null : e.id)}
                className="flex cursor-pointer flex-col gap-1.5 rounded-xl border bg-bg p-3.5 text-left text-tx"
                style={{ borderColor: isOpen ? "var(--l-sky)" : "var(--line)" }}
              >
                <span
                  className="flex h-[22px] items-center self-start rounded-md px-2 text-[11px] font-semibold uppercase tracking-[.04em]"
                  style={{ background: STYLE[e.kind].bg, color: STYLE[e.kind].fg }}
                >
                  {STYLE[e.kind].label}
                </span>
                <span className="text-[15px] font-medium leading-[1.35]">{e.title}</span>
                <span className="text-[13px] text-tx2">{e.company}</span>
                <span className="text-[12px]" style={{ fontFamily: MONO, color: STYLE[e.kind].fg }}>
                  {e.meta}
                </span>
                {isOpen && (
                  <div className="mt-1.5 flex flex-col gap-2.5 border-t border-line pt-2.5">
                    <span className="text-[13px] leading-normal text-tx2">{e.note}</span>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggleReminder(e);
                      }}
                      className="flex h-10 cursor-pointer items-center justify-center rounded-[10px] border text-[13px] font-semibold"
                      style={
                        on
                          ? { background: "transparent", color: "var(--t-mint)", borderColor: "rgba(147,224,192,.5)" }
                          : { background: "#8FC7FF", color: "#06111D", borderColor: "transparent" }
                      }
                    >
                      {on ? "Reminder set for the day before" : "Remind me the day before"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {selEvents.length === 0 && <div className="rounded-xl border border-dashed border-line2 p-[18px] text-[13px] text-tx3">Nothing on this day.</div>}
        </div>
        <div className="flex flex-col gap-2.5 border-t border-line pt-[18px]">
          <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-t-mint">Expected to open soon</span>
          <span className="text-[13px] leading-normal text-tx3">
            Nimbus learns when each company opens from what it sees this season. Predictions appear here once there is a year of history.
          </span>
        </div>
      </aside>
    </div>
  );
}

function NavButton({ onClick, label, d }: { onClick: () => void; label: string; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 cursor-pointer place-items-center rounded-[10px] border border-line2 bg-s1 text-tx"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }}>
        <path d={d} />
      </svg>
    </button>
  );
}
