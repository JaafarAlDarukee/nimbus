/** What the browser needs about opportunities (kept apart from the scoring, which pulls in the
 * whole company directory and only runs on the server). */

export type Tone = "sky" | "lil" | "dawn" | "mint" | "teal" | "rose";

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
  match: number;
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
  { label: "Conference", kinds: ["event"], title: "not-hack" },
  { label: "Graduate", kinds: ["grad_scheme", "graduate_job"] },
  { label: "Apprenticeship", kinds: ["apprenticeship"] },
  { label: "Research", kinds: ["research", "scholarship"] },
];
