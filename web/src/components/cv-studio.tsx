"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { aiReview, createJob, deleteJob, ideas as getIdeas, popularSkills, readFile, readJobLink, readSignupCv, saveDetails, saveJob } from "@/app/(app)/cv-studio/actions";
import { ApplyTips } from "@/components/apply-tips";
import type { AiReview } from "@/app/(app)/cv-studio/actions";
import { AREA_COLOUR, analyse, attachPrompt, blankCv, cvDocx, cvHtml, cvLines, ideasPrompt, scoreColour, tailorPrompt, type BuiltCv, type CvJob, type Experience, type Line } from "@/lib/cv";
import { EXAMPLE_CV, EXAMPLE_NOTES, EXAMPLE_RULES } from "@/lib/cv-example";
import { cvFromText, tailorCv } from "@/lib/cv-tailor";
import { SOFT, keywordsIn } from "@/lib/keywords";
import { tipFor } from "@/lib/skill-tips";

type Popular = { degree: string; adverts: number; skills: { name: string; share: number }[] };

type Props = { jobs: CvJob[]; selectedId: string | null; saved: BuiltCv; hasSaved: boolean; signupCv: string | null; aiOn: boolean };

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
  const [linkNote, setLinkNote] = useState<{ ok: boolean; text: string } | null>(null);
  // What "Use my CV" / "Tailor it for this job" changed, shown on the check page
  const [changes, setChanges] = useState<string[] | null>(null);
  const [popular, setPopular] = useState<Popular | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  // "Make it better with Claude": opens by itself the first time a CV reaches the check
  const [polishOpen, setPolishOpen] = useState(false);

  // Skills that real adverts for this student's degree ask for most (learned from Nimbus's saved roles)
  useEffect(() => {
    popularSkills()
      .then(setPopular)
      .catch(() => {});
  }, []);
  const [reading, startReading] = useTransition();
  const [creating, startCreating] = useTransition();
  const pending = useRef<Record<string, Partial<CvJob>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Leaving the page (or closing the tab) saves anything still waiting
  useEffect(() => {
    const flush = () => {
      for (const [id, changes] of Object.entries(pending.current)) {
        clearTimeout(timers.current[id]);
        saveJob(id, changes);
      }
      pending.current = {};
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const job = jobs.find((j) => j.id === selId) ?? jobs[jobs.length - 1] ?? null;

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
  const fromMyCv = (name: string, text: string, meta: { pages?: number; columns?: boolean }) => {
    if (!job) return;
    const parsed = cvFromText(text, { email: saved.email, phone: saved.phone, linkedin: saved.linkedin, address: saved.address, uni: saved.uni, degree: saved.degree, dates: saved.dates, grade: saved.grade });
    const tailored = tailorCv(parsed, job.jd);
    update({ mode: "build", cv: tailored.cv, cvName: name, cvText: text, cvMeta: meta, step: 4 });
    setPolishOpen(true);
    setChanges([`Read ${name} into the Nimbus template: ${parsed.exp.length} entries, ${parsed.skills.length} skills. Check the details on step 3.`, ...tailored.changes]);
  };
  const tailorNow = () => {
    if (!job?.cv) return;
    const tailored = tailorCv(job.cv, job.jd);
    update({ cv: tailored.cv });
    setChanges(tailored.changes);
    setFlash("Tailored for this job: see what changed on the check");
  };
  const setExp = (i: number, patch: Partial<Experience>) => {
    if (!job?.cv) return;
    const exp = job.cv.exp.slice();
    exp[i] = { ...exp[i], ...patch };
    setCv({ exp });
  };

  const remove = (id: string) => {
    const gone = jobs.find((j) => j.id === id);
    if (!gone || !window.confirm(`Delete “${gone.title || "Untitled job"}” and its CV? This can't be undone.`)) return;
    clearTimeout(timers.current[id]);
    delete pending.current[id];
    deleteJob(id);
    const rest = jobs.filter((j) => j.id !== id);
    setJobs(rest);
    if (id === job?.id) {
      const nextId = rest[rest.length - 1]?.id ?? null;
      setSelId(nextId);
      window.history.replaceState(null, "", nextId ? `/cv-studio?id=${nextId}` : "/cv-studio");
    }
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
      setJobs((list) => [...list, { id, title: "", company: "", link: "", jd: "", jdName: null, mode: null, cvName: null, cvText: null, cvMeta: null, cv: null, step: 1 }]);
      select(id);
    });

  const upload = (file: File | undefined, apply: (name: string, text: string, meta: { pages?: number; columns?: boolean }) => void) => {
    if (!file) return;
    setFileError(null);
    const form = new FormData();
    form.set("file", file);
    startReading(async () => {
      const result = await readFile(form);
      if ("error" in result) setFileError(result.error);
      else apply(result.name, result.text, { pages: result.pages, columns: result.columns });
    });
  };

  if (!job) {
    return (
      <div className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center px-6 py-10 leading-[normal]">
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
        <div className="mt-10 w-full max-w-[640px]">
          <ExampleBanner onOpen={() => setExampleOpen(true)} />
        </div>
        {exampleOpen && <ExampleCv onClose={() => setExampleOpen(false)} />}
      </div>
    );
  }

  const A = analyse(job);
  const step = job.step;
  const can = [true, !!(job.title.trim() && job.company.trim()), !!job.jd.trim(), !!job.mode];
  const cv = job.cv ?? blankCv();
  const reachable = (n: number) => n <= step || can.slice(1, n).every(Boolean);
  const others = jobs.filter((j) => j.id !== job.id && j.mode === "build" && j.cv && j.cv.exp.length);

  const next = async () => {
    if (!can[step]) return;
    if (step === 3 && job.mode === "build" && saveMine && job.cv) {
      setSaved(job.cv);
      setHasSaved(true);
      saveDetails(job.cv);
    }
    update({ step: step + 1 });
    if (step === 3) setPolishOpen(true);
  };

  return (
    <div className="grid items-start leading-[normal] md:min-h-[calc(100vh-65px)] md:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="flex gap-2.5 overflow-x-auto border-b border-line px-4 py-4 md:min-h-[calc(100vh-65px)] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-7">
        <span className={`${EYEBROW} hidden px-2 md:block`}>One CV per job</span>
        {jobs.map((j) => {
          const s = j.mode ? analyse(j).score : 0;
          const on = j.id === job.id;
          return (
            <div key={j.id} className="group relative min-w-[200px] md:min-w-0">
              <button
                type="button"
                onClick={() => select(j.id)}
                className="flex w-full cursor-pointer flex-col gap-1 rounded-xl border p-3 pr-9 text-left text-tx"
                style={{ borderColor: on ? "var(--l-sky)" : "var(--line)", background: on ? "var(--b-sky)" : "transparent" }}
              >
                <span className="text-sm font-medium leading-[1.3]">{j.title || "Untitled job"}</span>
                <span className="text-[12px] text-tx3">{j.company || "Add company"}</span>
                <span className="text-[11px]" style={{ fontFamily: MONO, color: s ? scoreColour(s) : "#8C97A8" }}>
                  {s ? `ATS ${s}` : `Step ${j.step} of 4`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(j.id)}
                aria-label={`Delete ${j.title || "this job"}`}
                title="Delete"
                className="absolute right-2 top-2 grid size-7 cursor-pointer place-items-center rounded-lg text-[16px] leading-none text-tx3 hover:bg-s2 hover:text-t-rose"
              >
                ×
              </button>
            </div>
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
                  onClick={() => reachable(n) && n !== step && update({ step: n })}
                  className="flex flex-1 flex-col gap-2 text-left text-tx"
                  style={{ cursor: reachable(n) && n !== step ? "pointer" : "default" }}
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

        {step < 4 && <ExampleBanner onOpen={() => setExampleOpen(true)} />}

        {step === 1 && (
          <div className="animate-fade-up flex max-w-[640px] flex-col gap-3.5">
            <Field label="Job title" value={job.title} onChange={(v) => update({ title: v })} placeholder="e.g. Operational Excellence Intern" big />
            <Field label="Company" value={job.company} onChange={(v) => update({ company: v })} placeholder="e.g. Müller UK & Ireland" big />
            <Field label="Link to the job" value={job.link} onChange={(v) => update({ link: v })} placeholder="https://careers.company.com/role" mono />
            {job.link.trim() && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={reading}
                  onClick={() => {
                    setLinkNote(null);
                    startReading(async () => {
                      const r = await readJobLink(job.link);
                      if ("error" in r) {
                        setLinkNote({ ok: false, text: r.error });
                        return;
                      }
                      update({ jd: r.text, jdName: "Read from the job link", title: job.title.trim() || r.title, company: job.company.trim() || r.company });
                      setLinkNote({ ok: true, text: "Got the advert from the link. Check it on the next step." });
                    });
                  }}
                  className="h-10 cursor-pointer rounded-[10px] border border-line2 px-3.5 text-[13px] font-medium text-t-sky disabled:opacity-60"
                >
                  {reading ? "Reading the page…" : "Read the advert from this link"}
                </button>
                {linkNote && <span className={`text-[13px] ${linkNote.ok ? "text-t-mint" : "text-t-rose"}`}>{linkNote.text}</span>}
              </div>
            )}
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

        {exampleOpen && <ExampleCv onClose={() => setExampleOpen(false)} />}
        {polishOpen && step === 4 && (
          <PolishModal job={job} lines={A.lines} fixes={A.report.issues.map((i) => i.title)} onEdit={() => {
              setPolishOpen(false);
              update({ step: 3 });
            }} onClose={() => setPolishOpen(false)} />
        )}

        {step === 3 && !job.mode && (
          <div className="animate-fade-up flex max-w-[760px] flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-l-sky bg-b-sky p-[22px] text-tx">
                <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => upload(e.target.files?.[0], fromMyCv)} />
                <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-t-sky">Easiest</span>
                <span className="text-[26px] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                  Use my CV
                </span>
                <span className="text-sm leading-normal text-tx2">
                  Upload it once. Nimbus puts it in the clean one-page template and tailors it to this advert: you just check it and download.
                </span>
                <span className="mt-1.5 flex h-11 items-center justify-center rounded-[10px] bg-[#8FC7FF] font-semibold text-[#06111D]">{reading ? "Reading…" : "Upload PDF or Word"}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  update({ mode: "build", cv: { ...blankCv(), ...saved, skills: [...saved.skills], exp: saved.exp.map((x) => ({ ...x })) } });
                  setFlash(hasSaved ? "Filled from your saved details" : null);
                }}
                className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-line2 bg-s1 p-[22px] text-left text-tx"
              >
                <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-tx3">No CV yet</span>
                <span className="text-[26px] tracking-[-.02em]" style={{ fontFamily: SERIF }}>
                  Start from scratch
                </span>
                <span className="text-sm leading-normal text-tx2">Fill in a short form. Your saved details fill in automatically.</span>
                <span className="mt-1.5 flex h-11 items-center justify-center rounded-[10px] border border-line2 font-medium">Start building</span>
              </button>
            </div>
            {props.signupCv && (
              <button
                type="button"
                onClick={() =>
                  startReading(async () => {
                    const result = await readSignupCv();
                    if ("error" in result) setFileError(result.error);
                    else fromMyCv(result.name, result.text, { pages: result.pages, columns: result.columns });
                  })
                }
                className="cursor-pointer self-start text-[13px] text-t-sky hover:text-tx"
              >
                {reading ? "Reading…" : `Or use ${props.signupCv}, the CV you gave when you signed up`}
              </button>
            )}
            {others.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl border border-line2 bg-s1 p-4">
                <span className="text-sm text-tx2">Or start from a CV you made for another job: Nimbus copies it here and tailors it to this advert.</span>
                <div className="flex flex-wrap gap-2">
                  {others.slice(-6).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        const copy = { ...o.cv!, skills: [...o.cv!.skills], exp: o.cv!.exp.map((x) => ({ ...x })) };
                        const tailored = tailorCv(copy, job.jd);
                        update({ mode: "build", cv: tailored.cv, step: 4 });
                        setPolishOpen(true);
                        setChanges([`Copied your CV from “${o.title || "another job"}”. Your other CV is unchanged.`, ...tailored.changes]);
                      }}
                      className="h-9 cursor-pointer rounded-[10px] border border-line2 px-3 text-[13px] font-medium text-t-sky hover:text-tx"
                    >
                      {o.title || "Untitled"}
                      {o.company ? ` · ${o.company}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="cursor-pointer self-start text-[13px] text-tx3 hover:text-tx">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0], (name, text, meta) => update({ mode: "upload", cvName: name, cvText: text, cvMeta: meta }))}
              />
              Or just check my file exactly as it is, without changing it
            </label>
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
            <button
              type="button"
              onClick={() => job.cvText && fromMyCv(job.cvName ?? "your CV", job.cvText, job.cvMeta ?? {})}
              className="h-10 cursor-pointer rounded-[10px] bg-[#8FC7FF] px-3 text-[13px] font-semibold text-[#06111D]"
            >
              Put it in the template and tailor it
            </button>
            <button type="button" onClick={() => update({ mode: null })} className="h-10 cursor-pointer rounded-[10px] border border-line2 px-3 text-[13px] font-medium text-tx2">
              Change
            </button>
          </div>
        )}

        {step === 3 && job.mode === "build" && (
          <div className="animate-fade-up flex max-w-[820px] flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4" style={{ borderColor: "rgba(195,181,255,.4)", background: "rgba(195,181,255,.07)" }}>
              <span className="min-w-0 flex-1 text-sm leading-normal text-tx2">
                <b className="text-tx">Tailor it for this job.</b> Puts each entry&apos;s strongest bullet first, adds the advert&apos;s skills your bullets already prove, and keeps it to one page.
              </span>
              <button type="button" onClick={tailorNow} className="h-10 cursor-pointer rounded-[10px] bg-[#C3B5FF] px-4 text-[13px] font-semibold text-[#120B2A]">
                Tailor it
              </button>
            </div>
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
                <input value={cv.linkedin ?? ""} onChange={(e) => setCv({ linkedin: e.target.value })} placeholder="linkedin.com/in/your-name" className={INPUT} />
                <input value={cv.address} onChange={(e) => setCv({ address: e.target.value })} placeholder="Town or city (optional)" className={INPUT} />
              </div>
              <span className="text-[13px] text-tx2">Education</span>
              <div className="grid gap-2.5 sm:grid-cols-[1.3fr_1.3fr_1fr_.8fr]">
                <input value={cv.uni} onChange={(e) => setCv({ uni: e.target.value })} placeholder="University" className={INPUT} />
                <input value={cv.degree} onChange={(e) => setCv({ degree: e.target.value })} placeholder="Degree" className={INPUT} />
                <input value={cv.dates} onChange={(e) => setCv({ dates: e.target.value })} placeholder="2024 – 2028" className={INPUT} />
                <input value={cv.grade} onChange={(e) => setCv({ grade: e.target.value })} placeholder="On track for a 2:1" className={INPUT} />
              </div>
              <input
                value={cv.modules ?? ""}
                onChange={(e) => setCv({ modules: e.target.value })}
                placeholder="Relevant modules (optional): Thermodynamics, Stress Analysis, Control"
                className={INPUT}
              />
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

            <Skills cv={cv} req={A.req} popular={popular} onChange={(skills) => setCv({ skills })} />

            <div className={`${CARD} gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-2xl" style={{ fontFamily: SERIF }}>
                  Experience and projects
                </span>
                <span className="text-[12px] text-tx3">Untick anything not relevant to this job. Projects count as much as jobs.</span>
              </div>
              {cv.exp.map((x, i) => (
                <ExperienceCard key={i} x={x} job={job} onChange={(patch) => setExp(i, patch)} />
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCv({ exp: [...cv.exp, { role: "", org: "", dates: "", bullets: "", on: true, kind: "work" }] })}
                  className="h-10 cursor-pointer rounded-[10px] border border-dashed border-line2 px-3.5 text-[13px] font-medium text-t-sky"
                >
                  Add a job or placement
                </button>
                <button
                  type="button"
                  onClick={() => setCv({ exp: [...cv.exp, { role: "", org: "", dates: "", bullets: "", on: true, kind: "project" }] })}
                  className="h-10 cursor-pointer rounded-[10px] border border-dashed border-line2 px-3.5 text-[13px] font-medium text-t-sky"
                >
                  Add a project
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <AtsCheck
            job={job}
            changes={changes}
            me={{ degree: job.cv?.degree || saved.degree, uni: job.cv?.uni || saved.uni }}
            aiOn={props.aiOn}
            onExample={() => setExampleOpen(true)}
            onPolish={() => setPolishOpen(true)}
            onEdit={() => update({ step: 3 })}
          />
        )}

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

function Skills({ cv, req, popular, onChange }: { cv: BuiltCv; req: string[]; popular: Popular | null; onChange: (skills: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const mine = new Set(cv.skills.map((s) => s.toLowerCase()));
  const own = (k: string) => mine.has(k.toLowerCase());
  // Skills the student's own bullets and modules already show, but that aren't listed yet
  const shown = keywordsIn([cv.modules ?? "", ...cv.exp.filter((x) => x.on).map((x) => x.bullets)].join("\n")).filter((k) => !own(k) && !SOFT.has(k));
  const suggestions = req.filter((k) => !own(k) && !shown.includes(k));
  const common = (popular?.skills ?? []).filter((s) => !own(s.name) && !req.includes(s.name) && !shown.includes(s.name)).slice(0, 14);
  // Listed skills no bullet backs up yet, the ones this job wants first
  const bulletText = cv.exp.filter((x) => x.on).map((x) => x.bullets).join("\n");
  const proven = new Set(keywordsIn(bulletText).map((k) => k.toLowerCase()));
  const unproven = cv.skills.filter((k) => !SOFT.has(k) && !proven.has(k.toLowerCase())).sort((a, b) => Number(req.includes(b)) - Number(req.includes(a)));
  const chip = (k: string, colour: string, note?: string) => (
    <button
      key={k}
      type="button"
      onClick={() => onChange([...cv.skills, k])}
      className="h-8 cursor-pointer rounded-lg border border-dashed bg-transparent px-2.5 text-[13px] font-medium"
      style={{ borderColor: colour, color: colour }}
    >
      + {k}
      {note && <span className="ml-1 text-[11px] opacity-70">{note}</span>}
    </button>
  );
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
          <span className="text-[13px] text-t-lil">This job asks for these. Add any you can back up in an interview.</span>
          <div className="flex flex-wrap gap-1.5">{suggestions.map((k) => chip(k, "#C3B5FF"))}</div>
        </div>
      )}
      {shown.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border px-3.5 py-3" style={{ borderColor: "rgba(147,224,192,.3)", background: "rgba(147,224,192,.06)" }}>
          <span className="text-[13px] text-t-mint">Your bullets already show these. List them so screening software finds them.</span>
          <div className="flex flex-wrap gap-1.5">{shown.map((k) => chip(k, "#9FE6C8", req.includes(k) ? "job wants" : undefined))}</div>
        </div>
      )}
      {common.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-line2 px-3.5 py-3">
          <span className="text-[13px] text-tx2">
            Often asked for in {popular?.degree} roles: from {popular?.adverts} real adverts Nimbus has found. Learn or add the ones that fit you.
          </span>
          <div className="flex flex-wrap gap-1.5">{common.map((s) => chip(s.name, "var(--tx2)", `${s.share}%`))}</div>
        </div>
      )}
      {unproven.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-line2 px-3.5 py-3">
          <span className="text-[13px] text-tx2">
            <b className="text-tx">Make your skills count.</b> These are listed but not in any bullet yet. Recruiters trust a skill when a bullet shows it:
          </span>
          {unproven.slice(0, 4).map((k) => (
            <span key={k} className="text-[13px] leading-[1.45] text-tx3">
              <span className="font-medium text-tx">{k}:</span> {tipFor(k)}
            </span>
          ))}
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
  const [copied, setCopied] = useState(false);
  const [thinking, startThinking] = useTransition();
  const project = (x.kind ?? "work") === "project";
  const input = "h-10 min-w-0 rounded-[9px] border border-line2 bg-s1 px-2.5 text-sm text-tx outline-none focus:border-l-sky";
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border bg-bg p-3.5"
      style={{ borderColor: x.on ? "var(--l-sky)" : "var(--line2)", opacity: x.on ? 1 : 0.55 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ on: !x.on })}
          aria-label={x.on ? "Leave out of this CV" : "Include in this CV"}
          className="size-5 cursor-pointer rounded-md border p-0"
          style={{ borderColor: x.on ? "var(--l-sky)" : "var(--line2)", background: x.on ? "#8FC7FF" : "transparent" }}
        />
        <div className="flex rounded-lg border border-line2 p-0.5 text-[12px] font-medium">
          {(["work", "project"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ kind: k })}
              className="h-7 cursor-pointer rounded-md px-2.5"
              style={{ background: (x.kind ?? "work") === k ? "var(--s2)" : "transparent", color: (x.kind ?? "work") === k ? "var(--tx)" : "var(--tx3)" }}
            >
              {k === "work" ? "Experience" : "Project"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1.2fr_.8fr]">
        <input value={x.role} onChange={(e) => onChange({ role: e.target.value })} placeholder={project ? "Project name" : "Job title"} className={`${input} font-medium`} />
        <input value={x.org} onChange={(e) => onChange({ org: e.target.value })} placeholder={project ? "Team or module (optional)" : "Company"} className={input} />
        <input value={x.dates} onChange={(e) => onChange({ dates: e.target.value })} placeholder="Jun 2025 – Sep 2025" className={`${input} text-[13px]`} style={{ fontFamily: MONO }} />
      </div>
      {!project && (
        <input value={x.place ?? ""} onChange={(e) => onChange({ place: e.target.value })} placeholder="Town (optional)" className={`${input} sm:max-w-[260px]`} />
      )}
      <textarea
        value={x.bullets}
        onChange={(e) => onChange({ bullets: e.target.value })}
        placeholder="One point per line. Start with a verb and add a number: Designed a bracket in SolidWorks, cutting its mass by 18%."
        className="min-h-[76px] resize-y rounded-[9px] border border-line2 bg-s1 p-2.5 text-sm leading-normal text-tx outline-none focus:border-l-sky"
      />
      <div className="flex flex-wrap items-center gap-2">
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
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(ideasPrompt(x, job.title, job.company, job.jd)).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="h-[34px] cursor-pointer rounded-[9px] border border-line2 px-3 text-[13px] font-medium text-tx2 hover:text-tx"
        >
          {copied ? "Copied: paste it into Claude or Gemini" : "Copy a prompt for Claude or Gemini"}
        </button>
        <span className="text-[12px] text-tx3">Rewrite ideas in your own words. Never add something you didn&apos;t do.</span>
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

const PAPER = '"Times New Roman", Times, serif';

/** The ATS check: the CV as the template prints it, problems marked in place, the score and how to raise it. */
function AtsCheck({
  job,
  changes,
  me,
  aiOn,
  onExample,
  onPolish,
  onEdit,
}: {
  job: CvJob;
  changes: string[] | null;
  me: { degree: string; uni: string };
  aiOn: boolean;
  onExample: () => void;
  onPolish: () => void;
  onEdit: () => void;
}) {
  const A = analyse(job);
  const R = A.report;
  const [note, setNote] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const colour = scoreColour(A.score);
  const noNumber = new Set(R.bullets.filter((b) => !b.hasNumber).map((b) => b.text));
  const fname = `${(job.cv?.name || "CV").trim()} CV ${job.company}`.trim().replace(/\s+/g, "_");
  const html = cvHtml(A.lines, fname);
  const weakStart = new Set(R.bullets.filter((b) => /^(responsible for|helped|assisted|worked on|involved in|duties included|tasked with|participated in)\b/i.test(b.text)).map((b) => b.text));
  // Where to point at missing keywords: the first skills line (in an uploaded CV, the first line under a Skills heading)
  const skillsHeading = A.lines.findIndex((l) => l.kind === "h" && /skill/i.test(l.t));
  const skillsLine = job.mode === "upload" ? (skillsHeading >= 0 && skillsHeading + 1 < A.lines.length ? skillsHeading + 1 : -1) : A.lines.findIndex((l) => l.kind === "skills");

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

  return (
    <div className="animate-fade-up flex flex-col gap-5">
    <button
      type="button"
      onClick={onPolish}
      className="flex cursor-pointer flex-wrap items-center gap-4 rounded-2xl border-2 px-6 py-5 text-left text-tx"
      style={{ borderColor: "#C3B5FF", background: "rgba(195,181,255,.12)" }}
    >
      <span className="text-[34px] leading-none">✨</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[22px] font-semibold leading-tight sm:text-[26px]">Next: make it much better with Claude (free)</span>
        <span className="text-[15px] text-tx2">Two buttons and a paste. Claude rewrites your CV for this job. No download needed.</span>
      </span>
      <span className="flex h-12 items-center rounded-xl bg-[#C3B5FF] px-6 text-[16px] font-semibold text-[#120B2A]">Show me how</span>
    </button>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Paper
          lines={A.lines}
          mark={(l, i) => {
            const plain = l.t.replace(/^•\s*/, "");
            if (i === skillsLine && A.missing.length) return { bg: "rgba(243,195,143,.32)", tag: `Missing ${A.missing.length} keywords`, fg: "#8E5413" };
            if (l.kind === "b" && weakStart.has(plain)) return { bg: "rgba(244,169,184,.28)", tag: "Start with a verb", fg: "#9C3550" };
            if (l.kind === "b" && noNumber.has(plain)) return { bg: "rgba(244,169,184,.28)", tag: "Add a result", fg: "#9C3550" };
            return null;
          }}
        />
        <ReadByAts job={job} lines={A.lines} />
      </div>

      <div className="flex flex-col gap-4">
        {changes && changes.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border px-[18px] py-4" style={{ borderColor: "rgba(195,181,255,.4)", background: "rgba(195,181,255,.07)" }}>
            <span className={EYEBROW}>What Nimbus changed for this job</span>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[1.45] text-tx2">
              {changes.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
            {R.issues.some((i) => i.severity === "fix") && (
              <span className="text-[13px] leading-[1.45] text-tx">
                <b>Still up to you:</b> {R.issues.filter((i) => i.severity === "fix").slice(0, 2).map((i) => i.title.toLowerCase()).join("; ")}. Nimbus won&apos;t
                invent results for you: see the fix list below, or use Tailor with Claude or Gemini.
              </span>
            )}
            <span className="text-[12px] text-tx3">Nothing was made up: every change uses what your CV already says. Undo any of it on step 3.</span>
          </div>
        )}
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
                {A.score}
              </span>
              <span className="text-[11px] text-tx3" style={{ fontFamily: MONO }}>
                ATS score
              </span>
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: colour }}>
            {!job.jd.trim() ? "Add the job advert to score it properly." : A.req.length === 0 ? "No skills found in the advert yet." : A.score >= 80 ? "Strong. Ready to send." : A.score >= 65 ? "Good. Fix the highlights first." : "Needs work before you send it."}
          </span>
          <span className="text-[12px] text-tx3">
            {A.matched.length} of {A.req.length} advert keywords found
          </span>
          <div className="mt-2 flex w-full flex-col gap-2">
            {R.areas.map((a) => (
              <div key={a.key} className="flex flex-col gap-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-tx2">{a.label}</span>
                  <span style={{ fontFamily: MONO, color: scoreColour(a.score) }}>{a.score}</span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-line2">
                  <span className="block h-full rounded-full" style={{ width: `${a.score}%`, background: scoreColour(a.score), transition: "width .4s" }} />
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setHowOpen((o) => !o)} className="mt-1 cursor-pointer text-[12px] text-t-sky hover:text-tx">
            {howOpen ? "Hide how the score works" : "How the score works"}
          </button>
          {howOpen && (
            <span className="text-[12px] leading-normal text-tx2">
              Screening software keeps CVs that contain the advert&apos;s words, so <b>keywords</b> count most (40%). Then <b>measurable impact</b> (25%): bullets that
              start with a verb and show a number. <b>Parsing and layout</b> (20%): one column, one page, readable text. <b>Sections</b> (15%): Education, Experience,
              Projects, Technical Skills and contact details. Fix the top item, check again, repeat. No employer shares a score: real systems (Workday,
              Greenhouse, SuccessFactors) turn your CV into fields, then recruiters search and rank those fields by the advert&apos;s words. This checklist
              copies what they look for; see &ldquo;How screening software reads your CV&rdquo; under your CV.
            </span>
          )}
        </div>

        <div className="flex flex-col rounded-2xl border border-line bg-s1">
          <span className={`${EYEBROW} px-[18px] pb-1.5 pt-4`}>Fix these · {R.issues.length}</span>
          {R.issues.map((issue) => (
            <button
              key={issue.title}
              type="button"
              onClick={() => job.mode === "build" && onEdit()}
              className="grid cursor-pointer grid-cols-[10px_minmax(0,1fr)] gap-3 border-t border-line px-[18px] py-3 text-left text-tx"
            >
              <span className="mt-1 size-2.5 rounded-[3px]" style={{ background: AREA_COLOUR[issue.area] }} />
              <span className="flex flex-col gap-[3px]">
                <span className="text-sm font-medium">
                  {issue.title}
                  {issue.severity === "fix" && <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-t-rose">fix</span>}
                </span>
                <span className="text-[13px] leading-[1.45] text-tx2">{issue.detail}</span>
                {issue.lines?.map((line) => (
                  <span key={line} className="truncate text-[12px] text-tx3">
                    “{line}”
                  </span>
                ))}
              </span>
            </button>
          ))}
          {R.issues.length === 0 && <span className="border-t border-line px-[18px] py-3 text-[13px] text-t-mint">Nothing to fix. Send it.</span>}
          {job.mode === "build" ? (
            <button type="button" onClick={onEdit} className="mx-[18px] mb-4 mt-3 h-11 cursor-pointer rounded-[10px] bg-[#8FC7FF] text-sm font-semibold text-[#06111D]">
              Edit this CV
            </button>
          ) : (
            <span className="border-t border-line px-[18px] py-3 text-[12px] text-tx3">
              Fix these in your own file and upload it again, or build it with the Nimbus template (Back, then Create one for this job).
            </span>
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
              onClick={async () => {
                saveBlob(await cvDocx(A.lines), `${fname}.docx`);
                flash(`Saved ${fname}.docx`);
              }}
              className="h-11 cursor-pointer whitespace-nowrap rounded-[10px] border border-line2 bg-transparent text-[13px] font-semibold text-tx"
            >
              Word
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(A.lines.map((l) => (l.right ? `${l.t}    ${l.right}` : l.t)).join("\n")).catch(() => {});
                window.open("https://docs.google.com/document/create", "_blank", "noopener");
                flash("CV copied. Paste it into the new Google Doc.");
              }}
              className="h-11 cursor-pointer whitespace-nowrap rounded-[10px] border border-line2 bg-transparent text-[13px] font-semibold text-tx"
            >
              Google Doc
            </button>
          </div>
          <span className="text-[12px] text-tx3">{note ?? "Template: r/EngineeringResumes style, one column, one page."}</span>
          <button type="button" onClick={onExample} className="cursor-pointer self-start text-[12px] font-medium text-t-sky hover:text-tx">
            Compare with a great example →
          </button>
        </div>

        {aiOn && <AiReviewCard job={job} lines={A.lines} />}


        <ApplyTips company={job.company} title={job.title} degree={me.degree} uni={me.uni} skills={A.matched.filter((k) => !SOFT.has(k))} />
      </div>
    </div>
    </div>
  );
}

type Mark = { bg: string; tag: string; fg: string } | null;

/** A CV as it prints: Times New Roman on white, dates on the right. `mark` highlights and tags lines. */
function Paper({ lines, mark }: { lines: Line[]; mark?: (l: Line, i: number) => Mark }) {
  return (
    <div className="flex flex-col rounded-md bg-white px-6 py-8 text-black sm:px-11 sm:py-10" style={{ fontFamily: PAPER, boxShadow: "0 20px 60px -20px rgba(0,0,0,.6)" }}>
      {lines.map((l, i) => {
        const m = mark?.(l, i) ?? null;
        const tagEl = m?.tag && (
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-[.04em]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: m.fg }}>
            {m.tag}
          </span>
        );
        if (l.kind === "name") return <div key={i} className="text-center text-[26px] leading-tight">{l.t}</div>;
        if (l.kind === "contact")
          return (
            <div key={i} className="mb-1 rounded-[4px] text-center text-[13px]" style={{ background: m?.bg }}>
              {l.t}
              {tagEl}
            </div>
          );
        if (l.kind === "h")
          return (
            <div key={i} className="mt-3 border-b border-black pb-px text-[14px] font-bold uppercase tracking-[.04em]" style={{ background: m?.bg }}>
              {l.t}
              {tagEl}
            </div>
          );
        if (l.kind === "role" || l.kind === "sub")
          return (
            <div key={i} className={`-mx-2 flex justify-between gap-3 rounded-[4px] px-2 text-[14px] ${l.kind === "role" ? "mt-1.5 font-bold" : "italic"}`} style={{ background: m?.bg }}>
              <span>
                {l.t}
                {tagEl}
              </span>
              {l.right && <span className="shrink-0">{l.right}</span>}
            </div>
          );
        return (
          <div key={i} className={`-mx-2 rounded-[4px] px-2 py-px text-[13.5px] leading-[1.4] ${l.kind === "b" ? "pl-6 -indent-3" : ""}`} style={{ background: m?.bg ?? "transparent" }}>
            {l.t}
            {tagEl}
          </div>
        );
      })}
    </div>
  );
}

/** The example CV with notes on what makes it work, over the page. */
function ExampleCv({ onClose }: { onClose: () => void }) {
  const lines = cvLines({ id: "example", title: "", company: "", link: "", jd: "", jdName: null, mode: "build", cvName: null, cvText: null, cvMeta: null, cv: EXAMPLE_CV, step: 4 });
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(6,9,14,.78)] px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto grid max-w-[1100px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" onClick={(e) => e.stopPropagation()}>
        <Paper
          lines={lines}
          mark={(l) => {
            const note = EXAMPLE_NOTES.find((n) => l.t.startsWith(n.starts));
            return note ? { bg: "rgba(147,224,192,.22)", tag: note.note, fg: "#1F6B4C" } : null;
          }}
        />
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-s1 p-5 text-tx">
          <div className="flex items-center justify-between">
            <span className={EYEBROW}>What makes it work</span>
            <button type="button" onClick={onClose} className="h-8 cursor-pointer rounded-lg border border-line2 px-2.5 text-[13px] text-tx2 hover:text-tx">
              Close
            </button>
          </div>
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-[1.5] text-tx2">
            {EXAMPLE_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <span className="text-[12px] leading-[1.45] text-tx3">
            Sam is made up; the shape is real. Based on the r/EngineeringResumes wiki. Nimbus builds yours in exactly this template.
          </span>
        </div>
      </div>
    </div>
  );
}

/** What a tracking system would pull out of this CV, field by field. */
function ReadByAts({ job, lines }: { job: CvJob; lines: Line[] }) {
  const read = job.mode === "upload" ? cvFromText(job.cvText ?? "") : (job.cv ?? blankCv());
  const exp = read.exp.filter((x) => x.on);
  const undated = exp.filter((x) => !x.dates).map((x) => x.role || x.org).filter(Boolean);
  const rows: { label: string; value: string; ok: boolean }[] = [
    { label: "Name", value: read.name || "not found", ok: !!read.name },
    { label: "Email", value: read.email || "not found", ok: !!read.email },
    { label: "Phone", value: read.phone || "not found", ok: !!read.phone },
    { label: "LinkedIn", value: read.linkedin || "not found (optional)", ok: !!read.linkedin },
    { label: "University", value: read.uni || "not found", ok: !!read.uni },
    { label: "Degree", value: read.degree || "not found", ok: !!read.degree },
    { label: "Study dates", value: read.dates || "not found", ok: !!read.dates },
    { label: "Jobs", value: `${exp.filter((x) => (x.kind ?? "work") === "work").length} found`, ok: exp.some((x) => (x.kind ?? "work") === "work") },
    { label: "Projects", value: `${exp.filter((x) => x.kind === "project").length} found`, ok: exp.some((x) => x.kind === "project") },
    { label: "Dates on each entry", value: undated.length ? `missing on ${undated.slice(0, 2).join(", ")}` : "all present", ok: !undated.length },
    { label: "Skills", value: `${read.skills.length} found`, ok: read.skills.length > 0 },
  ];
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-s1 px-[18px] py-4 text-tx">
      <span className={EYEBROW}>How screening software reads your CV</span>
      <span className="text-[13px] leading-[1.45] text-tx2">
        Before a person sees it, systems like Workday, Greenhouse and SuccessFactors pull your CV into fields like these. Recruiters then search the fields for the
        advert&apos;s words. Anything &ldquo;not found&rdquo; here may go missing there too.
      </span>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 items-baseline gap-2 text-[13px]">
            <span style={{ color: r.ok ? "#9FE6C8" : "#F6B4C1" }}>{r.ok ? "✓" : "✕"}</span>
            <span className="shrink-0 text-tx3">{r.label}</span>
            <span className="truncate text-tx2">{r.value}</span>
          </div>
        ))}
      </div>
      {lines.length > 0 && job.mode === "upload" && (
        <span className="text-[12px] text-tx3">Fix a &ldquo;not found&rdquo; by putting it on its own line in a plain layout, or use the Nimbus template.</span>
      )}
    </div>
  );
}

/** The free AI review (Gemini free tier): a recruiter's read of this CV against this advert. */
function AiReviewCard({ job, lines }: { job: CvJob; lines: Line[] }) {
  const [review, setReview] = useState<AiReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const cv = lines
    .filter((l) => l.kind !== "name" && l.kind !== "contact")
    .map((l) => (l.right ? `${l.t} | ${l.right}` : l.t))
    .join("\n");
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border px-[18px] py-4 text-tx" style={{ borderColor: "rgba(147,224,192,.4)", background: "rgba(147,224,192,.06)" }}>
      <span className={EYEBROW}>Free AI review</span>
      {!review && (
        <>
          <span className="text-[13px] leading-[1.45] text-tx2">
            An AI reads your CV against this advert like a recruiter: how likely an interview is, what to fix first, and stronger versions of your bullets. Sent to Google
            Gemini without your name or contact details.
          </span>
          <button
            type="button"
            disabled={busy || !job.jd.trim()}
            onClick={() =>
              startBusy(async () => {
                setError(null);
                const r = await aiReview({ cv, jd: job.jd, title: job.title, company: job.company });
                if ("error" in r) setError(r.error === "off" ? "The AI review isn't switched on yet." : r.error);
                else setReview(r);
              })
            }
            className="h-11 cursor-pointer rounded-[10px] bg-[#9FE6C8] text-[13px] font-semibold text-[#06140E] disabled:opacity-50"
          >
            {busy ? "Reading your CV…" : job.jd.trim() ? "Review my CV for this job" : "Add the advert first"}
          </button>
        </>
      )}
      {error && <span className="text-[13px] text-t-rose">{error}</span>}
      {review && (
        <div className="flex flex-col gap-3 text-[13px] leading-[1.45]">
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] leading-none" style={{ fontFamily: SERIF, color: scoreColour(review.fit) }}>
              {review.fit}
            </span>
            <span className="text-tx3">interview chance (AI estimate)</span>
          </div>
          <span className="text-tx2">{review.verdict}</span>
          {review.strengths.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-tx">Working well</span>
              {review.strengths.map((t) => (
                <span key={t} className="text-tx2">
                  · {t}
                </span>
              ))}
            </div>
          )}
          {review.fixes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-tx">Fix first</span>
              {review.fixes.map((f) => (
                <span key={f.problem} className="flex flex-col gap-0.5">
                  <span className="text-tx">{f.problem}</span>
                  <span className="text-tx2">{f.fix}</span>
                  {f.example && <span className="text-tx3">e.g. &ldquo;{f.example}&rdquo;</span>}
                </span>
              ))}
            </div>
          )}
          {review.rewrites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-tx">Stronger bullets (copy the ones that are true)</span>
              {review.rewrites.map((r) => (
                <span key={r.before} className="flex flex-col gap-0.5 rounded-[9px] border border-line2 px-2.5 py-2">
                  <span className="text-tx3 line-through decoration-[rgba(255,255,255,.25)]">{r.before}</span>
                  <span className="text-tx">{r.after}</span>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(r.after).catch(() => {})} className="self-start text-[12px] font-medium text-t-sky hover:text-tx">
                    Copy
                  </button>
                </span>
              ))}
            </div>
          )}
          {review.missing.length > 0 && <span className="text-tx2">Missing for this advert: {review.missing.join(", ")}.</span>}
          <button type="button" onClick={() => setReview(null)} className="self-start text-[12px] font-medium text-t-sky hover:text-tx">
            Review again after changes
          </button>
          <span className="text-[12px] text-tx3">AI can be wrong: keep only what&apos;s true about you.</span>
        </div>
      )}
    </div>
  );
}

