# Website

Back to [[00 Start Here]] · code in `web/` (Next.js 16.3, React 19, Tailwind 4, shadcn base-nova)

> Next.js 16 differs from older versions: `middleware` is now `src/proxy.ts`; `cookies()`, `params`, `searchParams` are async; read `web/node_modules/next/dist/docs/` before using unfamiliar APIs (see `web/AGENTS.md`).

## Routes
| Route | File | Status |
|---|---|---|
| `/login` (Landing) | `src/app/login/page.tsx`, `login-form.tsx` | ✅ design-matched; request access flow |
| `/auth/callback` | `src/app/auth/callback/route.ts` | ✅ PKCE code exchange (same browser) |
| `/auth/confirm` | `src/app/auth/confirm/page.tsx` | ✅ handles hash tokens, token_hash, code |
| `/onboarding` | `src/app/onboarding/page.tsx`, `onboarding-flow.tsx` | ✅ 10 steps, saves to `profiles` |
| `/` Opportunities | `src/app/(app)/page.tsx` (data) + `src/components/opportunity-feed.tsx` (UI) + `src/lib/opportunity-view.ts` (row → card, match score, why) | ✅ design-matched |
| `/admin` | `src/app/(app)/admin/` | ✅ approve / decline access requests |
| `/tracker` | `(app)/tracker/` + `components/tracker-view.tsx`, `lib/tracker.ts` (stage groups, `parseDue`) | ✅ table/board, click stage to move on, New modal |
| `/profile` | `(app)/profile/` + `components/profile-view.tsx` | ✅ edits preferences (autosave), Telegram connect/disconnect, log out |
| `/companies` | `(app)/companies/` + `components/companies-view.tsx`, `lib/companies-data.ts` (directory from the design minus exclusions), `lib/company-match.ts` | ✅ open counts via `open_roles_by_company()`, mute (hidden from For you), suggest |
| `/calendar` | `(app)/calendar/` + `components/calendar-view.tsx` | ✅ closing dates of saved/applied roles + tracker due dates; reminders stored in `calendar_events` |
| `/cv-studio` | `(app)/cv-studio/` + `components/cv-studio.tsx`, `lib/cv.ts` | ✅ `cv_jobs` table (+ `cv_meta` pages/columns), PDF/Word read on the server (unpdf, mammoth), r/EngineeringResumes template, ATS checker, downloads |
| `/auth/preview/<screen>` | `src/app/auth/preview/[screen]/` | 🛠 development only (404 in production): each screen with the design's sample data, for side-by-side design checks |

- `src/proxy.ts`: refreshes the session; signed-out visitors → `/login` (except `/login`, `/auth/*`).
- Phones (<768px): `app-shell.tsx` shows a search button + initial and a floating tab bar (Discover, Tracker, Calendar, Profile); Opportunities has its own phone layout (`PhoneFeed` in `opportunity-feed.tsx`).
- Themes per screen (`LOOKS` in `app-shell.tsx`): bright `/`, ink `/tracker` `/profile`, calm `/calendar` `/cv-studio`, dark `/companies`.
- `src/app/(app)/layout.tsx`: requires login and `onboarded_at`, else → `/onboarding`; renders `components/app-shell.tsx` (design top bar; sets `data-theme="bright"` on /, /calendar, /cv-studio). "checked Xm ago" comes from the `radar_last_checked()` SQL function.
- `src/app/(app)/actions.ts`: `track(opportunityId, "saved" | "applied")` writes `applications` (applied → `applied_at`, follow-up in 14 days; saving never downgrades an applied row).
- Opportunities details: `?tab=all`, `?type=<chip label>`, `?q=`, `?n=` (show more). Match score is a transparent heuristic (58 base + type/discipline/location/skills overlaps, max 97) and every "why" line is a real overlap. Logos: Google favicon of the employer's own domain only (not hiring-system hosts), else the initial.

## Brand and tokens
- `src/app/globals.css`: Night (default) and Cloud (`[data-theme="light"]`) tokens from the design (`--bg`, `--s1`, `--sky`, `--dawn`…), exposed as Tailwind colours (`bg-s1`, `text-tx2`, `border-line2`, `text-t-sky`…), plus shadcn variable mapping.
- Fonts: Newsreader (`font-serif`), Helvetica Neue stack (`font-sans`), Geist Mono (`font-mono`), set in `src/app/layout.tsx`.
- `src/components/brand.tsx`: `LogoMark`, `Wordmark` (star as the i-dot), `Brand`, `Sparkle`, `StarField` (seeded), `TelegramFab`.

