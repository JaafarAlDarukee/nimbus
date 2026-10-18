# Website

Back to [[00 Start Here]] · code in `web/` (Next.js 16.3, React 19, Tailwind 4, shadcn base-nova)

> Next.js 16 differs from older versions: `middleware` is now `src/proxy.ts`; `cookies()`, `params`, `searchParams` are async; read `web/node_modules/next/dist/docs/` before using unfamiliar APIs (see `web/AGENTS.md`).

## Routes
| Route | File | Status |
|---|---|---|
| `/login` (Landing) | `src/app/login/page.tsx`, `login-form.tsx` | ✅ design-matched; open sign-up by email link |
| `/pay` | `src/app/pay/page.tsx` (data) + `components/pay-view.tsx` (look) | ✅ trial / trial ended / paid (channel invite) / "payment received" |
| `/auth/callback` | `src/app/auth/callback/route.ts` | ✅ PKCE code exchange (same browser) |
| `/auth/confirm` | `src/app/auth/confirm/page.tsx` | ✅ handles hash tokens, token_hash, code |
| `/onboarding` | `src/app/onboarding/page.tsx`, `onboarding-flow.tsx` | ✅ 10 steps, saves to `profiles` |
| `/` Opportunities | `src/app/(app)/page.tsx` (data) + `src/components/opportunity-feed.tsx` (UI) + `src/lib/opportunity-view.ts` (row → card, fit + ticks, why) | ✅ design-matched |
| `/admin` | `src/app/(app)/admin/` | ✅ money, members (Mark paid / Undo), payment links, invite card, old access requests |
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
- Opportunities details: `?tab=all`, `?type=<chip label>`, `?q=`, `?n=` (show more). Match is facts only (see Match below); every "why" line is a real overlap. Logos: Google favicon of the employer's own domain only (not hiring-system hosts), else the initial.

## Brand and tokens
- `src/app/globals.css`: Night (default) and Cloud (`[data-theme="light"]`) tokens from the design (`--bg`, `--s1`, `--sky`, `--dawn`…), exposed as Tailwind colours (`bg-s1`, `text-tx2`, `border-line2`, `text-t-sky`…), plus shadcn variable mapping.
- Fonts: Newsreader (`font-serif`), Helvetica Neue stack (`font-sans`), Geist Mono (`font-mono`), set in `src/app/layout.tsx`.
- `src/components/brand.tsx`: `LogoMark`, `Wordmark` (star as the i-dot), `Brand`, `Sparkle`, `StarField` (seeded), `TelegramFab`.

## Auth
- Open sign-ups (17 Oct): anyone types their email and gets a login link. (Before: invite by approval through `access_requests`; Admin still lists old requests.)
- Supabase keys in `web/.env.local` (URL + **publishable** key only; git-ignored).

## Paid access (17 Oct)
- `src/lib/access.ts`: `PRICE` £5, `TRIAL_JOBS` 5, `TRIAL_CVS` 2, `accessState()` → `paid | trial | locked` (admins always paid), `timeLeft()`, `payLink()` (only Stripe URLs; adds `client_reference_id` = user id and `prefilled_email`). Mirrored in `radar/notify/personal.py` `access_state`: change both together.
- `(app)/layout.tsx`: locked → `/pay`; trial → lilac banner "Free trial: X left · 5 jobs and 2 CVs" linking to `/pay`.
- Opportunities: trial shows the first 5 roles (2 closing soon on phones) and a 🔒 "N more roles for you" unlock card.
- CV studio: `createJob` returns `"limit"` after 2 CV jobs on trial (→ `/pay`); the page refuses `?job=` too.
- Onboarding asks "How many applications are you planning this season?" and "How did you hear about Nimbus?" (`preferences.applications`, `preferences.heardFrom`), shown on Admin.
- Dev previews: `/auth/preview/pay-trial`, `pay-locked`, `pay-paid` (shown without the app frame).

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

## CV studio, round 3 (2026-10-01 night)
- Example CV: `lib/cv-example.ts` (EXAMPLE_CV, EXAMPLE_NOTES pinned by line start, EXAMPLE_RULES), shown in `ExampleCv` over the page. The CV paper is one `Paper` component with a `mark` function (check highlights, example notes).
- `ReadByAts`: what a tracking system would extract (cvFromText for uploads, the BuiltCv for built ones). Honest copy: no employer shares a score.
- `lib/skill-tips.ts` `tipFor(skill)`: shown for listed skills no bullet proves yet.
- Free AI review (`aiReview` server action, `AiReviewCard`): Gemini free tier, only when `GEMINI_API_KEY` is set (page passes `aiOn`); model from `GEMINI_MODEL`, else `gemini-flash-latest`, else `gemini-2.5-flash`. Sends the CV without name/contact. JSON reply: fit, verdict, strengths, fixes, rewrites, missing.
- Jobs can be deleted (`deleteJob`, RLS-limited) and a new job can start from another job's CV (copied and tailored).
- Keyword matching: acronyms in `CASED` only count in capitals (SPICE, SAP, CAM, PCR...).

## Computing (2026-10-05)
- `FIELDS`: Computing is live. Degrees: Computer Science, Software Engineering, Artificial Intelligence and Machine Learning, Data Science, Cyber Security, Computer Engineering, Information Technology, Games Development (notes + SUGGEST in `onboarding-data.ts`; `FIELD_EXTRAS.Computing`). Sector group "Computing and tech" (Big tech, Software and SaaS, AI and machine learning, Data and analytics, Cyber security, Fintech, Cloud and infrastructure, Gaming, Telecoms, Tech consultancy).

