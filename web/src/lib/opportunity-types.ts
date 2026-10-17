/** What the browser needs about opportunities (kept apart from the scoring, which pulls in the
 * whole company directory and only runs on the server). */

export type Tone = "sky" | "lil" | "dawn" | "mint" | "teal" | "rose";

/** How well a role fits, worked out from facts only (owner, 17 Oct: no made-up % score). */
export type Fit = "top" | "good" | "look";
export const FIT_LABEL: Record<Fit, string> = { top: "Top match", good: "Good match", look: "Worth a look" };
export const FIT_TONE: Record<Fit, Tone> = { top: "mint", good: "sky", look: "dawn" };

/** What a card and the detail drawer show. */
export type OpportunityView = {
  id: string;
  title: string;
  company: string;
  initial: string;
  logo: string | null;
  loc: string;
  type: string;
  tone: Tone;
  found: string;
  isNew: boolean;
  /** null when it isn't one of your subjects (the All tab) */
  fit: Fit | null;
  /** The facts behind the fit: "Mechanical in the title", "Placement", "Automotive", "CAD, MATLAB on your CV" */
  ticks: string[];
  why: string[];
  deadline: string;
  /** "closes 24 Oct", "rolling" or "" (phone cards) */
  closing: string;
  source: string;
  applyUrl: string;
  contact: string;
  contactNote: string;
  advert: string;
  /** Found on a job board rather than the employer's own site ("Adzuna") */
  via: string | null;
};

/** The type chips on the page, in the design's order, and which radar kinds each one covers. */
export const TYPE_CHIPS: { label: string; kinds: string[]; title?: "hack" | "not-hack" }[] = [
  { label: "All types", kinds: [] },
  { label: "Placement", kinds: ["placement"] },
  { label: "Internship", kinds: ["internship"] },
  { label: "Spring week", kinds: ["spring_week", "insight"] },
  { label: "Hackathon", kinds: ["event"], title: "hack" },
  { label: "Events", kinds: ["event"], title: "not-hack" },
  { label: "Graduate", kinds: ["grad_scheme", "graduate_job"] },
  { label: "Apprenticeship", kinds: ["apprenticeship"] },
  { label: "Research", kinds: ["research", "scholarship"] },
];
