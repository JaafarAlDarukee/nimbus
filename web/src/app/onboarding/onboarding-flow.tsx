"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark, Sparkle, StarField, TELEGRAM_BOT_URL, Wordmark } from "@/components/brand";
import {
  ABROAD_LOCATIONS,
  DEGREE_NOTES,
  DEGREES_BY_FIELD,
  FIELDS,
  SECTOR_GROUPS,
  SUGGEST,
  TYPES,
  UK_LOCATIONS,
  YEARS,
} from "@/lib/onboarding-data";
import { applyMatch, matchFilters, type Preferences } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "name", label: "Name", title: "First, what should we call you?", sub: "Your name goes on your CVs and cover letters. You can change it later in Profile." },
  { key: "field", label: "Field", title: "Start with your field.", sub: "Engineering is fully covered today. Science and medical roles are being added; computing and business are on the way." },
  { key: "deg", label: "Degree", title: "Which degree are you on?", sub: "Pick every one that fits. Joint honours count. Add yours if it is not listed." },
  { key: "year", label: "Year", title: "Where are you in your course?", sub: "Spring weeks, placements and grad schemes open to different years, so this filters a lot." },
  { key: "sec", label: "Industries", title: "Which industries pull you in?", sub: "The starred set is common for your degree. Pick as many as you like, or leave it empty to hear about all of them." },
  { key: "types", label: "Opportunities", title: "What kind of opportunities do you want?", sub: "Roles, events and funding. Select everything you would say yes to." },
  { key: "loc", label: "Location", title: "Where would you go for the right role?", sub: "Most roles are UK based. Add any country or city you would move to." },
  { key: "cv", label: "CV", title: "Add your CV.", sub: "It stays private to you. CV studio will read it the way applicant tracking systems do and score it against each role." },
  { key: "alerts", label: "Alerts", title: "How should we reach you?", sub: "Telegram is fastest. Your alerts are only your matches, never anyone else's." },
  { key: "offer", label: "What you get", title: "This is what Nimbus does for you.", sub: "Your radar is set. Here is what is switched on today, and what is coming next." },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const OFFERS = [
  { t: "Alerts within hours", d: "We check 2,900+ careers pages every 30 minutes and message you when something opens.", c: "#8FC7FF", on: true },
  { t: "Where and how to apply", d: "A direct link to the employer’s own application, never a job board copy.", c: "#93E0C0", on: true },
  { t: "Published contacts", d: "The early-careers team or named contact the employer lists, plus LinkedIn.", c: "#C3B5FF", on: false },
  { t: "CV and ATS score", d: "A score for every role, with the exact keywords you are missing.", c: "#F3C38F", on: false },
  { t: "Prompts for Claude", d: "Tailor my CV, Interview prep and Company brief, filled in for each role.", c: "#7FD6D6", on: false },
  { t: "Tracker", d: "Every application in one table, with follow-up nudges when things go quiet.", c: "#F4A9B8", on: false },
  { t: "Calendar", d: "Deadlines, tests and interviews, plus when roles are likely to open.", c: "#8FC7FF", on: false },
  { t: "Companies", d: "Every employer we watch for your degree, sorted by industry.", c: "#93E0C0", on: false },
  { t: "CV studio", d: "Check your CV and cover letter against each job and download them as PDFs.", c: "#C3B5FF", on: false },
];

const HALO: Record<string, string> = {
  "#8FC7FF": "rgba(143,199,255,.35)", "#93E0C0": "rgba(147,224,192,.35)", "#C3B5FF": "rgba(195,181,255,.35)",
  "#F3C38F": "rgba(243,195,143,.35)", "#7FD6D6": "rgba(127,214,214,.35)", "#F4A9B8": "rgba(244,169,184,.35)",
};

const eyebrow = "text-xs font-semibold uppercase tracking-[0.08em] text-tx3";
const textInput =
  "h-[52px] rounded-xl border border-line2 bg-s1 px-4 text-base text-tx outline-none focus:border-sky";