/** Before anything: a big, plain invitation to look at the example CV first. */
function ExampleBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full max-w-[820px] cursor-pointer flex-wrap items-center gap-4 rounded-2xl border-2 px-6 py-5 text-left text-tx"
      style={{ borderColor: "#8FC7FF", background: "rgba(143,199,255,.1)" }}
    >
      <span className="text-[34px] leading-none">👀</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[22px] font-semibold leading-tight sm:text-[26px]">Never made a CV? Look at this first</span>
        <span className="text-[15px] text-tx2">A real-looking student CV with notes on every part. One minute, and you&apos;ll know what yours should look like.</span>
      </span>
      <span className="flex h-12 items-center rounded-xl bg-[#8FC7FF] px-6 text-[16px] font-semibold text-[#06111D]">Show me the example</span>
    </button>
  );
}

/** "Make it better with Claude": big steps, no download needed (the CV text goes in the prompt). */
function PolishModal({ job, lines, fixes, onEdit, onClose }: { job: CvJob; lines: Line[]; fixes: string[]; onEdit: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [attach, setAttach] = useState(false);
  const prompt = tailorPrompt(lines, job.jd, job.title, job.company, fixes);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
  };
  const step = "grid size-10 shrink-0 place-items-center rounded-full bg-[#C3B5FF] text-[18px] font-bold text-[#120B2A]";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(6,9,14,.82)] px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto flex max-w-[620px] flex-col gap-6 rounded-3xl border border-line bg-s1 p-6 text-tx sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[28px] font-semibold leading-tight sm:text-[32px]">Make your CV much better with Claude ✨</span>
            <span className="text-[16px] text-tx2">Free. Takes 2 minutes. Claude rewrites your CV for this exact job.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-line2 text-[20px] text-tx2 hover:text-tx">
            ×
          </button>
        </div>

        <div className="flex gap-4">
          <span className={step}>1</span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="text-[19px] font-semibold">Press this button</span>
            <span className="text-[15px] text-tx2">It copies your CV and this job together (without your name, phone or email).</span>
            <button
              type="button"
              onClick={() => copy(prompt)}
              className="h-14 cursor-pointer rounded-2xl text-[18px] font-semibold"
              style={copied ? { background: "#9FE6C8", color: "#06140E" } : { background: "#C3B5FF", color: "#120B2A" }}
            >
              {copied ? "Copied ✓" : "Copy my CV + this job"}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <span className={step}>2</span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="text-[19px] font-semibold">Open Claude</span>
            <span className="text-[15px] text-tx2">Sign in with Google if it asks. It&apos;s free.</span>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={encodeURIComponent(prompt).length < 6000 ? `https://claude.ai/new?q=${encodeURIComponent(prompt)}` : "https://claude.ai/new"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => copy(prompt)}
                className="flex h-14 items-center justify-center rounded-2xl bg-[#F5F8FC] text-[18px] font-semibold !text-[#120B2A]"
              >
                Open Claude ↗
              </a>
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => copy(prompt)}
                className="flex h-14 items-center justify-center rounded-2xl border-2 border-line2 text-[18px] font-semibold !text-tx"
              >
                or Gemini ↗
              </a>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <span className={step}>3</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[19px] font-semibold">Paste and press send</span>
            <span className="text-[15px] leading-normal text-tx2">
              Click in the message box and press <b className="text-tx">Ctrl + V</b>. On a phone: hold your finger in the box and tap <b className="text-tx">Paste</b>. Then press
              the send arrow. (If the box already has the text in it, just press send.)
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <span className={step}>4</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[19px] font-semibold">Bring the good bits back</span>
            <span className="text-[15px] leading-normal text-tx2">
              Copy the new bullet points you like into your CV, and swap any <b className="text-tx">[X]</b> for your real number. Only keep what&apos;s true: they&apos;ll ask you
              about every line in the interview.
            </span>
            <button type="button" onClick={onEdit} className="mt-1 h-12 cursor-pointer self-start rounded-xl border-2 border-line2 px-5 text-[16px] font-semibold text-tx hover:border-l-sky">
              Edit my CV now
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <button type="button" onClick={() => setAttach((a) => !a)} className="cursor-pointer self-start text-[14px] font-medium text-t-sky hover:text-tx">
            {attach ? "Hide" : "Rather attach your CV file instead?"}
          </button>
          {attach && (
            <span className="text-[14px] leading-normal text-tx2">
              Download it (Word or PDF, on the check page), start a new chat, attach the file with the paperclip or +, then{" "}
              <button type="button" onClick={() => copy(attachPrompt(job.jd, job.title, job.company, fixes))} className="font-medium text-t-sky hover:text-tx">
                copy this shorter prompt
              </button>{" "}
              and paste it with the file.
            </span>
          )}
          <button type="button" onClick={onClose} className="cursor-pointer self-start text-[14px] text-tx3 hover:text-tx">
            Maybe later (it&apos;s always at the top of the check page)
          </button>
        </div>
      </div>
    </div>
  );
}
