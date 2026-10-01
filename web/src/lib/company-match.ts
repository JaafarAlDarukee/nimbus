/** Matching directory names ("Toyota UK") to the names the radar saves ("Toyota Motor Manufacturing (UK) Ltd"). */

const NOISE = /\b(the|uk|u\.k\.|ltd|limited|plc|llp|inc|group|holdings|gmbh|co|company)\b/g;

export function normaliseCompany(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Directory names whose jobs the radar saves under another name. */
const ALIASES: Record<string, string[]> = {
  "Jaguar Land Rover": ["JLR"],
  "Red Bull Racing": ["Red Bull", "RedBull"],
  GSK: ["GlaxoSmithKline"],
  "Ocado Technology": ["Ocado Group"],
  "Alpine F1 Team": ["Alpine Racing"],
  "Toyota UK": ["Toyota Motor Manufacturing"],
  "Caterpillar UK": ["Caterpillar"],
  "Unilever Beauty & Wellbeing": ["Unilever"],
  "Abbott Diabetes Care": ["Abbott"],
  "Rolls-Royce": ["Rolls-Royce plc"],
};

/** Radar names that belong to a directory company: the same name (or a known alias), or it followed by more words. */
export function radarNamesFor(directoryName: string, radarNames: { name: string; norm: string }[]): string[] {
  const keys = [directoryName, ...(ALIASES[directoryName] ?? [])]
    .map((n) => normaliseCompany(n.replace(/\(.*?\)/g, "")))
    .filter((n) => n.length >= 3);
  return radarNames.filter((r) => keys.some((k) => r.norm === k || r.norm.startsWith(`${k} `))).map((r) => r.name);
}