## Match: facts, not a score (17 Oct)
- Owner: the % "feels like a guess" (it was 50 + points). Replaced by `fitRole()` in `src/lib/opportunity-view.ts` (mirrored in `radar/match.py` `fit`): **ticks** (the facts: "Mechanical in the title", "Placement", "Automotive", "CAD, MATLAB on your CV") and a **label** worked out from them: Top match = your subject in the title + your industry or 2+ CV skills; Good match = subject in the title, or a broader subject match + one of those; Worth a look = the rest ("Engineering role" titles, open hackathons). `Fit`, `FIT_LABEL`, `FIT_TONE` live in `lib/opportunity-types.ts` (browser-safe).
- Cards: label pill on the right (mint / sky / dawn) and a ticks row; phone cards: ticks + small pill; drawer: label pill + the "why" sentences. Feed order is still newest first.
- Feed `collapse()` in `(app)/page.tsx` uses `sameRoleKey` / `isSameRole` (years, punctuation, company suffixes ignored; "via <site>" matches any employer): the same role from several places shows once ("+N more").

## Show everything, split by type (17 Oct night)
- `preferences.ts` `matchFilters`: kinds = `STUDENT_KINDS` (every type), disciplines = the degree's + `FIELD_DISCIPLINES[field]`; `degreeDisciplines()` for "in the title" ticks. Onboarding's "What kind of opportunities" step and Profile's "Looking for" row are removed (`types` is still stored, unused). The applications question no longer claims it sets alert numbers.
- `opportunity-view.ts` `fitRole(row, prefs, filters)` → `{ rank, ticks, why }` (no labels, no CV skills). `OpportunityView` has `ticks`, no `fit`.
- `TYPE_COLUMNS` (opportunity-types.ts): Placements & internships · Graduate jobs · Apprenticeships · Events & research. `(app)/page.tsx` loads one query per column (25 cards + count) when type is "All types" and not on trial (`columnsView`), otherwise counts only (chips and phone tabs). Desktop: `Columns` in `opportunity-feed.tsx` (2 columns at md, 4 at xl, "See all N" → that type's single list); chips = All types + the 4 groups with counts. Phone: type tabs with counts above the New list. Older `?type=Placement` links still work (`TYPE_CHIPS`).
- `?open=<id>` (from personal Telegram alerts) opens that role's drawer, whatever the filters. Signed out → `proxy.ts` sends to `/login?next=…`; `lib/next-path.ts` `safeNext` (same-site paths only) and the `nimbus_next` cookie bring them back after the link (`auth/callback`, `auth/confirm`) or the code (`login-form.tsx` `verifyOtp`).
- `/pay` and Admin: no channel invite (the channel is the owner's own).

## Public pages and app icon (17 Oct late)
- `/privacy` and `/terms` (`components/legal-page.tsx`, public in `proxy.ts`): plain English; Terms: 2-day trial limits, £5 once "for as long as Nimbus runs", **14-day full refund**, fair use, liability limited to what was paid, England and Wales law. Contact email from `app_settings.support_email` (Admin). Linked from the sign-in footer and /pay. Written as a plain starting point, not legal advice.
- App icon: `lib/app-icon.tsx` draws the Telegram logo's cloud and star with `next/og`; `app/icon.tsx` (192), `app/apple-icon.tsx` (180), `app/icon-192.png` and `app/icon-512.png` routes, `app/manifest.ts` (standalone, night colours). The default `favicon.ico` (Next.js logo) was removed. `/icon`, `/apple-icon`, `/manifest.webmanifest` are public in `proxy.ts`.
- `preferences.ts` `CHANNEL_EXTRA`: Engineering also gets `software` and `science` in For you (same as the channel).

## UK and Ireland only (17 Oct, last)
- Owner: "remove all the countries from my website, just keep the UK and Ireland". `preferences.ts` `COVERED_COUNTRIES` = GB, IE; `matchFilters` always uses it (old "abroad" picks ignored; mirrored in `radar/match.py`). The All tab (`open()` in `(app)/page.tsx`) is UK/IE too, plus online events. The Location question is gone from onboarding and Profile (it only chose countries; UK regions never filtered). `UK_LOCATIONS` / `ABROAD_LOCATIONS` removed. Companies: no "(N abroad)". Copy: "UK and Ireland, newest first"; "3,200+ employers" (3,242 careers sites, 3,303 boards).
- The radar still collects roles worldwide (~18,000 of ~24,000 open are abroad); stopping that would save database space (idea).

## 18 Oct
- Feed ordered by `opened_at` (then `first_seen_at`); "N opened since yesterday" and phone "new today" count by `opened_at`. `toView`: `found` = "posted 30m ago" (employer site) / "found 20m ago" (job-site email or Adzuna) / "listed since 30 Sep" (opened over a day before Nimbus found it); `isNew` only for employer sites opened < 6 h; `via` names the job site from the link; abroad roles' place ends "(abroad)". Drawer fact "When".
- Tabs: For you · All (UK/IE) · Abroad. `applyMatch` and the All/Abroad queries hide `defence` rows unless `prefs.defence`; Profile row "Defence and nuclear roles" (Show/Hide).
- `/pricing` public page; login header + footer link to it; /pay links "What you get".
- `(app)/layout.tsx` `TrialBanner`; `lib/access.ts` `hoursLeft`, `TRIAL_FEATURES`, `PAID_FEATURES`.

## Engineering only (18 Oct, night)
- `preferences.ts` `engineeringOnly()` on every feed query (`openAnywhere` in `(app)/page.tsx`): disciplines overlap `ENGINEERING_TAGS` (engineering fields + software + science) or an untagged event, and never `business`/`creative`. Same as radar `is_engineering_role`. UK/IE open roles shown: 2,117 of 5,792.
