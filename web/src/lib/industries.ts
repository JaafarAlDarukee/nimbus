import { COMPANIES } from "@/lib/companies-data";
import { normaliseCompany } from "@/lib/company-match";

/**
 * Does a role belong to one of the user's industries? Words in the title, company or start of the
 * advert, or the company being listed under that industry in the Companies directory.
 * Mirrored in radar/match.py for Telegram alerts: change both together.
 */
const WORDS: Record<string, RegExp> = {
  Motorsport: /\b(formula ?(1|one|e)|f1|motorsport|racing)\b/i,
  Automotive: /\b(automotive|vehicles?|powertrain|car maker)\b/i,
  "EV and batteries": /\b(batter(y|ies)|electric vehicles?|ev charging|cell chemistry)\b/i,
  "Autonomous vehicles": /\b(autonomous|self-driving|driverless)\b/i,
  Rail: /\b(rail(way)?s?|rolling stock|trains?)\b/i,
  "Civil aerospace": /\b(aerospace|aircraft|aviation|aero ?engines?|airline)\b/i,
  "Marine and shipbuilding": /\b(marine|shipbuilding|maritime|vessels?)\b/i,
  "Space and satellites": /\b(space|satellites?|launch vehicles?|rockets?|orbital)\b/i,
  Motorcycles: /\bmotorcycles?\b/i,
  "Wind and solar": /\b(wind (farm|turbine|energy)|offshore wind|solar|renewables?)\b/i,
  Hydrogen: /\b(hydrogen|fuel cells?|electroly[sz]er)\b/i,
  "Oil and gas": /\b(oil and gas|petroleum|upstream|refinery)\b/i,
  "Power grid and utilities": /\b(national grid|power networks?|utilities|electricity distribution|substations?)\b/i,
  "Energy storage": /\b(energy storage|battery storage|grid storage)\b/i,
  "Carbon capture": /\b(carbon capture|ccus?|direct air capture)\b/i,
  "Consumer products": /\b(consumer (goods|products)|fmcg|household products)\b/i,
  "Food and drink manufacturing": /\b(food|beverages?|drinks?|brewer(y|ies)|dairy)\b/i,
  "Additive manufacturing": /\b(additive manufacturing|3d printing)\b/i,
  "Composites and materials": /\b(composites?|advanced materials|polymers?)\b/i,
  "Industrial automation": /\b(industrial automation|plc|scada|factory automation)\b/i,
  Robotics: /\brobot(ic|ics|s)?\b/i,
  "Medtech and devices": /\b(medical devices?|medtech|surgical)\b/i,
  "Surgical robotics": /\bsurgical robot/i,
  Pharmaceuticals: /\b(pharma(ceutical)?s?|drug development)\b/i,
  Biotech: /\b(biotech(nology)?|biologics)\b/i,
  Construction: /\b(construction|contractor)\b/i,
  Infrastructure: /\b(infrastructure|highways|bridges|tunnels)\b/i,
  "Water and wastewater": /\b(water|wastewater)\b/i,
  Semiconductors: /\b(semiconductors?|chip design|wafer|foundry)\b/i,
  "Electronics and hardware": /\b(electronics|hardware|pcb)\b/i,
};

const DIRECTORY = Object.fromEntries(
  Object.entries(COMPANIES).map(([sector, list]) => [sector, list.map((entry) => normaliseCompany(entry.split("|")[0]))]),
);

export function industryMatch(sectors: string[], company: string, text: string): string | null {
  const name = normaliseCompany(company);
  for (const sector of sectors) {
    if (DIRECTORY[sector]?.some((c) => c.length > 2 && (name === c || name.startsWith(`${c} `)))) return sector;
    if (WORDS[sector]?.test(text)) return sector;
  }
  return null;
}
