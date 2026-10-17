import { DEFAULT_TYPES } from "@/lib/onboarding-data";

/** Everything a user picks in onboarding / Profile, stored in profiles.preferences. */
export type Preferences = {
  field: string;
  degrees: string[];
  year: string;
  sectors: string[];
  sectorsAll: boolean;
  types: string[];
  uk: string[];
  abroad: string[];
  extra: { deg: string[]; sec: string[]; types: string[]; abroad: string[] };
  cvPath: string | null;
  cvName: string | null;
  emailDigest: boolean;
  /** Companies muted on the Companies page: kept out of For you */
  muted: string[];
  /** Sign-up answers: how many applications this season, and how they heard about Nimbus */
  applications: string;
  heardFrom: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  field: "Engineering",
  degrees: ["Mechanical Engineering"],
  year: "2nd year",
  sectors: [],
  sectorsAll: false,
  types: DEFAULT_TYPES,
  uk: ["Anywhere in the UK"],
  abroad: [],
  extra: { deg: [], sec: [], types: [], abroad: [] },
  cvPath: null,
  cvName: null,
  emailDigest: true,
  muted: [],
  applications: "",
  heardFrom: "",
};

export function withDefaults(stored: unknown): Preferences {
  const value = (stored && typeof stored === "object" ? stored : {}) as Partial<Preferences>;
  return { ...DEFAULT_PREFERENCES, ...value, extra: { ...DEFAULT_PREFERENCES.extra, ...(value.extra ?? {}) } };
}

/** Which of the radar's discipline tags (radar/pipeline/classify.py) each degree cares about.
 *  radar/match.py reads this object and FIELD_DISCIPLINES straight from this file, so the
 *  Telegram alerts follow the same rules: keep every key quoted and every value on one line. */
export const DEGREE_DISCIPLINES: Record<string, string[]> = {
  "Mechanical Engineering": ["mechanical", "manufacturing", "robotics", "aerospace", "automotive", "materials", "engineering"],
  "Electrical Engineering": ["electrical", "robotics", "engineering"],
  "Electronic Engineering": ["electrical", "robotics", "software", "engineering"],
  "Aerospace Engineering": ["aerospace", "mechanical", "materials", "manufacturing", "engineering"],
  "Civil Engineering": ["civil", "environmental", "engineering"],
  "Mechatronics and Robotics": ["robotics", "electrical", "mechanical", "software", "engineering"],
  "Automotive Engineering": ["automotive", "mechanical", "manufacturing", "electrical", "engineering"],
  "Manufacturing Engineering": ["manufacturing", "mechanical", "materials", "robotics", "engineering"],
  "Materials Engineering": ["materials", "chemical", "manufacturing", "engineering"],
  "General Engineering": ["mechanical", "electrical", "manufacturing", "civil", "chemical", "robotics", "aerospace", "automotive", "materials", "engineering"],
  "Chemical Engineering": ["chemical", "manufacturing", "materials", "engineering"],
  "Biomedical Engineering": ["biomedical", "mechanical", "electrical", "materials", "engineering"],
  "Biomedical Science": ["biomedical", "life_sciences", "healthcare", "science"],
  "Biochemistry": ["life_sciences", "chemical", "science"],
  "Marine Biology": ["environmental", "life_sciences", "science"],
  "Biology": ["life_sciences", "environmental", "science"],
  "Chemistry": ["chemical", "materials", "life_sciences", "science"],
  "Physics": ["electrical", "materials", "software", "engineering", "science"],
  "Microbiology": ["life_sciences", "science"],
  "Genetics": ["life_sciences", "science"],
  "Neuroscience": ["life_sciences", "healthcare", "science"],
  "Pharmacology": ["life_sciences", "healthcare", "science"],
  "Biotechnology": ["life_sciences", "chemical", "science"],
  "Zoology": ["life_sciences", "environmental", "science"],
  "Ecology and Conservation": ["environmental", "science"],
  "Environmental Science": ["environmental", "science"],
  "Oceanography": ["environmental", "science"],
  "Geology and Earth Sciences": ["environmental", "civil", "science"],
  "Forensic Science": ["life_sciences", "chemical", "science"],
  "Food Science and Nutrition": ["life_sciences", "healthcare", "science"],
  "Materials Science": ["materials", "engineering", "science"],
  "Mathematics": ["software", "business"],
  "Sport and Exercise Science": ["healthcare", "life_sciences"],
  "Psychology": ["healthcare"],
  "Computer Science": ["software"],
  "Software Engineering": ["software"],
  "Artificial Intelligence and Machine Learning": ["software"],
  "Data Science": ["software"],
  "Cyber Security": ["software"],
  "Computer Engineering": ["software", "electrical", "engineering"],
  "Information Technology": ["software"],
  "Games Development": ["software"],
  "Medicine": ["healthcare", "life_sciences"],
  "Pharmacy": ["healthcare", "life_sciences"],
  "Nursing": ["healthcare"],
  "Midwifery": ["healthcare"],
  "Dentistry": ["healthcare"],
  "Physiotherapy": ["healthcare"],
  "Paramedic Science": ["healthcare"],
  "Radiography": ["healthcare", "biomedical"],
  "Occupational Therapy": ["healthcare"],
  "Optometry": ["healthcare"],
  "Nutrition and Dietetics": ["healthcare"],
  "Speech and Language Therapy": ["healthcare"],
  "Healthcare Science": ["healthcare", "biomedical"],
  "Operating Department Practice": ["healthcare"],
  "Veterinary Medicine": ["healthcare", "life_sciences"],
  "Biomedical Science (IBMS accredited)": ["biomedical", "life_sciences", "healthcare", "science"],
};

