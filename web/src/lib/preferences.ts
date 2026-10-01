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
};

export function withDefaults(stored: unknown): Preferences {
  const value = (stored && typeof stored === "object" ? stored : {}) as Partial<Preferences>;
  return { ...DEFAULT_PREFERENCES, ...value, extra: { ...DEFAULT_PREFERENCES.extra, ...(value.extra ?? {}) } };
}

/** Which of the radar's discipline tags (radar/pipeline/classify.py) each degree cares about.
 *  radar/match.py reads this object and FIELD_DISCIPLINES straight from this file, so the
 *  Telegram alerts follow the same rules: keep every key quoted and every value on one line. */
export const DEGREE_DISCIPLINES: Record<string, string[]> = {
  "Mechanical Engineering": ["mechanical", "manufacturing", "robotics", "aerospace", "automotive", "materials"],
  "Electrical Engineering": ["electrical", "robotics"],
  "Chemical Engineering": ["chemical", "manufacturing", "materials"],
  "Biomedical Engineering": ["biomedical", "mechanical", "electrical", "materials"],
  "Biomedical Science": ["biomedical", "life_sciences", "healthcare"],
  "Biochemistry": ["life_sciences", "chemical"],
  "Marine Biology": ["environmental", "life_sciences"],
  "Biology": ["life_sciences", "environmental"],
  "Chemistry": ["chemical", "materials", "life_sciences"],
  "Physics": ["electrical", "materials", "software"],
  "Microbiology": ["life_sciences"],
  "Genetics": ["life_sciences"],
  "Neuroscience": ["life_sciences", "healthcare"],
  "Pharmacology": ["life_sciences", "healthcare"],
  "Biotechnology": ["life_sciences", "chemical"],
  "Zoology": ["life_sciences", "environmental"],
  "Ecology and Conservation": ["environmental"],
  "Environmental Science": ["environmental"],
  "Oceanography": ["environmental"],
  "Geology and Earth Sciences": ["environmental", "civil"],
  "Forensic Science": ["life_sciences", "chemical"],
  "Food Science and Nutrition": ["life_sciences", "healthcare"],
  "Materials Science": ["materials"],
  "Mathematics": ["software", "business"],
  "Sport and Exercise Science": ["healthcare", "life_sciences"],
  "Psychology": ["healthcare"],
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
  "Biomedical Science (IBMS accredited)": ["biomedical", "life_sciences", "healthcare"],
};

/** For a degree typed in by hand (not in the lists): go by the field instead. */
export const FIELD_DISCIPLINES: Record<string, string[]> = {
  "Engineering": ["mechanical", "manufacturing", "robotics", "aerospace", "automotive", "materials", "electrical", "chemical", "civil"],
  "Science": ["life_sciences", "environmental", "chemical", "biomedical"],
  "Medical and health": ["healthcare", "biomedical", "life_sciences"],
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
  "Networking event": ["event"],
  "Summer school": ["event"],
  "Mentoring programme": ["event"],
};

const COUNTRY_CODES: Record<string, string> = {
  Ireland: "IE", Germany: "DE", Netherlands: "NL", Belgium: "BE", Luxembourg: "LU", France: "FR", Switzerland: "CH",
  Austria: "AT", Italy: "IT", Spain: "ES", Portugal: "PT", Denmark: "DK", Sweden: "SE", Norway: "NO", Finland: "FI",
  Poland: "PL", Czechia: "CZ", Turkey: "TR", USA: "US", Canada: "CA", Mexico: "MX", Brazil: "BR", UAE: "AE",
  Qatar: "QA", "Saudi Arabia": "SA", Kuwait: "KW", Oman: "OM", Bahrain: "BH", Egypt: "EG", "South Africa": "ZA",
  India: "IN", China: "CN", "Hong Kong": "HK", Taiwan: "TW", "South Korea": "KR", Japan: "JP", Singapore: "SG",
  Malaysia: "MY", Australia: "AU", "New Zealand": "NZ",
};

const EUROPE = ["IE", "DE", "NL", "BE", "LU", "FR", "CH", "AT", "IT", "ES", "PT", "DK", "SE", "NO", "FI", "PL", "CZ", "GR", "HU", "RO"];

export type MatchFilters = {
  kinds: string[];
  disciplines: string[];
  /** null = anywhere in the world */
  countries: string[] | null;
};

export function matchFilters(p: Preferences): MatchFilters {
  const kinds = [...new Set(p.types.flatMap((t) => TYPE_KINDS[t] ?? []))];
  const disciplines = disciplinesFor(p);

  let countries: string[] | null = [];
  if (p.abroad.includes("Worldwide")) {
    countries = null;
  } else {
    if (p.uk.length) countries.push("GB");
    if (p.abroad.includes("Anywhere in Europe")) countries.push(...EUROPE);
    for (const place of p.abroad) if (COUNTRY_CODES[place]) countries.push(COUNTRY_CODES[place]);
    countries = countries.length ? [...new Set(countries)] : ["GB"];
  }
  return { kinds, disciplines, countries };
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
