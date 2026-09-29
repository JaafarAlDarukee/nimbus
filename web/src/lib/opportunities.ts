export type Opportunity = {
  id: string;
  title: string;
  company_name: string;
  kind: string;
  disciplines: string[];
  skills: string[];
  location_text: string | null;
  country: string | null;
  apply_url: string;
  posted_at: string | null;
  first_seen_at: string;
  closes_at: string | null;
  rolling: boolean | null;
  source_kind: string | null;
};

export const OPPORTUNITY_COLUMNS =
  "id,title,company_name,kind,disciplines,skills,location_text,country,apply_url,posted_at,first_seen_at,closes_at,rolling,source_kind";

/** Filter chips for the kind of opportunity; `kinds` are the database values each chip covers. */
export const KIND_FILTERS: { value: string; label: string; kinds: string[] }[] = [
  { value: "placement", label: "Placements", kinds: ["placement"] },
  { value: "internship", label: "Internships", kinds: ["internship"] },
  { value: "graduate", label: "Graduate", kinds: ["grad_scheme", "graduate_job"] },
  { value: "insight", label: "Insight & spring weeks", kinds: ["insight", "spring_week"] },
  { value: "apprenticeship", label: "Apprenticeships", kinds: ["apprenticeship"] },
  { value: "research", label: "Research", kinds: ["research", "scholarship"] },
];

export const DISCIPLINE_FILTERS: { value: string; label: string }[] = [
  { value: "mechanical", label: "Mechanical" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "robotics", label: "Robotics" },
  { value: "electrical", label: "Electrical" },
  { value: "aerospace", label: "Aerospace" },
  { value: "automotive", label: "Automotive" },
  { value: "materials", label: "Materials" },
  { value: "civil", label: "Civil" },
  { value: "chemical", label: "Chemical" },
  { value: "software", label: "Software" },
  { value: "business", label: "Business" },
];

export const WHERE_FILTERS: { value: string; label: string }[] = [
  { value: "uk", label: "UK" },
  { value: "abroad", label: "Abroad" },
  { value: "all", label: "Everywhere" },
];

export const KIND_LABELS: Record<string, string> = {
  placement: "Placement",
  internship: "Internship",
  spring_week: "Spring week",
  insight: "Insight",
  grad_scheme: "Grad scheme",
  graduate_job: "Graduate",
  research: "Research",
  apprenticeship: "Apprenticeship",
  scholarship: "Scholarship",
  event: "Event",
  speculative: "Speculative",
  other: "Opportunity",
  unknown: "Opportunity",
};

/** Soft, distinct tints per kind (calm, not loud). */
export const KIND_STYLES: Record<string, string> = {
  placement: "bg-sky-400/12 text-sky-300 ring-sky-400/20",
  internship: "bg-violet-400/12 text-violet-300 ring-violet-400/20",
  spring_week: "bg-amber-300/12 text-amber-200 ring-amber-300/20",
  insight: "bg-amber-300/12 text-amber-200 ring-amber-300/20",
  grad_scheme: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/20",
  graduate_job: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/20",
  research: "bg-rose-300/12 text-rose-200 ring-rose-300/20",
  scholarship: "bg-rose-300/12 text-rose-200 ring-rose-300/20",
  apprenticeship: "bg-teal-300/12 text-teal-200 ring-teal-300/20",
};

export const DISCIPLINE_LABELS: Record<string, string> = Object.fromEntries(
  DISCIPLINE_FILTERS.map((d) => [d.value, d.label]),
);