const addInput =
  "h-11 flex-1 rounded-[10px] border border-dashed border-line2 bg-transparent px-3.5 text-sm text-tx outline-none focus:border-l-sky";
const addButton = "h-11 rounded-[10px] border border-line2 bg-s2 px-4 text-sm font-medium text-tx";

function Tick({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md border"
      style={{
        width: size,
        height: size,
        borderColor: on ? "var(--l-sky)" : "var(--line2)",
        background: on ? "var(--sky)" : "transparent",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ fill: "none", stroke: "var(--on-sky)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", opacity: on ? 1 : 0 }}>
        <path d="m2 5 2 2 4-4" />
      </svg>
    </span>
  );
}

function Chip({ label, on, onClick, size = "md" }: { label: string; on: boolean; onClick: () => void; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3.5 font-medium transition-colors",
        size === "lg" ? "h-[42px] text-sm" : "h-10 text-[13px]",
      )}
      style={{
        borderColor: on ? "var(--l-sky)" : "var(--line2)",
        background: on ? "var(--b-sky)" : "transparent",
        color: on ? "var(--t-sky)" : "var(--tx2)",
      }}
    >
      {label}
    </button>
  );
}

function AddRow({ placeholder, value, onChange, onAdd }: { placeholder: string; value: string; onChange: (v: string) => void; onAdd: () => void }) {
  return (
    <div className="flex max-w-[460px] gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        className={addInput}
      />
      <button type="button" onClick={onAdd} className={addButton}>
        Add
      </button>
    </div>
  );
}

