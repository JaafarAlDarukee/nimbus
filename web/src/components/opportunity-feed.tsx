"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { track } from "@/app/(app)/actions";
import { SPARKLE, StarField, TelegramFab } from "@/components/brand";
import { TYPE_CHIPS, type OpportunityView } from "@/lib/opportunity-types";

type Props = {
  tab: "you" | "all";
  type: string;
  q: string;
  limit: number;
  opportunities: OpportunityView[];
  hasMore: boolean;
  counts: { you: number; all: number };
  newCount: number;
  tracked: Record<string, string>;
  /** The phone layout's extra tabs (mobile design) */
  phone: { closingSoon: OpportunityView[]; saved: OpportunityView[]; today: number; weekday: string };
  find: boolean;
  error: string | null;
};

const SERIF = "var(--font-newsreader), Georgia, serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[.08em] text-[#626C7C]";

const ringColour = (match: number) => (match >= 85 ? "var(--t-mint)" : match >= 75 ? "var(--t-sky)" : "var(--t-dawn)");

export function OpportunityFeed(props: Props) {
  const { tab, type, opportunities, counts, error } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(props.q);
  const [selected, setSelected] = useState<OpportunityView | null>(null);
  // The role the "check your CV first?" question is about
  const [applyFor, setApplyFor] = useState<OpportunityView | null>(null);
  // What the user just saved or applied to, on top of what the server knows
  const [changes, setChanges] = useState<Record<string, string | undefined>>({});
  const tracked: Record<string, string | undefined> = { ...props.tracked, ...changes };
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (next: Partial<{ tab: string; type: string; q: string; n: number }>, replace = false) => {
    const state = { tab, type, q, n: undefined as number | undefined, ...next };
    const params = new URLSearchParams();
    if (state.tab === "all") params.set("tab", "all");
    if (state.type && state.type !== "All types") params.set("type", state.type);
    if (state.q.trim()) params.set("q", state.q.trim());
    if (state.n) params.set("n", String(state.n));
    const href = params.size ? `${pathname}?${params}` : pathname;
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
  };

  // Search as you type, without a request for every key press
  useEffect(() => {
    if (q.trim() === props.q) return;
    const timer = setTimeout(() => go({ q }, true), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Escape closes the top-most layer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (applyFor) setApplyFor(null);
      else setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyFor]);

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const add = async (o: OpportunityView, stage: "saved" | "applied") => {
    const before = tracked[o.id];
    setChanges((c) => ({ ...c, [o.id]: stage === "saved" && before && before !== "saved" ? before : stage }));
    const result = await track(o.id, stage);
    if (!result.ok) {
      setChanges((c) => ({ ...c, [o.id]: before }));
      showToast("Couldn't reach your tracker. Try again.");
      return;
    }
    showToast(stage === "applied" ? "Added to your tracker as Applied" : "Saved to your tracker");
  };

  const copy = (label: string, o: OpportunityView) => {
    const text = {
      "Tailor my CV": `Here is my CV and a job advert for "${o.title}" at ${o.company}. Rewrite my bullet points to match what they ask for, without inventing experience.${o.advert ? `\n\nJob advert:\n${o.advert}` : ""}\n\nMy CV:\n`,
      "Interview prep": `I have an interview for "${o.title}" at ${o.company}. Give me the 10 questions most likely to come up, with strong answer outlines from my CV.`,
      "Company brief": `Give me a one-page brief on ${o.company}: what they make, recent news, engineering culture and what their early-careers team looks for.`,
    }[label];
    navigator.clipboard?.writeText(text ?? "").catch(() => {});
    setCopied(label);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const applied = selected ? tracked[selected.id] && tracked[selected.id] !== "saved" : false;

  const openAndApply = () => {
    if (!selected) return;
    if (applied) window.open(selected.applyUrl, "_blank", "noopener,noreferrer");
    else setApplyFor(selected);
  };

  return (
    <>
      {/* Top glow and stars sit behind the header as well */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"
        style={{
          background:
            "radial-gradient(90% 420px at 50% -60px, rgba(60,120,210,.45) 0%, rgba(30,60,120,.2) 45%, rgba(17,23,34,0) 80%)",
        }}
      >
        <StarField count={60} seed={5} height={90} />
        <svg viewBox="0 0 10 10" className="animate-sparkle absolute left-[18%] top-[120px] size-3 opacity-90" style={{ fill: "#F3C38F" }}>
          <path d={SPARKLE} />
        </svg>
        <svg
          viewBox="0 0 10 10"
          className="animate-sparkle absolute right-[22%] top-[170px] size-[9px] opacity-90"
          style={{ fill: "#C3B5FF", animationDelay: "1.4s" }}
        >
          <path d={SPARKLE} />
        </svg>
      </div>

      <main className="relative mx-auto hidden max-w-[928px] flex-col gap-7 px-6 pb-[120px] pt-16 leading-[normal] md:flex">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <span
            className="animate-fade-up flex h-[30px] items-center gap-2 rounded-full px-3 text-[13px] text-t-sky"
            style={{ background: "rgba(143,199,255,.12)", border: "1px solid rgba(143,199,255,.35)" }}
          >
            <span className="size-1.5 rounded-full bg-t-mint" style={{ boxShadow: "0 0 8px #93E0C0" }} />
            {props.newCount.toLocaleString("en-GB")} opened since yesterday
          </span>
          <h1
            className="animate-fade-up m-0 text-[44px] font-normal leading-none tracking-[-.035em] sm:text-[60px]"
            style={{ fontFamily: SERIF, animationDelay: "60ms" }}
          >
            Opportunities <span className="italic text-t-sky">{tab === "you" ? "for you." : "everywhere."}</span>
          </h1>
          <p className="animate-fade-up m-0 text-[15px] text-tx2" style={{ animationDelay: "120ms" }}>
            Newest first. Everything here was found on the employer&apos;s own site.
          </p>
        </div>

        <div className="animate-fade-up flex flex-col gap-3.5" style={{ animationDelay: "180ms" }}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex gap-0.5 self-start rounded-xl border border-line bg-s1 p-[3px]">
              {(
                [
                  ["you", "For you", counts.you],
                  ["all", "All", counts.all],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => go({ tab: id })}
                  aria-pressed={tab === id}
                  className={`flex h-[38px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-[9px] px-4 text-[13px] font-medium transition-colors ${
                    tab === id ? "bg-s2 text-tx" : "bg-transparent text-tx2 hover:text-tx"
                  }`}
                >
                  {label}
                  <span className="text-[11px] text-tx3" style={{ fontFamily: MONO }}>
                    {count.toLocaleString("en-GB")}
                  </span>
                </button>
              ))}
            </div>
            <label className="flex h-[46px] flex-none items-center sm:flex-1 gap-2.5 rounded-xl border border-line bg-s1 px-3.5 text-tx3 focus-within:border-l-sky">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="flex-none" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search roles, companies, places"
                aria-label="Search roles, companies, places"
                className="h-full min-w-0 flex-1 border-none bg-transparent text-sm text-tx outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => go({ type: c.label })}
                aria-pressed={type === c.label}
                className={`h-[34px] cursor-pointer whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                  type === c.label ? "border-l-sky bg-b-sky text-t-sky" : "border-line bg-transparent text-tx2 hover:text-tx"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`flex flex-col gap-2.5 transition-opacity ${pending ? "opacity-60" : ""}`}>
          {error && (
            <div className="rounded-[14px] border border-dashed border-line2 px-5 py-12 text-center text-tx3">{error}</div>
          )}
          {opportunities.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o)}
              className="animate-fade-up grid cursor-pointer grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-line bg-s1 px-5 py-[18px] text-left text-tx transition-colors hover:border-l-sky hover:bg-s2"
              style={{ boxShadow: "0 1px 0 rgba(255,255,255,.04) inset", animationDelay: `${Math.min(i, 10) * 40 + 220}ms` }}
            >
              <LogoTile o={o} size={48} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <TypePill o={o} />
                  {o.isNew && (
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-t-mint">
                      <span className="size-1.5 rounded-full bg-t-mint" style={{ boxShadow: "0 0 6px #93E0C0" }} />
                      Just opened
                    </span>
                  )}
                  {tracked[o.id] && <span className="text-[12px] text-t-sky">· In tracker</span>}
                </div>
                <span className="truncate text-[17px] font-medium">{o.title}</span>
                <span className="text-sm text-tx2">
                  {o.company} · {o.loc}{" "}
                  <span className="text-[12px] text-tx3" style={{ fontFamily: MONO }}>
                    · found {o.found}
                  </span>
                </span>
              </div>
              <MatchRing match={o.match} />
            </button>
          ))}
          {!error && opportunities.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-line2 px-5 py-12 text-center text-tx3">
              Nothing matches. Try fewer filters.
            </div>
          )}
          {props.hasMore && (
            <button
              type="button"
              onClick={() => go({ n: props.limit + 40 })}
              className="mx-auto mt-3 h-[38px] cursor-pointer rounded-full border border-line px-4 text-[13px] font-medium text-tx2 transition-colors hover:border-l-sky hover:text-tx"
            >
              {pending ? "Loading…" : "Show more"}
            </button>
          )}
        </div>
      </main>

      <PhoneFeed
        {...props}
        tracked={tracked}
        q={q}
        onQ={setQ}
        onOpen={setSelected}
        onApply={(o) => (tracked[o.id] && tracked[o.id] !== "saved" ? window.open(o.applyUrl, "_blank", "noopener,noreferrer") : setApplyFor(o))}
        onSave={(o) => add(o, "saved")}
      />

      <TelegramFab className="max-md:hidden" />

      {toast && (
        <div
          role="status"
          className="animate-toast-in leading-[normal] fixed bottom-8 left-1/2 z-30 flex h-[52px] -translate-x-1/2 items-center gap-3.5 whitespace-nowrap rounded-[14px] bg-[#F5F8FC] pl-[18px] pr-2 text-sm text-[#0E131A]"
          style={{ boxShadow: "0 12px 40px -10px rgba(0,0,0,.5)" }}
        >
          <span className="size-2 rounded-full bg-[#1B6E4D]" />
          {toast}
          <Link href="/tracker" className="flex h-[38px] items-center rounded-[10px] bg-[#0E131A] px-3.5 font-medium !text-white">
            View in tracker
          </Link>
        </div>
      )}

      {selected && (
        <>
          <div onClick={() => setSelected(null)} className="animate-scrim-in fixed inset-0 z-10 backdrop-blur-[2px]" style={{ background: "var(--scrim)" }} />
          <aside
            data-theme="light"
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            className="animate-drawer-in leading-[normal] fixed bottom-3 right-3 top-3 z-[11] flex w-[500px] max-w-[calc(100%-24px)] flex-col overflow-auto rounded-[20px] bg-white text-[#0E131A]"
            style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,.55)" }}
          >
            <div
              className="flex flex-col gap-4 border-b border-[#E3E8EE] px-6 pb-5 pt-[22px]"
              style={{ background: "linear-gradient(180deg,#EAF4FF 0%,#FFFFFF 100%)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TypePill o={selected} drawer />
                  <span className="flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold text-[#1B6E4D]" style={{ background: "rgba(147,224,192,.4)" }}>
                    {selected.match}% match
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="grid size-10 cursor-pointer place-items-center rounded-[10px] border border-[#E3E8EE] bg-white text-[#465061]"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }}>
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3.5">
                <LogoTile o={selected} size={52} drawer />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="m-0 text-[28px] font-normal leading-[1.08] tracking-[-.02em] [text-wrap:balance]" style={{ fontFamily: SERIF }}>
                    {selected.title}
                  </h2>
                  <span className="text-sm text-[#465061]">
                    {selected.company} · {selected.loc}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 rounded-xl border border-[#E3E8EE] bg-white">
                <Fact label="Found" value={selected.found} />
                <Fact label="Deadline" value={selected.deadline} colour="#8E5413" />
                <Fact label="Source" value={selected.source} small />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <button
                  type="button"
                  onClick={openAndApply}
                  className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0E131A] text-[15px] font-semibold text-white"
                >
                  {applied ? "Applied · open employer page" : "Open and apply"}
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }}>
                    <path d="M4 10 10 4M5 4h5v5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => add(selected, "saved")}
                  className="h-12 cursor-pointer whitespace-nowrap rounded-xl border border-[#CFD6DF] bg-white px-4 text-sm font-medium text-[#0E131A]"
                >
                  {tracked[selected.id] === "saved" ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-[22px] px-6 py-[22px]">
              <div className="flex flex-col gap-2.5">
                <span className={EYEBROW}>Why it matches you</span>
                {selected.why.map((w) => (
                  <div key={w} className="flex gap-2.5 text-sm leading-normal text-[#1F2733]">
                    <span className="mt-px grid size-[18px] flex-none place-items-center rounded-full" style={{ background: "rgba(147,224,192,.45)" }}>
                      <svg width="9" height="9" viewBox="0 0 10 10" style={{ fill: "none", stroke: "#1B6E4D", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                        <path d="m2 5 2 2 4-4" />
                      </svg>
                    </span>
                    {w}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5">
                <span className={EYEBROW}>How to apply</span>
                <div className="flex flex-col rounded-xl border border-[#E3E8EE]">
                  <Step n="01">
                    Check your CV against this role in{" "}
                    <Link href={`/cv-studio?job=${selected.id}`} className="font-medium !text-[#1D5C9C]">
                      CV studio
                    </Link>
                  </Step>
                  <Step n="02" border>
                    Apply on the employer&apos;s page at{" "}
                    <a href={selected.applyUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] !text-[#0E131A] underline decoration-[#CFD6DF] underline-offset-2" style={{ fontFamily: MONO }}>
                      {selected.source}
                    </a>
                  </Step>
                  <Step n="03" border>
                    Mark it applied. We add it to your tracker and remind you to follow up in 14 days.
                  </Step>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1 rounded-xl border border-[#E3E8EE] px-3.5 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-[#626C7C]">Published contact</span>
                  <span className="break-words text-sm font-medium">{selected.contact}</span>
                  <span className="text-[12px] text-[#626C7C]">{selected.contactNote}</span>
                </div>
                <a
                  href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(selected.company)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 rounded-xl border border-[#E3E8EE] px-3.5 py-3 !text-[#0E131A] hover:border-[#CFD6DF]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-[#626C7C]">LinkedIn</span>
                  <span className="text-sm font-medium">{selected.company}</span>
                  <span className="text-[12px] text-[#1D5C9C]">Open company page</span>
                </a>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <span className={EYEBROW}>Prepare with Claude</span>
                  <span className="text-[12px] text-[#626C7C]">copies a prompt</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Tailor my CV", "Interview prep", "Company brief"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => copy(label, selected)}
                      className="h-11 cursor-pointer whitespace-nowrap rounded-[10px] border text-[13px] font-medium text-[#0E131A] transition-colors"
                      style={
                        copied === label
                          ? { borderColor: "#93E0C0", background: "rgba(147,224,192,.25)" }
                          : { borderColor: "#E3E8EE", background: "#F5F7FA" }
                      }
                    >
                      {copied === label ? "Copied" : label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {applyFor && (
        <>
          <div onClick={() => setApplyFor(null)} className="animate-scrim-in fixed inset-0 z-40" style={{ background: "rgba(6,9,14,.6)" }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Want us to check your CV first?"
            className="animate-pop-in leading-[normal] fixed left-1/2 top-1/2 z-[41] flex w-[520px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-[18px] rounded-[20px] bg-white p-7 text-[#0E131A]"
            style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,.6)" }}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#1D5C9C]">Quick one</span>
              <span className="text-[32px] leading-[1.08] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                Want us to check your CV first?
              </span>
              <span className="text-sm leading-normal text-[#465061]">
                Most companies use a computer to read CVs before a person does. We&apos;ll tell you if yours will pass, and what to change. Takes 2 minutes.
              </span>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/cv-studio?job=${applyFor.id}`)}
              className="flex cursor-pointer flex-col gap-1 rounded-[14px] border border-[#8FC7FF] bg-[#EAF4FF] px-[18px] py-4 text-left text-[#0E131A]"
            >
              <span className="text-base font-semibold">Yes, check my CV</span>
              <span className="text-[13px] text-[#465061]">Recommended. We fill in the job for you.</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.open(applyFor.applyUrl, "_blank", "noopener,noreferrer");
                setApplyFor(null);
                add(applyFor, "applied");
              }}
              className="flex cursor-pointer flex-col gap-1 rounded-[14px] border border-[#E3E8EE] bg-white px-[18px] py-4 text-left text-[#0E131A]"
            >
              <span className="text-base font-semibold">No, just take me to apply</span>
              <span className="text-[13px] text-[#465061]">We&apos;ll save it in your tracker.</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

function TypePill({ o, drawer }: { o: OpportunityView; drawer?: boolean }) {
  return (
    <span
      className={`flex items-center rounded-full text-[12px] ${drawer ? "h-6 px-2.5 font-semibold" : "h-[22px] px-[9px] font-medium"}`}
      style={{ background: `var(--b-${o.tone})`, color: `var(--t-${o.tone})` }}
    >
      {o.type}
    </span>
  );
}

/** White tile with the company's initial; the employer's own icon covers it once it loads. */
function LogoTile({ o, size, drawer }: { o: OpportunityView; size: number; drawer?: boolean }) {
  const [shown, setShown] = useState(false);
  const check = (img: HTMLImageElement | null) => {
    // Google answers unknown sites with a tiny grey globe: keep the initial for those
    if (img?.complete && img.naturalWidth > 16) setShown(true);
  };
  return (
    <span
      className={`relative grid flex-none place-items-center overflow-hidden bg-white ${drawer ? "border border-[#E3E8EE] text-[#0E131A]" : "text-[#111722]"}`}
      style={{ width: size, height: size, borderRadius: drawer ? 13 : 12, fontFamily: SERIF, fontSize: drawer ? 26 : 24 }}
    >
      {o.initial}
      {o.logo && (
        <span className={`absolute inset-0 grid place-items-center bg-white ${shown ? "" : "opacity-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={check} src={o.logo} alt="" width={30} height={30} onLoad={(e) => check(e.currentTarget)} />
        </span>
      )}
    </span>
  );
}

function MatchRing({ match }: { match: number }) {
  const colour = ringColour(match);
  return (
    <div className="relative grid size-[46px] place-items-center" aria-label={`${match}% match`}>
      <svg width="46" height="46" viewBox="0 0 46 46" className="absolute inset-0 -rotate-90">
        <circle cx="23" cy="23" r="19" style={{ fill: "none", stroke: "var(--line2)", strokeWidth: 2.5 }} />
        <circle
          cx="23"
          cy="23"
          r="19"
          pathLength={100}
          strokeDasharray={`${match} 100`}
          style={{ fill: "none", stroke: colour, strokeWidth: 2.5, strokeLinecap: "round" }}
        />
      </svg>
      <span className="text-[12px]" style={{ fontFamily: MONO, color: colour }}>
        {match}
      </span>
    </div>
  );
}

function Fact({ label, value, colour, small }: { label: string; value: string; colour?: string; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] border-[#E3E8EE] px-3 py-2.5 [&:not(:first-child)]:border-l">
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-[#626C7C]">{label}</span>
      <span className={`truncate ${small ? "text-[12px]" : "text-[13px]"}`} style={{ fontFamily: MONO, color: colour }}>
        {value}
      </span>
    </div>
  );
}

function Step({ n, border, children }: { n: string; border?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid grid-cols-[28px_1fr] gap-2.5 px-3.5 py-3 ${border ? "border-t border-[#E3E8EE]" : ""}`}>
      <span className="text-[12px] text-[#1D5C9C]" style={{ fontFamily: MONO }}>
        {n}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

/** The phone layout from the mobile design: For you with New / Closing soon / Saved. */
function PhoneFeed(
  props: Omit<Props, "tracked"> & {
    tracked: Record<string, string | undefined>;
    onQ: (q: string) => void;
    onOpen: (o: OpportunityView) => void;
    onApply: (o: OpportunityView) => void;
    onSave: (o: OpportunityView) => void;
  },
) {
  const [tab, setTab] = useState<"New" | "Closing soon" | "Saved">("New");
  const [searching, setSearching] = useState(props.find || !!props.q);

  // The header's search button, pressed while already on this page
  useEffect(() => {
    const open = () => setSearching(true);
    window.addEventListener("nimbus:search", open);
    return () => window.removeEventListener("nimbus:search", open);
  }, []);
  const list = tab === "New" ? props.opportunities : tab === "Closing soon" ? props.phone.closingSoon : props.phone.saved;
  const [top, ...rest] = list;
  const matchWord = (m: number) => (m >= 85 ? "Strong match" : m >= 75 ? "Good match" : "Match");
  const saved = (o: OpportunityView) => !!props.tracked[o.id];

  return (
    <div className="relative flex flex-col leading-[normal] md:hidden">
      <div className="flex flex-col gap-2 px-5 pt-[26px]">
        <span className="text-[12px] font-semibold uppercase tracking-[.1em] text-tx2">
          {props.phone.weekday} · {props.phone.today} new today
        </span>
        <h1 className="m-0 text-[46px] font-normal leading-none tracking-[-.035em]" style={{ fontFamily: SERIF }}>
          For <span className="text-t-sky">you.</span>
        </h1>
      </div>

      {searching && (
        <label
          className="mx-5 mt-4 flex h-[46px] items-center gap-2.5 rounded-xl border px-3.5 text-tx3"
          style={{ borderColor: "rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
          <input
            autoFocus
            value={props.q}
            onChange={(e) => props.onQ(e.target.value)}
            placeholder="Search roles, companies, places"
            aria-label="Search roles, companies, places"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-tx outline-none"
          />
          <button
            type="button"
            onClick={() => {
              props.onQ("");
              setSearching(false);
            }}
            aria-label="Close search"
            className="text-tx3"
          >
            ✕
          </button>
        </label>
      )}

      <div
        className="mx-5 mb-3.5 mt-[18px] grid grid-cols-3 gap-0.5 rounded-xl border p-[3px]"
        style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.08)" }}
      >
        {(["New", "Closing soon", "Saved"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className="h-[38px] cursor-pointer whitespace-nowrap rounded-[9px] text-[13px] font-medium"
            style={{ background: tab === t ? "#F4F6F8" : "transparent", color: tab === t ? "#08090B" : "var(--tx2)" }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-4">
        {top && (
          <div className="animate-fade-up flex flex-col gap-3 rounded-[18px] bg-[#F4F6F8] p-[18px] text-[#08090B]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="relative grid size-[22px] place-items-center overflow-hidden rounded-md border border-[#E3E8EE] bg-white text-[12px]"
                  style={{ fontFamily: SERIF }}
                >
                  {top.initial}
                  {top.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={top.logo} alt="" width={16} height={16} className="absolute inset-0 m-auto bg-white" onError={(e) => (e.currentTarget.style.display = "none")} />
                  )}
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#1D5C9C]">
                  {matchWord(top.match)} · {top.match}
                </span>
              </span>
              <span className="text-[11px] text-[#5A616C]" style={{ fontFamily: MONO }}>
                {top.found}
              </span>
            </div>
            <button type="button" onClick={() => props.onOpen(top)} className="flex cursor-pointer flex-col gap-1 text-left text-[#08090B]">
              <span className="text-[26px] leading-[1.08] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                {top.title}
              </span>
              <span className="text-sm text-[#3E4550]">
                {top.company} · {top.loc}
              </span>
            </button>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="flex h-6 items-center rounded-full bg-[#E6E9EE] px-[9px] font-medium">{top.type}</span>
              {top.closing && (
                <span className="text-[#8E5413]" style={{ fontFamily: MONO }}>
                  {top.closing}
                </span>
              )}
            </div>
            <div className="grid grid-cols-[1fr_48px] gap-2">
              <button
                type="button"
                onClick={() => props.onApply(top)}
                className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-[#8FC7FF] text-[15px] font-medium text-[#06111D]"
              >
                {props.tracked[top.id] && props.tracked[top.id] !== "saved" ? "Applied · open page" : "Open and apply"}
              </button>
              <button
                type="button"
                onClick={() => props.onSave(top)}
                aria-label={saved(top) ? "Saved" : "Save"}
                className="grid h-12 cursor-pointer place-items-center rounded-xl border border-[#D5DAE1] bg-transparent text-[#08090B]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ fill: saved(top) ? "#08090B" : "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" }}>
                  <path d="M4 2.5h8v11L8 10.5l-4 3z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {rest.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => props.onOpen(o)}
            className="animate-fade-up grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3 rounded-2xl border p-3.5 text-left text-tx"
            style={{ background: "rgba(255,255,255,.04)", borderColor: "rgba(255,255,255,.08)", animationDelay: `${Math.min(i, 8) * 40 + 60}ms` }}
          >
            <span
              className="relative grid size-10 place-items-center overflow-hidden rounded-[10px] border border-line2 bg-white text-[19px] text-[#0E131A]"
              style={{ fontFamily: SERIF }}
            >
              {o.initial}
              {o.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.logo} alt="" width={26} height={26} className="absolute inset-0 m-auto bg-white" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[15px] font-medium leading-[1.3]">{o.title}</span>
              <span className="text-[13px] text-tx2">
                {o.company} · {o.loc}
              </span>
              <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ fontFamily: MONO }}>
                <span
                  className="flex h-5 items-center rounded-full px-2 font-sans text-[11px] font-medium"
                  style={{ background: `var(--b-${o.tone})`, color: `var(--t-${o.tone})` }}
                >
                  {o.type}
                </span>
                {o.closing && <span className="text-t-dawn">{o.closing}</span>}
              </div>
            </div>
            <PhoneRing match={o.match} />
          </button>
        ))}

        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line2 px-5 py-10 text-center text-tx3">
            {tab === "Saved"
              ? "Nothing saved yet. Tap the bookmark on a role."
              : tab === "Closing soon"
                ? "Nothing of yours closes in the next three weeks."
                : "Nothing matches yet."}
          </div>
        )}
        {tab === "New" && props.hasMore && (
          <a href={`/?n=${props.limit + 40}`} className="mx-auto mt-2 flex h-[38px] items-center rounded-full border border-line px-4 text-[13px] font-medium !text-tx2">
            Show more
          </a>
        )}
      </div>
    </div>
  );
}

function PhoneRing({ match }: { match: number }) {
  const colour = ringColour(match);
  return (
    <div className="relative grid size-10 place-items-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="16" style={{ fill: "none", stroke: "var(--line2)", strokeWidth: 2.5 }} />
        <circle
          cx="20"
          cy="20"
          r="16"
          pathLength={100}
          strokeDasharray={`${match} 100`}
          style={{ fill: "none", stroke: colour, strokeWidth: 2.5, strokeLinecap: "round" }}
        />
      </svg>
      <span className="text-[11px]" style={{ fontFamily: MONO, color: colour }}>
        {match}
      </span>
    </div>
  );
}
