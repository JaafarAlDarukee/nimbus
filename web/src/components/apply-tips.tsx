"use client";

import { useState } from "react";

/** LinkedIn people searches worth doing before applying to a role (opened by the student). */
export function peopleToFind(company: string, title: string, uni?: string): { label: string; url: string; why: string }[] {
  const placement = /placement|year in industry|industrial/i.test(title);
  const kind = placement ? "placement" : /intern/i.test(title) ? "intern" : "graduate";
  const field = /mechanical|electrical|electronic|chemical|civil|aerospace|biomedical|software|manufacturing|materials|process|design/i.exec(title)?.[0].toLowerCase();
  const url = (q: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
  return [
    { label: placement ? "Placement students there now" : "Interns and graduates there now", url: url(`${company} ${kind}`), why: "They got in recently: the best people to ask what the process is really like." },
    { label: "The early careers team", url: url(`${company} early careers`), why: "The people who run the scheme. Follow the company page too." },
    { label: field ? `${field[0].toUpperCase()}${field.slice(1)} engineers there` : "Engineers in the team", url: url(`${company} ${field ? `${field} engineer` : "engineer"}`), why: "The team you'd join. One good chat beats ten cold applications." },
    ...(uni ? [{ label: `People from ${uni} there`, url: url(`${company} ${uni}`), why: "Alumni reply far more often. Mention your uni in the first line." }] : []),
  ];
}

/**
 * "Before you apply": who to find on LinkedIn at this company, a short note to send, and a profile
 * checklist. Nimbus never messages anyone: the student opens LinkedIn and sends it themselves.
 */
/** "BEng (Hons) Mechanical Engineering (with Foundation Year)" → "Mechanical Engineering". */
export function shortDegree(degree = ""): string {
  return degree
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(BEng|MEng|BSc|MSc|MChem|MPhys|MSci|BA|MA|Hons|Integrated Masters?|with .*$)\b\.?/gi, " ")
    .replace(/[,|–-]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A company name worth searching for (not "a", "x" or "g"). */
const realName = (s: string) => /[a-z]{2,}/i.test(s) && s.trim().length >= 3;

export function ApplyTips({ company, title, degree, uni, skills = [] }: { company: string; title: string; degree?: string; uni?: string; skills?: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const placement = /placement|year in industry|industrial/i.test(title);
  const kind = placement ? "placement" : /intern/i.test(title) ? "intern" : "graduate";
  const subject = shortDegree(degree);
  const me = `${subject ? `${subject} student` : "student"}${uni ? ` at ${uni}` : ""}`;
  const role = realName(title) ? title.trim() : placement ? "placement" : "role";
  const top = skills.slice(0, 3);
  const known = realName(company);

  const people = known ? peopleToFind(company, title, uni) : [];

  const notes = [
    {
      key: "student",
      to: placement ? "To a placement student" : "To a recent intern or graduate",
      text: `Hi [name], I'm a ${me} applying for the ${role} at ${known ? company : "[company]"}. I saw you ${placement ? "did a placement" : "work"} there and would really value 10 minutes to hear what it's like. Thanks!`,
    },
    {
      key: "team",
      to: "To someone in the team or early careers",
      text: `Hi [name], I'm a ${me} applying for the ${role} at ${known ? company : "[company]"}${top.length ? `. I've been building experience in ${top.slice(0, 2).join(" and ")}` : ""}, and I'd love to learn what makes someone do well in your team. Thank you!`,
    },
  ];
  const headline = [
    subject ? `${subject} student${uni ? ` at ${uni}` : ""}` : "Engineering student",
    `Seeking ${placement ? "a placement" : kind === "intern" ? "an internship" : "a graduate role"}`,
    top.join(" · "),
  ]
    .filter(Boolean)
    .join(" | ");

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };
  const eyebrow = "text-[12px] font-semibold uppercase tracking-[.08em] text-tx3";

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-s1 px-[18px] py-4 text-tx">
      <span className={eyebrow}>Before you apply · LinkedIn</span>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{known ? `Find people at ${company}` : "Find people at the company"}</span>
        {!known && <span className="text-[13px] text-tx3">Add the company&apos;s name on step 1 and the LinkedIn searches appear here.</span>}
        {people.map((p) => (
          <a key={p.label} href={p.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-0.5 rounded-[10px] border border-line2 px-3 py-2 hover:border-l-sky">
            <span className="text-[13px] font-medium text-t-sky group-hover:text-tx">{p.label} ↗</span>
            <span className="text-[12px] leading-[1.4] text-tx3">{p.why}</span>
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">A short note to send with the request</span>
        {notes.map((n) => (
          <div key={n.key} className="flex flex-col gap-1.5 rounded-[10px] border border-line2 px-3 py-2">
            <span className="text-[12px] text-tx3">{n.to}</span>
            <span className="text-[13px] leading-[1.45] text-tx2">{n.text}</span>
            <button type="button" onClick={() => copy(n.key, n.text)} className="self-start text-[12px] font-medium text-t-sky hover:text-tx">
              {copied === n.key ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
        <span className="text-[12px] leading-[1.45] text-tx3">
          Change [name] and keep it under 300 characters. Don&apos;t ask for a job or a referral in the first message; if they reply, ask one specific question.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Your profile, 5 minutes</span>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[1.45] text-tx2">
          <li>
            Headline: <span className="text-tx">{headline}</span>{" "}
            <button type="button" onClick={() => copy("headline", headline)} className="text-[12px] font-medium text-t-sky hover:text-tx">
              {copied === "headline" ? "Copied" : "Copy"}
            </button>
          </li>
          <li>A clear photo, and a three-line About: what you study, what you&apos;ve built, what you want next.</li>
          <li>Featured: your best project, with a photo and one result (a number).</li>
          {skills.length > 0 && <li>Skills: add {skills.slice(0, 5).join(", ")} if you can back them up.</li>}
          <li>Open to work: set it to recruiters only.</li>
        </ul>
      </div>
    </div>
  );
}