export function OnboardingFlow({
  userId,
  email,
  initialFirst,
  initialLast,
  initialPreferences,
  telegramConnected,
}: {
  userId: string;
  email: string;
  initialFirst: string;
  initialLast: string;
  initialPreferences: Preferences;
  telegramConnected: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences);
  const [drafts, setDrafts] = useState({ deg: "", sec: "", types: "", abroad: "" });
  const [secQuery, setSecQuery] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [cvState, setCvState] = useState<{ status: "idle" | "uploading" | "error"; message?: string }>({ status: "idle" });
  const [telegram, setTelegram] = useState<"off" | "waiting" | "on">(telegramConnected ? "on" : "off");
  const fileInput = useRef<HTMLInputElement>(null);

  const S = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const update = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }));
  const toggle = (key: "degrees" | "sectors" | "types" | "uk" | "abroad", value: string) =>
    setPrefs((p) => ({ ...p, [key]: p[key].includes(value) ? p[key].filter((x) => x !== value) : [...p[key], value] }));

  // Live count of open roles matching the current answers
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const base = supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "open");
      const { count: total } = await applyMatch(base, matchFilters(prefs));
      if (!cancelled) setCount(total ?? 0);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prefs, supabase]);

  async function save(finish: boolean) {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        first_name: first.trim() || null,
        last_name: last.trim() || null,
        display_name: [first.trim(), last.trim()].filter(Boolean).join(" ") || null,
        preferences: prefs,
        ...(finish ? { onboarded_at: new Date().toISOString() } : {}),
      })
      .eq("id", userId);
    setSaving(false);
  }

  const nameOk = S.key !== "name" || (first.trim() !== "" && last.trim() !== "");

  async function next() {
    if (!nameOk || saving) return;
    if (isLast) {
      await save(true);
      router.push("/");
      router.refresh();
      return;
    }
    void save(false);
    setStep((s) => s + 1);
  }

  async function finishLater() {
    await save(true);
    router.push("/");
    router.refresh();
  }

  function addExtra(kind: "deg" | "sec" | "types" | "abroad") {
    const value = drafts[kind].trim();
    if (!value) return;
    const listKey = { deg: "degrees", sec: "sectors", types: "types", abroad: "abroad" }[kind] as "degrees" | "sectors" | "types" | "abroad";
    setPrefs((p) => ({
      ...p,
      extra: { ...p.extra, [kind]: p.extra[kind].includes(value) ? p.extra[kind] : [...p.extra[kind], value] },
      [listKey]: p[listKey].includes(value) ? p[listKey] : [...p[listKey], value],
    }));
    setDrafts((d) => ({ ...d, [kind]: "" }));
  }

  async function uploadCv(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setCvState({ status: "error", message: "That file is over 5 MB." });
      return;
    }
    const ext = file.name.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
    setCvState({ status: "uploading" });
    const path = `${userId}/main-cv.${ext}`;
    const { error } = await supabase.storage.from("cvs").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setCvState({ status: "error", message: "Upload failed. Try again, or skip for now." });
      return;
    }
    update({ cvPath: path, cvName: file.name });
    setCvState({ status: "idle" });
  }

  async function removeCv() {
    if (prefs.cvPath) await supabase.storage.from("cvs").remove([prefs.cvPath]);
    update({ cvPath: null, cvName: null });
  }

  async function connectTelegram() {
    const { data } = await supabase.from("telegram_links").insert({ user_id: userId }).select("code").single();
    if (data?.code) {
      window.open(`${TELEGRAM_BOT_URL}?start=${data.code}`, "_blank", "noopener");
      setTelegram("waiting");
    }
  }

  // Constellation stepper summaries
  const locations = [...prefs.uk, ...prefs.abroad];
  const summary: Record<StepKey, string> = {
    name: [first, last].filter((x) => x.trim()).join(" "),
    field: prefs.field,
    deg: prefs.degrees.join(", ") || "Not set",
    year: prefs.year,
    sec: prefs.sectorsAll ? "Everything" : prefs.sectors.length ? `${prefs.sectors.length} picked` : "Not set",
    types: `${prefs.types.length} types`,
    loc: locations.slice(0, 2).join(", ") + (locations.length > 2 ? ` +${locations.length - 2}` : ""),
    cv: prefs.cvName ? "Added" : "Not added",
    alerts: [telegram === "on" ? "Telegram" : telegram === "waiting" ? "Telegram (pending)" : "", prefs.emailDigest ? "Email" : ""].filter(Boolean).join(", ") || "None yet",
    offer: "",
  };

  const degreeOptions = [...(DEGREES_BY_FIELD[prefs.field] ?? []), ...prefs.extra.deg];
  const suggestions = [...new Set(prefs.degrees.flatMap((d) => SUGGEST[d] ?? []))];
  const q = secQuery.trim().toLowerCase();
  const sectorGroups = [...SECTOR_GROUPS, ...(prefs.extra.sec.length ? [{ g: "Your additions", items: prefs.extra.sec }] : [])]
    .map((g) => ({ g: g.g, items: g.items.filter((s) => !q || s.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length);
  const pickSector = (s: string) =>
    setPrefs((p) => ({ ...p, sectorsAll: false, sectors: p.sectors.includes(s) ? p.sectors.filter((x) => x !== s) : [...p.sectors, s] }));

  return (
    <div className="grid min-h-screen bg-bg text-sm text-tx lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Night-sky constellation stepper */}
      <aside
        className="sticky top-0 hidden h-screen flex-col overflow-y-auto overflow-x-hidden border-r border-line px-8 pb-7 pt-8 lg:flex"
        style={{ background: "radial-gradient(90% 60% at 20% 0%,#16264A 0%,#0C1426 45%,#070A12 100%)", scrollbarWidth: "none" }}
      >
        <StarField count={46} seed={7} />
        <div className="relative flex items-center gap-2.5">
          <LogoMark size={30} />
          <Wordmark size={26} />
        </div>
        <div className="relative mt-8 flex flex-col">
          <span className="mb-[18px] font-mono text-[11px] uppercase tracking-[0.08em] text-[#8793A6]">Your radar, star by star</span>
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!done}
                onClick={() => done && setStep(i)}
                className="relative grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3 bg-transparent pb-2.5 text-left disabled:cursor-default"
              >
                <span
                  className="absolute left-2.5 top-4 w-px"
                  style={{ bottom: -2, background: i === STEPS.length - 1 ? "transparent" : done ? "rgba(143,199,255,.45)" : "rgba(135,147,166,.22)" }}
                />
                <span className="relative grid size-[22px] place-items-center">
                  <span
                    className="rounded-full border"
                    style={{
                      width: current ? 10 : done ? 8 : 6,
                      height: current ? 10 : done ? 8 : 6,
                      background: current ? "#fff" : done ? "#8FC7FF" : "transparent",
                      borderColor: current ? "#fff" : done ? "#8FC7FF" : "#4A5568",
                      boxShadow: current
                        ? "0 0 0 4px rgba(143,199,255,.18),0 0 14px rgba(143,199,255,.8)"
                        : done
                          ? "0 0 8px rgba(143,199,255,.6)"
                          : "none",
                    }}
                  />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className="text-sm font-medium" style={{ color: current ? "#fff" : done ? "#DDE6F2" : "#8793A6" }}>
                    {s.label}
                  </span>
                  <span className="truncate text-xs text-[#8793A6]">{i <= step ? summary[s.key] : ""}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative mt-5 flex flex-none flex-col gap-1 rounded-[14px] border border-[rgba(143,199,255,.22)] bg-[rgba(7,10,18,.6)] px-[18px] py-4">
          <span className="font-serif text-4xl leading-none tracking-[-0.03em]">{count === null ? "…" : count.toLocaleString("en-GB")}</span>
          <span className="text-[13px] text-tx2">open roles on your radar right now</span>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col">
        <div className="flex w-full max-w-[820px] flex-1 flex-col gap-7 px-6 pb-10 pt-10 md:px-16 md:pt-14">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-tx3">
              <span className="text-t-sky">{String(step + 1).padStart(2, "0")}</span> / {String(STEPS.length).padStart(2, "0")}
            </span>
            <button type="button" onClick={finishLater} className="text-[13px] text-tx3 hover:text-tx">
              Finish later
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="m-0 font-serif text-[40px] font-normal leading-[1.02] tracking-[-0.03em] md:text-[50px]" style={{ textWrap: "balance" }}>
              {S.title}
            </h1>
            <p className="m-0 max-w-[560px] text-base leading-[1.55] text-tx2" style={{ textWrap: "pretty" }}>
              {S.sub}
            </p>
          </div>

          {S.key === "name" && (
            <>
              <div className="grid max-w-[620px] grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className={eyebrow}>First name</span>
                  <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Sam" autoComplete="given-name" className={textInput} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className={eyebrow}>Surname</span>
                  <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Okafor" autoComplete="family-name" className={textInput} />
                </label>
              </div>
              <span className="min-h-[30px] font-serif text-2xl text-t-sky">{first.trim() ? `Nice to meet you, ${first.trim()}.` : ""}</span>
            </>
          )}

          {S.key === "field" && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {FIELDS.map((f) => {
                const on = prefs.field === f.label;
                return (
                  <button
                    key={f.label}
                    type="button"
                    disabled={f.soon}
                    aria-pressed={on}
                    onClick={() => !on && update({ field: f.label, degrees: [], sectors: [] })}
                    className="flex min-h-[124px] flex-col justify-between rounded-[14px] border px-5 py-[18px] text-left disabled:cursor-not-allowed"
                    style={{ borderColor: on ? "var(--l-sky)" : "var(--line2)", background: on ? "var(--b-sky)" : "var(--s1)", opacity: f.soon ? 0.45 : 1 }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: f.soon ? "var(--tx3)" : on ? "var(--t-sky)" : "var(--mint)" }}>
                      {f.soon ? "Soon" : on ? "Selected" : "Available"}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="font-serif text-[26px] tracking-[-0.02em]">{f.label}</span>
                      <span className="text-xs text-tx3">{f.d}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {S.key === "deg" && (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {degreeOptions.map((d) => {
                  const on = prefs.degrees.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle("degrees", d)}
                      className="flex flex-col gap-2 rounded-[14px] border px-5 py-[18px] text-left"
                      style={{ borderColor: on ? "var(--l-sky)" : "var(--line2)", background: on ? "var(--b-sky)" : "var(--s1)" }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-serif text-2xl tracking-[-0.02em]">{d}</span>
                        <Tick on={on} />
                      </span>
                      <span className="text-[13px] leading-[1.45] text-tx3">
                        {DEGREE_NOTES[d] ?? (prefs.extra.deg.includes(d) ? "Added by you" : `${prefs.field} degree`)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <AddRow placeholder="Other degree, e.g. Acoustical Engineering" value={drafts.deg} onChange={(v) => setDrafts((d) => ({ ...d, deg: v }))} onAdd={() => addExtra("deg")} />
            </>
          )}

          {S.key === "year" && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {YEARS.map((y) => {
                const on = prefs.year === y;
                return (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ year: y })}
                    className="h-16 rounded-xl border px-[18px] text-left text-[15px] font-medium"
                    style={{ borderColor: on ? "var(--l-sky)" : "var(--line2)", background: on ? "var(--b-sky)" : "transparent", color: on ? "var(--t-sky)" : "var(--tx2)" }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {S.key === "sec" && (
            <>
              <label className="flex h-[46px] items-center gap-2.5 rounded-xl border border-line2 bg-s1 px-3.5 text-tx3">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="flex-none" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5 14 14" />
                </svg>
                <input value={secQuery} onChange={(e) => setSecQuery(e.target.value)} placeholder="Search 90+ industries" className="h-full flex-1 bg-transparent text-[15px] text-tx outline-none" />
                <span className="font-mono text-xs">{prefs.sectors.length} picked</span>
              </label>
              <button
                type="button"
                aria-pressed={prefs.sectorsAll}
                onClick={() => update({ sectorsAll: !prefs.sectorsAll, sectors: [] })}
                className="grid grid-cols-[minmax(0,1fr)_20px] items-center gap-3 rounded-[14px] border px-[18px] py-4 text-left"
                style={{ borderColor: prefs.sectorsAll ? "var(--l-sky)" : "var(--line2)", background: prefs.sectorsAll ? "var(--b-sky)" : "var(--s1)" }}
              >
                <span className="flex flex-col gap-[3px]">
                  <span className="text-[15px] font-medium">Not sure yet, show me everything</span>
                  <span className="text-[13px] text-tx3">No industry in mind? We&apos;ll send every match for your degree and you can narrow it later.</span>
                </span>
                <Tick on={prefs.sectorsAll} />
              </button>
              {suggestions.length > 0 && !q && (
                <div className="flex flex-col gap-3 rounded-[14px] border border-[rgba(243,195,143,.3)] bg-[rgba(243,195,143,.04)] px-[18px] py-4">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-t-dawn">
                    <Sparkle className="size-3" style={{ fill: "currentColor" }} />
                    Common for {prefs.degrees.slice(0, 2).join(" and ")} students
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <Chip key={s} label={s} on={prefs.sectors.includes(s)} onClick={() => pickSector(s)} />
                    ))}
                  </div>
                </div>
              )}
              {sectorGroups.map((g) => (
                <div key={g.g} className="flex flex-col gap-2.5">
                  <span className={eyebrow}>{g.g}</span>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((s) => (
                      <Chip key={s} label={s} on={prefs.sectors.includes(s)} onClick={() => pickSector(s)} />
                    ))}
                  </div>
                </div>
              ))}
              <AddRow placeholder="Other industry, e.g. Theme park rides" value={drafts.sec} onChange={(v) => setDrafts((d) => ({ ...d, sec: v }))} onAdd={() => addExtra("sec")} />
            </>
          )}

          {S.key === "types" && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[...TYPES, ...prefs.extra.types.map((t) => ({ t, d: "Added by you" }))].map((o) => {
                  const on = prefs.types.includes(o.t);
                  return (
                    <button
                      key={o.t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle("types", o.t)}
                      className="grid grid-cols-[minmax(0,1fr)_20px] items-center gap-2.5 rounded-xl border px-4 py-3.5 text-left"
                      style={{ borderColor: on ? "var(--l-sky)" : "var(--line2)", background: on ? "var(--b-sky)" : "transparent" }}
                    >
                      <span className="flex min-w-0 flex-col gap-[3px]">
                        <span className="text-[15px] font-medium">{o.t}</span>
                        <span className="text-[13px] text-tx3">{o.d}</span>
                      </span>
                      <Tick on={on} size={18} />
                    </button>
                  );
                })}
              </div>
              <AddRow placeholder="Something else, e.g. Formula Student team roles" value={drafts.types} onChange={(v) => setDrafts((d) => ({ ...d, types: v }))} onAdd={() => addExtra("types")} />
            </>
          )}

          {S.key === "loc" && (
            <>
              <div className="flex flex-col gap-2.5">
                <span className={eyebrow}>United Kingdom</span>
                <div className="flex flex-wrap gap-2">
                  {UK_LOCATIONS.map((l) => (
                    <Chip key={l} size="lg" label={l} on={prefs.uk.includes(l)} onClick={() => toggle("uk", l)} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className={eyebrow}>Abroad</span>
                <div className="flex flex-wrap gap-2">
                  {[...ABROAD_LOCATIONS, ...prefs.extra.abroad].map((l) => (
                    <Chip key={l} size="lg" label={l} on={prefs.abroad.includes(l)} onClick={() => toggle("abroad", l)} />
                  ))}
                </div>
              </div>
              <AddRow placeholder="Add a country or city, e.g. Denmark" value={drafts.abroad} onChange={(v) => setDrafts((d) => ({ ...d, abroad: v }))} onAdd={() => addExtra("abroad")} />
            </>
          )}

          {S.key === "cv" && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCv(file);
                  e.target.value = "";
                }}
              />
              {!prefs.cvName ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) void uploadCv(file);
                    }}
                    className="flex h-[200px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-line2 bg-s1 hover:border-l-sky"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden style={{ fill: "none", stroke: "var(--t-sky)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}>
                      <path d="M7.5 17.5h9a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.6 1.1A3 3 0 0 0 7.5 17.5z" />
                      <path d="M12 15v-5M9.8 12 12 9.8l2.2 2.2" />
                    </svg>
                    <span className="text-base font-medium">{cvState.status === "uploading" ? "Uploading…" : "Drop your CV here, or click to choose"}</span>
                    <span className="text-[13px] text-tx3">PDF or DOCX, up to 5 MB. It stays private.</span>
                  </button>
                  {cvState.status === "error" && <span className="text-[13px] text-rose">{cvState.message}</span>}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button type="button" onClick={next} className="h-14 rounded-xl border border-line2 bg-s1 text-[15px] font-medium">
                      I don&apos;t have a CV yet
                    </button>
                    <button type="button" onClick={next} className="h-14 rounded-xl border border-line2 bg-s1 text-[15px] font-medium">
                      Skip for now
                    </button>
                  </div>
                  <span className="text-[13px] leading-normal text-tx3">That&apos;s fine. You&apos;ll still get matches, and you can upload a CV any time from Profile.</span>
                </>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border border-line bg-s1 px-6 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{prefs.cvName}</span>
                    <button type="button" onClick={removeCv} className="h-8 text-[13px] font-medium text-tx3 hover:text-tx">
                      Remove
                    </button>
                  </div>
                  <span className="text-[13px] leading-normal text-tx2">
                    Saved privately. Your ATS score and missing keywords will appear here once CV studio launches.
                  </span>
                </div>
              )}
            </>
          )}

          {S.key === "alerts" && (
            <>
              <div className="flex flex-col rounded-2xl border border-line bg-s1">
                {[
                  {
                    label: "Telegram", i: "T", col: "var(--t-sky)", tint: "rgba(143,199,255,.14)",
                    sub: telegram === "on" ? "Connected" : telegram === "waiting" ? "Press Start in Telegram. We’ll confirm there within 30 minutes." : "Instant alert with Open, Save and Applied buttons",
                    btn: telegram === "on" ? "Connected" : telegram === "waiting" ? "Open again" : "Connect",
                    active: telegram !== "on", onClick: connectTelegram, soon: false,
                  },
                  { label: "Discord", i: "D", col: "var(--lilac)", tint: "rgba(195,181,255,.14)", sub: "Direct messages or a private channel in your server", btn: "Soon", active: false, onClick: () => {}, soon: true },
                  { label: "WhatsApp", i: "W", col: "var(--mint)", tint: "rgba(147,224,192,.14)", sub: "Short alerts to your phone number", btn: "Soon", active: false, onClick: () => {}, soon: true },
                  {
                    label: "Email digest", i: "E", col: "var(--t-dawn)", tint: "rgba(243,195,143,.14)",
                    sub: prefs.emailDigest ? `On · ${email}` : "Morning digest at 07:30",
                    btn: prefs.emailDigest ? "Turn off" : "Turn on", active: !prefs.emailDigest,
                    onClick: () => update({ emailDigest: !prefs.emailDigest }), soon: false,
                  },
                ].map((c, idx) => (
                  <div key={c.label} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 px-5 py-4" style={{ borderTop: idx ? "1px solid var(--line)" : "none" }}>
                    <span className="grid size-10 place-items-center rounded-[11px] font-serif text-xl" style={{ background: c.tint, color: c.col }}>
                      {c.i}
                    </span>
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="text-[15px] font-medium">{c.label}</span>
                      <span className="text-[13px] text-tx3">{c.sub}</span>
                    </span>
                    <button
                      type="button"
                      disabled={c.soon}
                      onClick={c.onClick}
                      className="h-11 whitespace-nowrap rounded-[10px] border px-4 text-sm font-medium disabled:opacity-50"
                      style={{
                        borderColor: c.active ? "transparent" : "var(--line2)",
                        background: c.active ? "var(--sky)" : "transparent",
                        color: c.active ? "var(--on-sky)" : "var(--tx2)",
                      }}
                    >
                      {c.btn}
                    </button>
                  </div>
                ))}
              </div>
              <span className="text-[13px] text-tx3">Quiet hours 22:00 to 07:00. Deadlines inside 24 hours still come through.</span>
            </>
          )}

          {S.key === "offer" && (
            <div
              className="relative overflow-hidden rounded-[18px] border border-[rgba(143,199,255,.28)]"
              style={{
                background: "linear-gradient(180deg,rgba(143,199,255,.07),rgba(143,199,255,0) 60%),var(--s1)",
                boxShadow: "0 0 0 1px rgba(143,199,255,.06),0 20px 60px -20px rgba(143,199,255,.25)",
              }}
            >
              {OFFERS.map((o, i) => (
                <div key={o.t} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 px-[22px] py-4" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <span className="grid size-9 place-items-center rounded-full" style={{ background: HALO[o.c].replace(".35", ".12"), boxShadow: `0 0 18px ${HALO[o.c]}` }}>
                    <Sparkle className="size-3.5" style={{ fill: o.c }} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-base font-medium">{o.t}</span>
                    <span className="text-sm leading-normal text-tx2">{o.d}</span>
                  </span>
                  <span
                    className="whitespace-nowrap rounded-full border px-2.5 py-1 text-xs"
                    style={o.on ? { color: o.c, borderColor: HALO[o.c] } : { color: "var(--tx3)", borderColor: "var(--line2)" }}
                  >
                    {o.on ? "On" : "Soon"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-line bg-[rgba(11,14,19,.92)] backdrop-blur-[8px]">
          <div className="flex max-w-[820px] items-center gap-2.5 px-6 py-3.5 md:px-16">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="h-12 rounded-xl border border-line2 bg-transparent px-[18px] text-[15px] font-medium disabled:opacity-35"
            >
              Back
            </button>
            {(S.key === "sec" || S.key === "alerts") && (
              <button type="button" onClick={next} className="h-12 px-3.5 text-sm font-medium text-tx3">
                Skip for now
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!nameOk || saving}
              className="ml-auto h-12 whitespace-nowrap rounded-xl px-[26px] text-[15px] font-semibold hover:brightness-105 disabled:cursor-not-allowed"
              style={{ background: nameOk ? "var(--sky)" : "var(--line2)", color: nameOk ? "var(--on-sky)" : "var(--tx3)" }}
            >
              {isLast ? "Open my radar" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
