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

/** Which of the radar's discipline tags each degree cares about. Degrees without tags yet
 *  (most science and medical courses) don't narrow by discipline. */
const DEGREE_DISCIPLINES: Record<string, string[]> = {
  "Mechanical Engineering": ["mechanical", "manufacturing", "robotics", "aerospace", "automotive", "materials"],
  "Electrical Engineering": ["electrical", "robotics"],
  "Chemical Engineering": ["chemical", "manufacturing", "materials"],
  "Biomedical Engineering": ["mechanical", "electrical", "materials"],
  "Materials Science": ["materials"],
  Chemistry: ["chemical"],
  Physics: ["electrical", "materials"],
  Mathematics: ["software"],
};

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
  const disciplines = [...new Set(p.degrees.flatMap((d) => DEGREE_DISCIPLINES[d] ?? []))];

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
export function applyMatch<Q extends { in: (c: string, v: string[]) => Q; overlaps: (c: string, v: string[]) => Q }>(
  query: Q,
  filters: MatchFilters,
): Q {
  let q = query;
  if (filters.kinds.length) q = q.in("kind", filters.kinds);
  if (filters.disciplines.length) q = q.overlaps("disciplines", filters.disciplines);
  if (filters.countries) q = q.in("country", filters.countries);
  return q;
}
