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

/** Radar names that belong to a directory company: the same name, or the name followed by more words. */
export function radarNamesFor(directoryName: string, radarNames: { name: string; norm: string }[]): string[] {
  const norm = normaliseCompany(directoryName.replace(/\(.*?\)/g, ""));
  if (norm.length < 3) return [];
  return radarNames.filter((r) => r.norm === norm || r.norm.startsWith(`${norm} `)).map((r) => r.name);
}