/** For a degree typed in by hand (not in the lists): go by the field instead. */
export const FIELD_DISCIPLINES: Record<string, string[]> = {
  "Engineering": ["mechanical", "manufacturing", "robotics", "aerospace", "automotive", "materials", "electrical", "chemical", "civil", "engineering"],
  "Science": ["life_sciences", "environmental", "chemical", "biomedical", "science"],
  "Medical and health": ["healthcare", "biomedical", "life_sciences"],
  "Computing": ["software"],
};

function disciplinesFor(p: Pick<Preferences, "degrees" | "field">): string[] {
  const known = p.degrees.flatMap((d) => DEGREE_DISCIPLINES[d] ?? []);
  const unknown = p.degrees.some((d) => !DEGREE_DISCIPLINES[d]);
  return [...new Set([...known, ...(unknown || !p.degrees.length ? (FIELD_DISCIPLINES[p.field] ?? []) : [])])];
}

/** Opportunity types (as the user sees them) to the radar's kinds. */
const TYPE_KINDS: Record<string, string[]> = {
  Placement: ["placement"],
  "Summer internship": ["internship"],
  "Spring week": ["spring_week"],
  "Insight day": ["insight"],
  "Work experience week": ["insight"],
  "Virtual work experience": ["insight"],
  "Graduate scheme": ["grad_scheme", "graduate_job"],
  "Degree apprenticeship": ["apprenticeship"],
  Apprenticeship: ["apprenticeship"],
  "Research internship": ["research"],
  "Lab placement": ["research", "placement"],
  "Funded PhD or Masters": ["research"],
  "Scholarship or bursary": ["scholarship"],
  Hackathon: ["event"],
  Competition: ["event"],
  Conference: ["event"],
  "Expo or careers fair": ["event"],
  "Networking event": ["event"],
  "Summer school": ["event"],
  "Mentoring programme": ["event"],
  "Clinical shadowing": ["insight"],
  Fieldwork: ["research"],
};

/** Where Nimbus looks: the UK and Ireland (owner, 17 Oct: "remove all the countries, just keep the UK and Ireland"). */
export const COVERED_COUNTRIES = ["GB", "IE"] as const;

/** Every student opportunity type. For you and personal alerts show them all, grouped by type,
 *  whatever the user ticked (owner, 17 Oct: "I want to show everything, not hide"). */
export const STUDENT_KINDS = [...new Set(Object.values(TYPE_KINDS).flat())];

/** The main Telegram channel posts computing and science roles too (radar/notify/telegram.py
 *  ENGINEERING): engineering students get everything it posts (owner, 17 Oct). */
const CHANNEL_EXTRA: Record<string, string[]> = { Engineering: ["software", "science"] };

/** The subjects of the user's own degree(s): "Mechanical in the title" ticks. */
export function degreeDisciplines(p: Pick<Preferences, "degrees" | "field">): string[] {
  return disciplinesFor(p);
}

export type MatchFilters = {
  kinds: string[];
  disciplines: string[];
  /** null = anywhere in the world */
  countries: string[] | null;
};

export function matchFilters(p: Preferences): MatchFilters {
  // Every type, and every subject in the user's field (a Mechanical student sees Chemical roles too)
  const kinds = STUDENT_KINDS;
  const disciplines = [...new Set([...disciplinesFor(p), ...(FIELD_DISCIPLINES[p.field] ?? []), ...(CHANNEL_EXTRA[p.field] ?? [])])];

  // Nimbus covers the UK and Ireland only (owner, 17 Oct); places picked before then are ignored
  return { kinds, disciplines, countries: [...COVERED_COUNTRIES] };
}

/** Anything with .in / .overlaps (a Supabase query) gets the user's filters applied. */
export function applyMatch<Q extends { in: (c: string, v: string[]) => Q; or: (filters: string) => Q }>(
  query: Q,
  filters: MatchFilters,
): Q {
  let q = query;
  if (filters.kinds.length) q = q.in("kind", filters.kinds);
  // Events with no subject (most hackathons) are for everyone; a lab expo or a medtech
  // conference only for the degrees it fits. Online events aren't tied to a country.
  if (filters.disciplines.length)
    q = q.or(`disciplines.ov.{${filters.disciplines.join(",")}},and(kind.eq.event,disciplines.eq.{})`);
  if (filters.countries) q = q.or(`country.in.(${filters.countries.join(",")}),and(kind.eq.event,remote.is.true)`);
  return q;
}
