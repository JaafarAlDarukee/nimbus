"use client";

import { useRef, useState, useTransition } from "react";
import { createJob, ideas as getIdeas, readFile, readSignupCv, saveDetails, saveJob } from "@/app/(app)/cv-studio/actions";
import { analyse, blankCv, cvHtml, scoreColour, type BuiltCv, type CvJob, type Experience } from "@/lib/cv";

type Props = { jobs: CvJob[]; selectedId: string | null; saved: BuiltCv; hasSaved: boolean; signupCv: string | null };

const SERIF = "var(--font-newsreader), Georgia, serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const STEPS = ["Job", "Job description", "Your CV", "ATS check"];
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[.08em] text-tx3";
const INPUT = "h-11 min-w-0 rounded-[10px] border border-line2 bg-bg px-3 text-sm text-tx outline-none focus:border-l-sky";
const CARD = "flex flex-col rounded-2xl border border-line bg-s1 p-5";

export function CvStudio(props: Props) {
  const [jobs, setJobs] = useState(props.jobs);
  const [selId, setSelId] = useState(props.selectedId ?? props.jobs[props.jobs.length - 1]?.id ?? null);
  const [saved, setSaved] = useState(props.saved);
  const [hasSaved, setHasSaved] = useState(props.hasSaved);
  const [saveMine, setSaveMine] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [creating, startCreating] = useTransition();
  const pending = useRef<Record<string, Partial<CvJob>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const job = jobs.find((j) => j.id === selId) ?? null;

  // Every change is shown at once and saved shortly after
  const update = (patch: Partial<CvJob>) => {
    if (!job) return;
    const id = job.id;
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    pending.current[id] = { ...pending.current[id], ...patch };
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      const changes = pending.current[id];
      delete pending.current[id];
      if (changes) saveJob(id, changes);
    }, 600);
  };
  const setCv = (patch: Partial<BuiltCv>) => job && update({ cv: { ...(job.cv ?? blankCv()), ...patch } });
  const setExp = (i: number, patch: Partial<Experience>) => {
    if (!job?.cv) return;
    const exp = job.cv.exp.slice();
    exp[i] = { ...exp[i], ...patch };
    setCv({ exp });
  };

  const select = (id: string) => {
    setSelId(id);
    setFileError(null);
    setFlash(null);
    window.history.replaceState(null, "", `/cv-studio?id=${id}`);
  };

  const newJob = () =>
    startCreating(async () => {
      const id = await createJob();
      if (!id) return;
      setJobs((list) => [...list, { id, title: "", company: "", link: "", jd: "", jdName: null, mode: null, cvName: null, cvText: null, cv: null, step: 1 }]);
      select(id);
    });

  const upload = (file: File | undefined, apply: (name: string, text: string) => void) => {
    if (!file) return;
    setFileError(null);
    const form = new FormData();
    form.set("file", file);
    startReading(async () => {
      const result = await readFile(form);
      if ("error" in result) setFileError(result.error);
      else apply(result.name, result.text);
    });
  };

  if (!job) {
    return (
      <div className="grid min-h-[calc(100vh-65px)] place-items-center px-6 leading-[normal]">
        <div className="animate-fade-up flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="m-0 text-[46px] font-normal leading-none tracking-[-.03em]" style={{ fontFamily: SERIF }}>
            One CV <span className="italic text-t-sky">per job.</span>
          </h1>
          <p className="m-0 text-[15px] leading-normal text-tx2">
            Add a job, paste its advert, and check your CV against it before you apply. Or press &ldquo;Yes, check my CV&rdquo; on any role in Opportunities.
          </p>
          <button type="button" onClick={newJob} disabled={creating} className="h-12 cursor-pointer rounded-xl bg-[#8FC7FF] px-6 text-[15px] font-semibold text-[#06111D]">
            {creating ? "Starting…" : "New job"}
          </button>
        </div>
      </div>
    );
  }

  const A = analyse(job);
  const step = job.step;
  const can = [true, !!(job.title.trim() && job.company.trim()), !!job.jd.trim(), !!job.mode];
  const cv = job.cv ?? blankCv();

  const next = async () => {
    if (!can[step]) return;
    if (step === 3 && job.mode === "build" && saveMine && job.cv) {
      setSaved(job.cv);
      setHasSaved(true);
      saveDetails(job.cv);
    }
    update({ step: step + 1 });
  };

  return (
    <div className="grid items-start leading-[normal] md:min-h-[calc(100vh-65px)] md:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="flex gap-2.5 overflow-x-auto border-b border-line px-4 py-4 md:min-h-[calc(100vh-65px)] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-7">
        <span className={`${EYEBROW} hidden px-2 md:block`}>One CV per job</span>
        {jobs.map((j) => {
          const s = j.mode ? analyse(j).score : 0;
          const on = j.id === job.id;
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => select(j.id)}
              className="flex min-w-[200px] cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left text-tx md:min-w-0"
              style={{ borderColor: on ? "var(--l-sky)" : "var(--line)", background: on ? "var(--b-sky)" : "transparent" }}
            >
              <span className="text-sm font-medium leading-[1.3]">{j.title || "Untitled job"}</span>
              <span className="text-[12px] text-tx3">{j.company || "Add company"}</span>
              <span className="text-[11px]" style={{ fontFamily: MONO, color: s ? scoreColour(s) : "#8C97A8" }}>
                {s ? `ATS ${s}` : `Step ${j.step} of 4`}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={newJob}
          disabled={creating}
          className="h-11 min-w-[120px] cursor-pointer rounded-xl border border-dashed border-line2 bg-transparent text-sm font-medium text-t-sky"
        >
          {creating ? "Starting…" : "New job"}
        </button>
      </aside>

      <main className="flex min-w-0 flex-col gap-6 px-4 pb-20 pt-9 sm:px-10">
        <div className="flex flex-col gap-3.5">
          <h1 className="m-0 text-[36px] font-normal leading-none tracking-[-.03em] sm:text-[46px]" style={{ fontFamily: SERIF }}>
            {job.title ? `${job.title}${job.company ? ` · ${job.company}` : ""}` : "New job"}
          </h1>
          <div className="flex gap-1.5">
            {STEPS.map((label, i) => {
              const n = i + 1;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => n < step && update({ step: n })}
                  className="flex flex-1 flex-col gap-2 text-left text-tx"
                  style={{ cursor: n < step ? "pointer" : "default" }}
                >
                  <span className="h-1 rounded-full" style={{ background: n < step ? "#8FC7FF" : n === step ? "#F5F8FC" : "var(--line2)" }} />
                  <span className="text-[13px]" style={{ color: n === step ? "var(--tx)" : "var(--tx3)" }}>
                    <span style={{ fontFamily: MONO }}>0{n}</span> <span className="hidden sm:inline">{label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {step === 1 && (
          <div className="animate-fade-up flex max-w-[640px] flex-col gap-3.5">
            <Field label="Job title" value={job.title} onChange={(v) => update({ title: v })} placeholder="e.g. Operational Excellence Intern" big />
            <Field label="Company" value={job.company} onChange={(v) => update({ company: v })} placeholder="e.g. Müller UK & Ireland" big />
            <Field label="Link to the job" value={job.link} onChange={(v) => update({ link: v })} placeholder="https://careers.company.com/role" mono />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-up flex max-w-[760px] flex-col gap-3">
            <label
              className="flex h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center"
              style={{ borderColor: job.jdName ? "var(--l-sky)" : "var(--line2)", background: job.jdName ? "var(--b-sky)" : "var(--s1)" }}
            >
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0], (name, text) => update({ jdName: name, jd: text }))}
              />
              <span className="text-base font-medium">{reading ? "Reading…" : (job.jdName ?? "Upload the job description")}</span>
              <span className="text-[13px] text-tx3">{job.jdName ? `Read · ${A.req.length} skills found · click to replace` : "PDF, Word or text file"}</span>
            </label>
            {fileError && <span className="text-[13px] text-t-rose">{fileError}</span>}
            <span className="text-[13px] text-tx3">Or paste it below. Include the requirements and skills sections.</span>
            <textarea
              value={job.jd}
              onChange={(e) => update({ jd: e.target.value })}
              placeholder="Paste the job description"
              className="min-h-[140px] resize-y rounded-xl border border-line2 bg-s1 p-3 text-sm leading-normal text-tx outline-none focus:border-l-sky"
            />
            {A.req.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className={EYEBROW}>What this job asks for</span>
                <div className="flex flex-wrap gap-1.5">
                  {A.req.map((k) => (
                    <span key={k} className="flex h-[26px] items-center rounded-[7px] bg-b-sky px-[9px] text-[12px] text-t-sky">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && !job.mode && (
          <div className="animate-fade-up flex max-w-[760px] flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-line2 bg-s1 p-[22px]">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => upload(e.target.files?.[0], (name, text) => update({ mode: "upload", cvName: name, cvText: text }))}
                />
                <span className="text-[26px] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                  Upload a CV
                </span>
                <span className="text-sm leading-normal text-tx2">PDF or Word. We read it and check it against this job.</span>
                <span className="mt-1.5 flex h-11 items-center justify-center rounded-[10px] border border-line2 font-medium">{reading ? "Reading…" : "Choose file"}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  update({ mode: "build", cv: { ...blankCv(), ...saved, skills: [...saved.skills], exp: saved.exp.map((x) => ({ ...x })) } });
                  setFlash(hasSaved ? "Filled from your saved details" : null);
                }}
                className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-l-sky bg-b-sky p-[22px] text-left text-tx"
              >
                <span className="text-[26px] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                  Create one for this job
                </span>
                <span className="text-sm leading-normal text-tx2">Built around this advert. Your saved details fill in automatically.</span>
                <span className="mt-1.5 flex h-11 items-center justify-center rounded-[10px] bg-[#8FC7FF] font-semibold text-[#06111D]">Start building</span>
              </button>
            </div>
            {props.signupCv && (
              <button
                type="button"
                onClick={() =>
                  startReading(async () => {
                    const result = await readSignupCv();
                    if ("error" in result) setFileError(result.error);
                    else update({ mode: "upload", cvName: result.name, cvText: result.text });
                  })
                }
                className="cursor-pointer self-start text-[13px] text-t-sky hover:text-tx"
              >
                {reading ? "Reading…" : `Or use ${props.signupCv} from when you signed up`}
              </button>
            )}
            {fileError && <span className="text-[13px] text-t-rose">{fileError}</span>}
          </div>
        )}

        {step === 3 && job.mode === "upload" && (
          <div className="animate-fade-up flex max-w-[760px] items-center gap-3.5 rounded-[14px] border border-line bg-s1 px-[18px] py-4">
            <span className="grid h-12 w-10 place-items-center rounded-md border border-line2 text-[10px] text-tx3" style={{ fontFamily: MONO }}>
              CV
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate font-medium">{job.cvName}</span>
              <span className="text-[13px] text-t-mint">Read · {A.lines.filter((l) => l.kind === "h").length} sections found</span>
            </div>
            <button type="button" onClick={() => update({ mode: null })} className="h-10 cursor-pointer rounded-[10px] border border-line2 px-3 text-[13px] font-medium text-tx2">
              Change
            </button>
          </div>
        )}

        {step === 3 && job.mode === "build" && (
          <div className="animate-fade-up flex max-w-[820px] flex-col gap-4">
            <div className={`${CARD} gap-3.5`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl" style={{ fontFamily: SERIF }}>
                  Your details
                </span>
                <span className="text-[12px] text-t-mint">{flash}</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input value={cv.name} onChange={(e) => setCv({ name: e.target.value })} placeholder="Full name" className={INPUT} />
                <input value={cv.email} onChange={(e) => setCv({ email: e.target.value })} placeholder="Email" className={INPUT} />
                <input value={cv.phone} onChange={(e) => setCv({ phone: e.target.value })} placeholder="Phone" className={INPUT} />
                <input value={cv.address} onChange={(e) => setCv({ address: e.target.value })} placeholder="Town or city" className={INPUT} />
              </div>
              <span className="text-[13px] text-tx2">Education</span>
              <div className="grid gap-2.5 sm:grid-cols-[1.3fr_1.3fr_1fr_.8fr]">
                <input value={cv.uni} onChange={(e) => setCv({ uni: e.target.value })} placeholder="University" className={INPUT} />
                <input value={cv.degree} onChange={(e) => setCv({ degree: e.target.value })} placeholder="Degree" className={INPUT} />
                <input value={cv.dates} onChange={(e) => setCv({ dates: e.target.value })} placeholder="2024 – 2028" className={INPUT} />
                <input value={cv.grade} onChange={(e) => setCv({ grade: e.target.value })} placeholder="Grade" className={INPUT} />
              </div>
              <button type="button" onClick={() => setSaveMine((s) => !s)} className="flex h-9 cursor-pointer items-center gap-2.5 self-start text-[13px] text-tx2">
                <span
                  className="grid size-[18px] place-items-center rounded-[5px] border"
                  style={{ borderColor: saveMine ? "#8FC7FF" : "var(--line2)", background: saveMine ? "#8FC7FF" : "transparent" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "none", stroke: "#06111D", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", opacity: saveMine ? 1 : 0 }}>
                    <path d="m2 5 2 2 4-4" />
                  </svg>
                </span>
                Save my details and education for the next CV
              </button>
            </div>

            <Skills cv={cv} req={A.req} onChange={(skills) => setCv({ skills })} />

            <div className={`${CARD} gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-2xl" style={{ fontFamily: SERIF }}>
                  Experience and projects
                </span>
                <span className="text-[12px] text-tx3">Untick anything not relevant to this job</span>
              </div>
              {cv.exp.map((x, i) => (
                <ExperienceCard key={i} x={x} job={job} onChange={(patch) => setExp(i, patch)} />
              ))}
              <button
                type="button"
                onClick={() => setCv({ exp: [...cv.exp, { role: "", org: "", dates: "", bullets: "", on: true }] })}
                className="h-10 cursor-pointer self-start rounded-[10px] border border-dashed border-line2 px-3.5 text-[13px] font-medium text-t-sky"
              >
                Anything else to add?
              </button>
            </div>
          </div>
        )}

        {step === 4 && <AtsCheck job={job} onEdit={() => update({ step: 3 })} />}

        {step < 4 && (
          <div className="flex max-w-[820px] gap-2.5">
            <button
              type="button"
              onClick={() => step > 1 && update({ step: step - 1 })}
              className="h-12 cursor-pointer rounded-xl border border-line2 px-[18px] text-[15px] font-medium text-tx"
              style={{ opacity: step > 1 ? 1 : 0.35 }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              className="ml-auto h-12 cursor-pointer rounded-xl px-6 text-[15px] font-semibold text-[#06111D]"
              style={{ background: can[step] ? "#8FC7FF" : "var(--line2)" }}
            >
              {step === 3 ? "Check my CV" : "Continue"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, big, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; big?: boolean; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-tx2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-[46px] rounded-[10px] border border-line2 bg-s1 px-3 text-tx outline-none focus:border-l-sky ${mono ? "text-[13px]" : big ? "text-[15px]" : "text-sm"}`}
        style={mono ? { fontFamily: MONO } : undefined}
      />
    </label>
  );
}

function Skills({ cv, req, onChange }: { cv: BuiltCv; req: string[]; onChange: (skills: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const suggestions = req.filter((k) => !cv.skills.includes(k));
  const add = () => {
    const s = draft.trim();
    if (s && !cv.skills.includes(s)) onChange([...cv.skills, s]);
    setDraft("");
  };
  return (
    <div className={`${CARD} gap-3`}>
      <span className="text-2xl" style={{ fontFamily: SERIF }}>
        Skills
      </span>
      <div className="flex flex-wrap gap-1.5">
        {cv.skills.map((s) => {
          const wanted = req.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(cv.skills.filter((x) => x !== s))}
              className="h-8 cursor-pointer rounded-lg border px-2.5 text-[13px] font-medium"
              style={wanted ? { borderColor: "rgba(147,224,192,.6)", background: "rgba(147,224,192,.12)", color: "#9FE6C8" } : { borderColor: "var(--line2)", background: "var(--bg)", color: "var(--tx)" }}
            >
              {s} ×
            </button>
          );
        })}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border px-3.5 py-3" style={{ borderColor: "rgba(195,181,255,.3)", background: "rgba(195,181,255,.06)" }}>
          <span className="text-[13px] text-t-lil">This job asks for these. Add any you can back up.</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onChange([...cv.skills, k])}
                className="h-8 cursor-pointer rounded-lg border border-dashed bg-transparent px-2.5 text-[13px] font-medium text-t-lil"
                style={{ borderColor: "rgba(195,181,255,.6)" }}
              >
                + {k}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex max-w-[420px] gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Any more skills?"
          className="h-[42px] min-w-0 flex-1 rounded-[10px] border border-dashed border-line2 bg-transparent px-3 text-sm text-tx outline-none focus:border-l-sky"
        />
        <button type="button" onClick={add} className="h-[42px] cursor-pointer rounded-[10px] border border-line2 bg-s2 px-3.5 text-[13px] font-medium text-tx">
          Add
        </button>
      </div>
    </div>
  );
}

function ExperienceCard({ x, job, onChange }: { x: Experience; job: CvJob; onChange: (patch: Partial<Experience>) => void }) {
  const [list, setList] = useState<string[]>([]);
  const [thinking, startThinking] = useTransition();
  const input = "h-10 min-w-0 rounded-[9px] border border-line2 bg-s1 px-2.5 text-sm text-tx outline-none focus:border-l-sky";
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border bg-bg p-3.5"
      style={{ borderColor: x.on ? "var(--l-sky)" : "var(--line2)", opacity: x.on ? 1 : 0.55 }}
    >
      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[24px_1.4fr_1.2fr_.8fr]">
        <button
          type="button"
          onClick={() => onChange({ on: !x.on })}
          aria-label={x.on ? "Leave out of this CV" : "Include in this CV"}
          className="size-5 cursor-pointer rounded-md border p-0"
          style={{ borderColor: x.on ? "var(--l-sky)" : "var(--line2)", background: x.on ? "#8FC7FF" : "transparent" }}
        />
        <input value={x.role} onChange={(e) => onChange({ role: e.target.value })} placeholder="Role or project" className={`${input} font-medium`} />
        <input value={x.org} onChange={(e) => onChange({ org: e.target.value })} placeholder="Organisation" className={`${input} max-sm:col-start-2`} />
        <input value={x.dates} onChange={(e) => onChange({ dates: e.target.value })} placeholder="Dates" className={`${input} text-[13px] max-sm:col-start-2`} style={{ fontFamily: MONO }} />
      </div>
      <textarea
        value={x.bullets}
        onChange={(e) => onChange({ bullets: e.target.value })}
        placeholder="One point per line. What did you do, with what, and what changed?"
        className="min-h-[76px] resize-y rounded-[9px] border border-line2 bg-s1 p-2.5 text-sm leading-normal text-tx outline-none focus:border-l-sky"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => startThinking(async () => setList(await getIdeas({ exp: x, title: job.title, company: job.company, jd: job.jd })))}
          className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-medium text-t-lil"
          style={{ borderColor: "rgba(195,181,255,.5)", background: "rgba(195,181,255,.08)" }}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" style={{ fill: "currentColor" }}>
            <path d="M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z" />
          </svg>
          {thinking ? "Thinking…" : "Give me ideas"}
        </button>
        <span className="text-[12px] text-tx3">Ideas to rewrite in your own words. Never add something you did not do.</span>
      </div>
      {list.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {list.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ bullets: (x.bullets ? `${x.bullets}\n` : "") + t })}
              className="cursor-pointer rounded-[9px] border border-dashed bg-transparent px-2.5 py-2 text-left text-[13px] leading-[1.45] text-tx2"
              style={{ borderColor: "rgba(195,181,255,.4)" }}
            >
              + {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AtsCheck({ job, onEdit }: { job: CvJob; onEdit: () => void }) {
  const A = analyse(job);
  const [note, setNote] = useState<string | null>(null);
  const colour = scoreColour(A.score);
  const weak = new Set(A.weak.map((w) => w.t));
  const titleIssue = A.issues.some((i) => i.key === "title");
  const fname = `${(job.cv?.name || "CV").trim()} ${job.company}`.trim().replace(/\s+/g, "_");
  const html = cvHtml(A.lines, fname);
  const skillsLine = job.mode === "upload" ? A.lines.findIndex((l) => l.kind === "p" && A.matched.some((k) => l.t.includes(k)) && /,/.test(l.t)) : -1;

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote(null), 4000);
  };
  const saveBlob = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const STYLE: Record<string, [string, number, string, string, string]> = {
    name: ["24px", 500, "center", "0", "-.01em"],
    contact: ["13px", 400, "center", "0", "0"],
    h: ["13px", 600, "left", "14px", ".08em"],
    role: ["15px", 600, "left", "6px", "0"],
  };

  return (
    <div className="animate-fade-up grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-1 rounded-md bg-[#FBFCFE] px-6 py-8 text-[#0E131A] sm:px-11 sm:py-10" style={{ fontFamily: SERIF, boxShadow: "0 20px 60px -20px rgba(0,0,0,.6)" }}>
        {A.lines.map((l, i) => {
          const [size, weight, align, mt, ls] = STYLE[l.kind] ?? ["14px", 400, "left", "0", "0"];
          let hl = "transparent";
          let tag = "";
          let tagFg = "#0E131A";
          if (l.kind === "b" && weak.has(l.t)) [hl, tag, tagFg] = ["rgba(244,169,184,.28)", "Add a result", "#9C3550"];
          if ((l.kind === "skills" || i === skillsLine) && A.missing.length) [hl, tag, tagFg] = ["rgba(243,195,143,.32)", `Missing ${A.missing.length} keywords`, "#8E5413"];
          if (l.kind === "sum" && titleIssue) [hl, tag, tagFg] = ["rgba(195,181,255,.3)", "Name the role", "#5642B0"];
          return (
            <div
              key={i}
              className="relative -mx-2 rounded-[5px] px-2 py-[3px] leading-[1.45]"
              style={{
                background: hl,
                fontSize: size,
                fontWeight: weight,
                textAlign: align as "left" | "center",
                marginTop: mt,
                letterSpacing: ls,
                textTransform: l.kind === "h" ? "uppercase" : "none",
                color: l.kind === "h" ? "#1D5C9C" : "#0E131A",
              }}
            >
              {l.t}
              {tag && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-[.04em]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: tagFg }}>
                  {tag}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-5">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-s1 p-[22px]">
          <div className="relative grid size-[140px] place-items-center">
            <svg width="140" height="140" viewBox="0 0 140 140" className="absolute inset-0 -rotate-90">
              <circle cx="70" cy="70" r="60" style={{ fill: "none", stroke: "var(--line2)", strokeWidth: 8 }} />
              <circle
                cx="70"
                cy="70"
                r="60"
                pathLength={100}
                strokeDasharray={`${A.score} 100`}
                style={{ fill: "none", stroke: colour, strokeWidth: 8, strokeLinecap: "round", transition: "stroke-dasharray .4s" }}
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-[52px] leading-none" style={{ fontFamily: SERIF }}>
                {A.score || "—"}
              </span>
              <span className="text-[11px] text-tx3" style={{ fontFamily: MONO }}>
                ATS score
              </span>
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: colour }}>
            {!A.req.length ? "Add the job description to score it." : A.score >= 80 ? "Strong. Ready to send." : A.score >= 65 ? "Good. Fix the highlights first." : "Needs work before you send it."}
          </span>
          <span className="text-[12px] text-tx3">
            {A.matched.length} of {A.req.length} advert keywords found
          </span>
        </div>

        <div className="flex flex-col rounded-2xl border border-line bg-s1">
          <span className={`${EYEBROW} px-[18px] pb-1.5 pt-4`}>Fix these · {A.issues.length}</span>
          {A.issues.map((issue) => (
            <button
              key={issue.key}
              type="button"
              onClick={() => job.mode === "build" && onEdit()}
              className="grid cursor-pointer grid-cols-[10px_minmax(0,1fr)] gap-3 border-t border-line px-[18px] py-3 text-left text-tx"
            >
              <span className="mt-1 size-2.5 rounded-[3px]" style={{ background: issue.colour }} />
              <span className="flex flex-col gap-[3px]">
                <span className="text-sm font-medium">{issue.title}</span>
                <span className="text-[13px] leading-[1.45] text-tx2">{issue.detail}</span>
              </span>
            </button>
          ))}
          {job.mode === "build" ? (
            <button type="button" onClick={onEdit} className="mx-[18px] mb-4 mt-3 h-11 cursor-pointer rounded-[10px] bg-[#8FC7FF] text-sm font-semibold text-[#06111D]">
              Edit this CV
            </button>
          ) : (
            <span className="border-t border-line px-[18px] py-3 text-[12px] text-tx3">Fix these in your own file, then upload it again.</span>
          )}
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-s1 px-[18px] py-4">
          <span className={EYEBROW}>Download this CV</span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                const w = window.open("", "_blank");
                if (!w) return;
                w.document.write(html);
                w.document.close();
                setTimeout(() => w.print(), 300);
                flash('Choose "Save as PDF" in the print window.');
              }}
              className="h-11 cursor-pointer whitespace-nowrap rounded-[10px] border border-transparent bg-[#8FC7FF] text-[13px] font-semibold text-[#06111D]"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => {
                saveBlob(new Blob([`﻿${html}`], { type: "application/msword" }), `${fname}.doc`);
                flash(`Saved ${fname}.doc`);
              }}
              className="h-11 cursor-pointer whitespace-nowrap rounded-[10px] border border-line2 bg-transparent text-[13px] font-semibold text-tx"
            >
              Word
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(A.lines.map((l) => l.t).join("\n")).catch(() => {});
                window.open("https://docs.google.com/document/create", "_blank", "noopener");
                flash("CV copied. Paste it into the new Google Doc.");
              }}
              className="h-11 cursor-pointer whitespace-nowrap rounded-[10px] border border-line2 bg-transparent text-[13px] font-semibold text-tx"
            >
              Google Doc
            </button>
          </div>
          <span className="text-[12px] text-tx3">{note ?? "Fix the highlights first for the best score."}</span>
        </div>
      </div>
    </div>
  );
}

