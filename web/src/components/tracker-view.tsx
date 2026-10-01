"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addApplication, deleteApplication, setStage, updateApplication } from "@/app/(app)/tracker/actions";
import { STAGE_GROUPS, STAGE_OPTIONS, groupOf, stageLabel } from "@/lib/tracker";

export type TrackerRow = {
  id: string;
  stage: string;
  group: string;
  role: string;
  company: string;
  initial: string;
  type: string;
  applied: string;
  next: string;
  due: string;
  dueAt: number;
  urgent: boolean;
  fresh: boolean;
  ghosted: boolean;
  nextStep: string | null;
  dueOn: string | null;
  notes: string | null;
  url: string | null;
  /** Added by hand (not from Opportunities): role and company can be edited */
  manual: boolean;
};

const SERIF = "var(--font-newsreader), Georgia, serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const ICONS = { table: "M2 3.5h12v9H2zM2 7h12M6 3.5v9", board: "M2.5 3h3v10h-3zM6.5 3h3v7h-3zM10.5 3h3v4.5h-3z" };

const tag = (tone: string) => ({ background: `var(--b-${tone})`, color: `var(--t-${tone})` });

export function TrackerView({ rows: serverRows }: { rows: TrackerRow[] }) {
  const [view, setView] = useState<"table" | "board">("table");
  const [closed, setClosed] = useState<Record<string, boolean>>({ Closed: true });
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<TrackerRow | null>(null);

  // Stage changes show at once; the server's copy replaces them when the page refreshes
  const rows = serverRows.map((r) => (moved[r.id] && moved[r.id] !== r.stage ? { ...r, stage: moved[r.id], group: groupOf(moved[r.id]).name } : r));

  // Pick any stage, like a Notion select
  const move = async (r: TrackerRow, to: string) => {
    if (to === r.stage) return;
    setMoved((m) => ({ ...m, [r.id]: to }));
    const result = await setStage(r.id, to);
    if (!result.ok) setMoved((m) => ({ ...m, [r.id]: r.stage }));
  };

  const groups = STAGE_GROUPS.map((g) => ({
    ...g,
    rows: rows.filter((r) => r.group === g.name).sort((a, b) => a.dueAt - b.dueAt),
    open: !closed[g.name],
  }));
  const applied = rows.filter((r) => r.group !== "Saved").length;
  const replies = rows.filter((r) => ["Online test", "Interview", "Offer"].includes(r.group) || r.stage === "rejected").length;
  const ghosted = rows.filter((r) => r.ghosted).length;

  return (
    <main className="mx-auto flex max-w-[1264px] flex-col gap-7 px-5 pb-24 pt-14 leading-[normal] sm:px-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-semibold uppercase tracking-[.1em] text-tx2">Application tracker</span>
          <h1 className="m-0 text-[40px] font-normal leading-none tracking-[-.035em] sm:text-[52px]" style={{ fontFamily: SERIF }}>
            Every application, <span className="text-t-sky">in one place.</span>
          </h1>
        </div>
        <div className="flex gap-7">
          {[
            { n: applied, label: "applied", c: "var(--tx)" },
            { n: replies, label: "replies", c: "var(--t-mint)" },
            { n: ghosted, label: "ghosted", c: "var(--tx3)" },
          ].map((st) => (
            <div key={st.label} className="flex flex-col gap-0.5">
              <span className="text-[36px] leading-none tracking-[-.03em]" style={{ fontFamily: SERIF, color: st.c }}>
                {st.n}
              </span>
              <span className="text-[12px] text-tx3">{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 border-b border-line" style={{ animationDelay: "80ms" }}>
        <div className="flex gap-1">
          {(["table", "board"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`-mb-px flex h-11 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-medium ${
                view === id ? "border-tx text-tx" : "border-transparent text-tx2 hover:text-tx"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
                <path d={ICONS[id]} />
              </svg>
              {id === "table" ? "Table" : "Board"}
            </button>
          ))}
          <Link href="/calendar" className="flex h-11 items-center gap-2 px-3 text-sm font-medium !text-tx2 hover:!text-tx">
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }}>
              <path d="M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2v3M10.5 2v3" />
            </svg>
            Calendar
          </Link>
        </div>
        <div className="flex gap-2 pb-1.5">
          <span className="hidden h-8 items-center rounded-lg border border-line px-3 text-[13px] text-tx2 sm:flex">Group: Stage</span>
          <span className="hidden h-8 items-center rounded-lg border border-line px-3 text-[13px] text-tx2 sm:flex">Sort: Next date</span>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="h-8 cursor-pointer rounded-lg bg-sky px-3 text-[13px] font-medium text-on-sky hover:brightness-105"
          >
            New
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="m-0 -mt-3 text-sm text-tx3">
          Save or apply to a role in <Link href="/">Opportunities</Link> and it lands here, or add one with New.
        </p>
      )}

      {view === "table" ? (
        <div className="animate-fade-up -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0" style={{ animationDelay: "140ms" }}>
          <div className="flex min-w-[900px] flex-col gap-[22px]">
            {groups.map((g) => (
              <div key={g.name} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setClosed((c) => ({ ...c, [g.name]: !c[g.name] }))}
                  aria-expanded={g.open}
                  className="flex h-10 cursor-pointer items-center gap-2.5 px-1 text-tx"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" className="transition-transform duration-150" style={{ fill: "var(--tx3)", transform: `rotate(${g.open ? 90 : 0}deg)` }}>
                    <path d="M3 1.5 7.5 5 3 8.5z" />
                  </svg>
                  <span className="flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium" style={tag(g.tone)}>
                    <span className="size-1.5 rounded-full" style={{ background: `var(--t-${g.tone})` }} />
                    {g.name}
                  </span>
                  <span className="text-[12px] text-tx3" style={{ fontFamily: MONO }}>
                    {g.rows.length}
                  </span>
                </button>
                {g.open && (
                  <div className="border-t border-line">
                    {g.rows.map((r) => (
                      <div
                        key={r.id}
                        className="grid min-h-12 grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_128px_108px_84px_minmax(0,1.4fr)_104px] items-center border-b border-line text-sm hover:bg-s1"
                        style={r.fresh ? { background: "rgba(143,199,255,.06)" } : undefined}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setEditing(r)}
                          onKeyDown={(e) => e.key === "Enter" && setEditing(r)}
                          title="Edit"
                          className="flex min-w-0 cursor-pointer items-center gap-2.5 pl-1 pr-3"
                        >
                          <span className="grid size-6 flex-none place-items-center rounded-md border border-line bg-s2 text-[13px]" style={{ fontFamily: SERIF }}>
                            {r.initial}
                          </span>
                          <span className="truncate font-medium">{r.role}</span>
                          {r.fresh && <span className="flex-none rounded-full border border-l-sky px-[7px] py-px text-[11px] text-t-sky">New</span>}
                        </div>
                        <span className="truncate border-l border-line px-3 leading-[48px] text-tx2">{r.company}</span>
                        <div className="flex h-12 items-center border-l border-line px-3">
                          <StagePicker stage={r.stage} onPick={(to) => move(r, to)} />
                        </div>
                        <span className="whitespace-nowrap border-l border-line px-3 text-[13px] leading-[48px] text-tx2">{r.type}</span>
                        <span className="border-l border-line px-3 text-[12px] leading-[48px] text-tx3" style={{ fontFamily: MONO }}>
                          {r.applied}
                        </span>
                        <span className="truncate border-l border-line px-3 text-[13px] leading-[48px] text-tx">{r.next}</span>
                        <span
                          className="border-l border-line px-3 text-[12px] leading-[48px]"
                          style={{ fontFamily: MONO, color: r.urgent ? "var(--t-dawn)" : "var(--tx3)" }}
                        >
                          {r.due}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-fade-up -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <div className="grid min-w-[900px] grid-cols-6 items-start gap-2.5">
            {groups.map((g) => (
              <div key={g.name} className="flex flex-col gap-1.5">
                <div className="flex h-9 items-center gap-2">
                  <span className="flex h-6 items-center whitespace-nowrap rounded-md px-[9px] text-[12px] font-medium" style={tag(g.tone)}>
                    {g.name}
                  </span>
                  <span className="text-[12px] text-tx3" style={{ fontFamily: MONO }}>
                    {g.rows.length}
                  </span>
                </div>
                {g.rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setEditing(r)}
                    title="Edit"
                    className="flex cursor-pointer flex-col gap-1.5 rounded-[10px] border border-line bg-s1 p-3 text-left text-tx hover:bg-s2"
                  >
                    <span className="text-sm font-medium leading-[1.3]">{r.role}</span>
                    <span className="text-[13px] text-tx2">{r.company}</span>
                    <span className="mt-0.5 text-[11px]" style={{ fontFamily: MONO, color: r.urgent ? "var(--t-dawn)" : "var(--tx3)" }}>
                      {r.next}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && <AddModal onClose={() => setModal(false)} />}
      {editing && <EditModal row={editing} onClose={() => setEditing(null)} />}
    </main>
  );
}

function AddModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ role: "", company: "", group: "Applied", next: "", due: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () =>
    startTransition(async () => {
      const result = await addApplication(form);
      if (result.ok) onClose();
      else setError(result.error ?? "Couldn't save it.");
    });

  const input = "h-11 rounded-[10px] border border-line2 bg-bg px-3 text-sm text-tx outline-none focus:border-l-sky";
  const field = (key: "role" | "company" | "next" | "due", label: string, placeholder: string, mono = false) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-tx2">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className={input}
        style={mono ? { fontFamily: MONO } : undefined}
      />
    </label>
  );

  return (
    <>
      <div onClick={onClose} className="animate-scrim-in fixed inset-0 z-20" style={{ background: "rgba(4,6,9,.6)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add an application"
        className="animate-pop-in fixed left-1/2 top-1/2 z-[21] flex w-[480px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[18px] border border-line2 bg-s1 p-6"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,.6)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[28px] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
            Add an application
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="size-9 cursor-pointer rounded-[9px] border border-line2 text-tx2">
            ✕
          </button>
        </div>
        {field("role", "Role", "e.g. Summer Engineering Intern")}
        {field("company", "Company", "e.g. Dyson")}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-tx2">Stage</span>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_GROUPS.map((g) => (
              <button
                key={g.name}
                type="button"
                onClick={() => setForm((f) => ({ ...f, group: g.name }))}
                aria-pressed={form.group === g.name}
                className="h-8 cursor-pointer rounded-lg border px-2.5 text-[12px] font-medium"
                style={{
                  ...tag(g.tone),
                  borderColor: form.group === g.name ? `var(--t-${g.tone})` : "var(--line2)",
                  opacity: form.group === g.name ? 1 : 0.6,
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-2.5">
          {field("next", "Next step", "e.g. Follow up Fri")}
          {field("due", "Due", "12 Oct", true)}
        </div>
        {error && <span className="-mt-1 text-[13px] text-t-rose">{error}</span>}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-12 cursor-pointer rounded-xl bg-[#8FC7FF] text-[15px] font-semibold text-[#06111D] disabled:opacity-70"
        >
          {pending ? "Adding…" : "Add to tracker"}
        </button>
      </div>
    </>
  );
}

/** The stage tag: click it to choose any stage from a list (Notion-style). */
function StagePicker({ stage, onPick }: { stage: string; onPick: (stage: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change stage"
        className="flex h-6 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-[9px] text-[12px] font-medium"
        style={tag(groupOf(stage).tone)}
      >
        {stageLabel(stage)}
        <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }}>
          <path d="m2 3.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="animate-pop-in absolute left-0 top-8 z-30 flex w-[210px] flex-col rounded-xl border border-line2 bg-s1 p-1.5"
          style={{ boxShadow: "0 20px 50px -15px rgba(0,0,0,.7)" }}
        >
          {STAGE_OPTIONS.map((o, i) => {
            const group = groupOf(o.stage);
            const newGroup = i === 0 || groupOf(STAGE_OPTIONS[i - 1].stage).name !== group.name;
            return (
              <div key={o.stage}>
                {newGroup && i > 0 && <div className="mx-1 my-1 h-px bg-line" />}
                <button
                  type="button"
                  role="option"
                  aria-selected={o.stage === stage}
                  onClick={() => {
                    onPick(o.stage);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-s2"
                >
                  <span className="flex h-6 items-center rounded-md px-2 text-[12px] font-medium" style={tag(group.tone)}>
                    {o.label}
                  </span>
                  {o.stage === stage && <span className="text-[12px] text-t-sky">✓</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Click a row: change its stage, next step, due date and notes, or delete it. */
function EditModal({ row, onClose }: { row: TrackerRow; onClose: () => void }) {
  const [form, setForm] = useState({
    stage: row.stage,
    role: row.role,
    company: row.company,
    nextStep: row.nextStep ?? "",
    dueOn: row.dueOn ?? "",
    notes: row.notes ?? "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () =>
    startTransition(async () => {
      const result = await updateApplication(row.id, {
        stage: form.stage !== row.stage ? form.stage : undefined,
        nextStep: form.nextStep,
        dueOn: form.dueOn,
        notes: form.notes,
        ...(row.manual ? { role: form.role, company: form.company } : {}),
      });
      if (result.ok) onClose();
      else setError("Couldn't save. Try again.");
    });
  const remove = () =>
    startTransition(async () => {
      if (!window.confirm("Remove this from your tracker?")) return;
      const result = await deleteApplication(row.id);
      if (result.ok) onClose();
      else setError("Couldn't remove it. Try again.");
    });

  const input = "h-11 min-w-0 rounded-[10px] border border-line2 bg-bg px-3 text-sm text-tx outline-none focus:border-l-sky";
  return (
    <>
      <div onClick={onClose} className="animate-scrim-in fixed inset-0 z-20" style={{ background: "rgba(4,6,9,.6)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={row.role}
        className="animate-pop-in fixed left-1/2 top-1/2 z-[21] flex max-h-[calc(100vh-32px)] w-[520px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-auto rounded-[18px] border border-line2 bg-s1 p-6"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,.6)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[26px] leading-[1.1] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
              {row.role}
            </span>
            <span className="text-sm text-tx2">{row.company}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="size-9 flex-none cursor-pointer rounded-[9px] border border-line2 text-tx2">
            ✕
          </button>
        </div>
        {row.manual && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-tx2">Role</span>
              <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={input} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-tx2">Company</span>
              <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={input} />
            </label>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-tx2">Stage</span>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_OPTIONS.map((o) => {
              const on = form.stage === o.stage;
              const tone = groupOf(o.stage).tone;
              return (
                <button
                  key={o.stage}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, stage: o.stage }))}
                  aria-pressed={on}
                  className="h-8 cursor-pointer rounded-lg border px-2.5 text-[12px] font-medium"
                  style={{ ...tag(tone), borderColor: on ? `var(--t-${tone})` : "var(--line2)", opacity: on ? 1 : 0.6 }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-[1fr_170px]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-tx2">Next step</span>
            <input value={form.nextStep} onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))} placeholder="e.g. Numerical test, 60 min" className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-tx2">Due</span>
            <input type="date" value={form.dueOn} onChange={(e) => setForm((f) => ({ ...f, dueOn: e.target.value }))} className={input} style={{ fontFamily: MONO, colorScheme: "dark" }} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-tx2">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Who you spoke to, interview questions, anything to remember"
            className="min-h-[84px] resize-y rounded-[10px] border border-line2 bg-bg p-3 text-sm leading-normal text-tx outline-none focus:border-l-sky"
          />
        </label>
        <span className="-mt-1 text-[12px] text-tx3">
          Tip: an Online test or Interview with a due date shows on your Calendar, and you can get a Telegram reminder the day before.
        </span>
        {error && <span className="text-[13px] text-t-rose">{error}</span>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={remove} disabled={pending} className="h-11 cursor-pointer rounded-xl border px-4 text-sm font-medium text-[#F6B4C1]" style={{ borderColor: "rgba(244,169,184,.5)" }}>
            Remove
          </button>
          {row.url && (
            <a href={row.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center rounded-xl border border-line2 px-4 text-sm font-medium !text-tx2 hover:!text-tx">
              Open the advert
            </a>
          )}
          <button type="button" onClick={save} disabled={pending} className="ml-auto h-11 cursor-pointer rounded-xl bg-[#8FC7FF] px-6 text-[15px] font-semibold text-[#06111D] disabled:opacity-70">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