## Auth
- Invite by approval. Landing: approved → login email; not approved → "Request access" (inserts `access_requests`). Admin approves in `/admin` → server action sends sign-in email with a session-less implicit-flow client → lands on `/auth/confirm`.
- Supabase keys in `web/.env.local` (URL + **publishable** key only; git-ignored).

## Matching
`src/lib/preferences.ts`: `Preferences` type (stored in `profiles.preferences`), defaults, `matchFilters` (degree → radar disciplines, opportunity types → radar kinds, locations → country codes, "Worldwide" = anywhere) and `applyMatch` for Supabase queries. Used by the onboarding count; to be reused by the For you feed and personal alerts (port to SQL or Python for the radar).
`src/lib/onboarding-data.ts`: option lists from the design data, **without** Defence / Nuclear / Fusion.

## Local dev
`.claude/launch.json` has `web` (npm --prefix web run dev, port 3000) and `design` (serves the handoff on port 8765).

## CV studio (2026-10-01)
- **Template** (`lib/cv.ts` `cvLines`): r/EngineeringResumes style. Name; contact line `phone | email | linkedin | town`; Education (uni, dates on the right; degree + grade; optional Relevant modules); Experience (role, dates right; company, place right; bullets); Projects (`name | team`, dates right; bullets); Technical Skills split into `Software:` (the `SOFTWARE` set in `lib/keywords.ts`) and `Technical:`. No summary. Each entry has `kind: "work" | "project"`.
- **ATS checker** (`lib/ats.ts` `atsReport`): pure function, same for uploads and built CVs. Areas and weights: keywords for this role 40%, measurable impact 25%, parsing and layout 20%, sections and length 15%. Issues have `severity` fix/improve, an area colour (`AREA_COLOUR` in `lib/cv.ts`) and example lines. Uploaded PDFs give page count and a two-column guess (`textOf` in `cv-studio/actions.ts`), stored in `cv_jobs.cv_meta`.
- **Check page** (`AtsCheck` in `components/cv-studio.tsx`): the CV as printed, with bullets marked "Add a result" / "Start with a verb" and the first skills line marked with missing keywords; score ring, four area bars, "How the score works", fix list, Edit this CV. Students fix, check, repeat.
- **Downloads**: PDF (print window from `cvHtml`), Word (real .docx from `cvDocx`, npm `docx`, right tab stop for dates), Google Doc (copies text, opens a new doc).
- **AI**: no key. "Give me ideas" uses built-in templates (`fallbackIdeas`); "Copy a prompt for Claude" copies `ideasPrompt` (no personal details beyond what the student typed for that entry).
- Next: keywords learned from Nimbus's own adverts per role type; tables/images checks for Word uploads.

## Degrees, types and events (2026-10-01)
- Engineering degrees: Mechanical, Biomedical, Chemical, Electrical, Electronic, Aerospace, Civil, Mechatronics and Robotics, Automotive, Manufacturing, Materials, General. Every degree in `onboarding-data.ts` must have an entry in `DEGREE_DISCIPLINES` (`preferences.ts`); check with the snippet in [[10 How to run things#Checks]].
- New type "Expo or careers fair" (in DEFAULT_TYPES). "Clinical shadowing" → insight, "Fieldwork" → research. Part-time/seasonal/freelance/HCA have no radar kind yet.
- `applyMatch`: `disciplines.ov.{...}` or `and(kind.eq.event,disciplines.eq.{})`.
- Cards: events show Hackathon / Expo / Conference / Careers fair / Competition (`kindView`); the Opportunities chip is "Events".

## CV studio, easy path (2026-10-01 evening)
- **Use my CV** (step 3, "Easiest"): upload or sign-up CV → `cvFromText` (lib/cv-tailor.ts) reads it into BuiltCv (name/contact, first university, grade, modules, entries by section, skills) → `tailorCv` → straight to the check with "What Nimbus changed". "Just check my file as it is" keeps the old upload-only check.
- **Tailor it** (builder): strongest bullet first, advert skills the CV proves (literal, or PROVABLE evidence like lathes → Machining) added to Skills, soft skills the advert doesn't ask for moved out, entries with nothing for the job left out only past ~18 bullets.
- **Skills panel**: advert asks (lilac), your bullets show (mint), common in real adverts for your degree (`popularSkills` server action: top skills across ≤400 saved roles matching the degree's tags).
- **Checker**: EVIDENCE map in lib/keywords.ts ("you show X in other words"); keyword bank ~200.
- **Tailor with Claude**: `tailorPrompt` (no name/contact), copied + opens claude.ai/new (with `?q=` when short).
- **LinkedIn**: `components/apply-tips.tsx` (`peopleToFind`, notes, headline) on the check page; people links in the Opportunities drawer. Nimbus never sends anything.
