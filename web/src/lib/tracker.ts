/** The tracker's six stage groups (design order and colours) and how database stages fall into them. */
export const STAGE_GROUPS = [
  { name: "Saved", tone: "cloud", stages: ["saved", "speculative"], main: "saved" },
  { name: "Applied", tone: "sky", stages: ["applied"], main: "applied" },
  { name: "Online test", tone: "lil", stages: ["online_test", "video_interview"], main: "online_test" },
  { name: "Interview", tone: "dawn", stages: ["interview", "assessment_centre"], main: "interview" },
  { name: "Offer", tone: "mint", stages: ["offer", "accepted"], main: "offer" },
  { name: "Closed", tone: "rose", stages: ["rejected", "ghosted", "withdrawn", "declined"], main: "rejected" },
] as const;

export type GroupName = (typeof STAGE_GROUPS)[number]["name"];

export const groupOf = (stage: string) => STAGE_GROUPS.find((g) => (g.stages as readonly string[]).includes(stage)) ?? STAGE_GROUPS[0];

/** Clicking a stage tag moves the row to the next group (Closed goes back to Saved). */
export function nextStage(stage: string): string {
  const i = STAGE_GROUPS.indexOf(groupOf(stage));
  return STAGE_GROUPS[(i + 1) % STAGE_GROUPS.length].main;
}

export const mainStageOf = (group: string) => STAGE_GROUPS.find((g) => g.name === group)?.main ?? "applied";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "12 Oct", "12 October", "12/10", "2026-10-12" or "today" / "tomorrow" → YYYY-MM-DD (the next such date). */
export function parseDue(text: string, now = new Date()): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (t === "today") return iso(now);
  if (t === "tomorrow") return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(new Date(+m[1], +m[2] - 1, +m[3]));
  let day: number | undefined;
  let month: number | undefined;
  if ((m = t.match(/^(\d{1,2})\s*([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?$/))) {
    day = +m[1];
    month = MONTHS.indexOf(m[2]);
    if (m[3]) return month >= 0 ? iso(new Date(+m[3], month, day)) : null;
  } else if ((m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/))) {
    day = +m[1];
    month = +m[2] - 1;
    if (m[3]) return iso(new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], month, day));
  }
  if (day === undefined || month === undefined || month < 0 || month > 11 || day < 1 || day > 31) return null;
  const thisYear = new Date(now.getFullYear(), month, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return iso(thisYear < today ? new Date(now.getFullYear() + 1, month, day) : thisYear);
}

/** Every stage you can pick, in order, with its label (the tag colour comes from its group). */
export const STAGE_OPTIONS: { stage: string; label: string }[] = [
  { stage: "saved", label: "Saved" },
  { stage: "speculative", label: "Speculative" },
  { stage: "applied", label: "Applied" },
  { stage: "online_test", label: "Online test" },
  { stage: "video_interview", label: "Video interview" },
  { stage: "interview", label: "Interview" },
  { stage: "assessment_centre", label: "Assessment centre" },
  { stage: "offer", label: "Offer" },
  { stage: "accepted", label: "Accepted" },
  { stage: "rejected", label: "Rejected" },
  { stage: "ghosted", label: "Ghosted" },
  { stage: "withdrawn", label: "Withdrawn" },
  { stage: "declined", label: "Declined" },
];

export const stageLabel = (stage: string) => STAGE_OPTIONS.find((o) => o.stage === stage)?.label ?? groupOf(stage).name;
