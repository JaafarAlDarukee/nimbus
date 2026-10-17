# Radar (the checker)

Back to [[00 Start Here]] · code in `radar/`

## Run
- `python -m radar.run --tier priority` (UK/IE; Workday only lists jobs posted in ~the last week) — every 15 min (since 17 Oct; was 30).
- `python -m radar.run --tier full` (all countries) — every 6 h.
- `--dry-run` prints results instead of saving; `--only "<company text>"` limits boards.
- Locally, results print in full; **in GitHub Actions only summary counts print** (public logs).
- See [[10 How to run things]].

## Boards (sources)
- Hand-picked: `data/seed/boards.csv` (Rolls-Royce ×3 Workday, Nissan Workday, JLR SuccessFactors, Adzuna UK, Nimbus inbox).
- Discovered: `data/discovered/{workday,greenhouse,lever,ashby,smartrecruiters,workable}.csv` (~2,900). Discovery **merges**, never shrinks (`radar/discover/__init__.py save_boards`).
- `radar/run.py load_boards` cleans names (`pipeline/names.py`) and skips excluded companies.
- Readers: `radar/sources/*.py`. Workday uses country facet (nested sometimes) + "Posting Date" facet for priority runs. SmartRecruiters uses `country=gb` (lowercase). Greenhouse lists without content, enriches shortlisted. Adzuna uses engineering/manufacturing/science/energy/graduate categories.
- BAE Systems' job site blocks bots (403): not scraped, by design.

## Pipeline
1. Read boards concurrently (`radar/http.py Fetcher`: 3 per host, 24 total, retries).
2. `pipeline/classify.py is_candidate` (title-only early-careers check + exclusions) → dedupe by URL → enrich (full description) only for UK/IE/unknown-country jobs.
3. `classify`: kind (placement, internship, spring_week, insight, grad_scheme, graduate_job, research, apprenticeship, scholarship), disciplines (title first; description only if repeated ≥2), skills (CAD, SolidWorks, CATIA, FEA, ANSYS, CFD, MATLAB, Lean, CNC…), rolling, closing date, fingerprint (company+title+city).
4. `store.py save`: upsert `sources` (board health), insert new opportunities (ignore duplicates), refresh `last_seen_at`, log `checker_runs`.

## Exclusions
`radar/pipeline/exclusions.py`: company list (Airbus, Boeing, BAE, MBDA, Thales, Leonardo, Leidos, Babcock, QinetiQ, Lockheed, Raytheon, Northrop, Palantir, Anduril, Helsing, Shield AI, Saronic, Hadrian, Vannevar, AWE, UKAEA/Atomic Energy, Sellafield, Westinghouse, Urenco, Tokamak, First Light, Acceleron Fusion, Rolls-Royce Submarines/SMR, …), title words (nuclear, weapon, missile, munition, defence, military, submarine, naval, …), description words repeated ≥3. Rolls-Royce kept for civil roles only. See [[09 Decisions log#Exclusions]].

## Alerts
- `radar/notify/telegram.py`: posts to the **channel** (`TELEGRAM_CHAT_ID`). Only rows that are new, from boards seen before (a board's first check is silent), posted in the last 7 days, UK/IE, and engineering-type (`is_engineering`). Max 25 per run.
- `radar/notify/admin.py`: DMs the admin (`TELEGRAM_ADMIN_CHAT_ID`) about new access requests.
- **Next**: personal alerts. Plan: bot reads `/start <code>` (via getUpdates in the radar run, or a Supabase Edge Function webhook later), matches `telegram_links.code` → saves `notification_channels(telegram, {chat_id})`, replies "Connected". Then per-user matching with the same rules as [[06 Website#Matching]] and one DM per match. Channel becomes news only.

## Inbox
`radar/sources/inbox.py`: Gmail via IMAP (app password), read-only, last 3 days, never opens links. Recognises job links per site; strips tracking; logs only per-sender counts. `python -m radar.sources.inbox --inspect` (local only, needs `.env`) shows what it finds, to tune parsers once real alert emails arrive.

## Changes 2026-09-30
- **Adzuna removed**: its jobs linked to adzuna.co.uk and appeared ~5.2 days after the employer posted (measured on jobs seen on both). Its 409 rows were closed.
- **Classifier tightened** (`pipeline/classify.py`): hint words match whole words ("Internal" ≠ intern); French "stage" needs French context; `staff`, `lead engineer`, `postdoc` are not student roles; disciplines come from the title, and from the description only for technical titles with specific wording (`DESCRIPTION_DISCIPLINES`); new `creative` discipline.
- `python -m radar.reclassify` (workflow `reclassify.yml`, manual) re-applies the rules to saved rows: first run relabelled 2,389, closed 1,245 non-student, 409 Adzuna, 70 excluded.
- **Personal alerts**: `notify/personal.py` after every run (`send_matches` for new rows, `send_reminders` every run). `alerts_sent` channels: `telegram`, `telegram:closing`, `telegram:follow-up`. Max 8 matches per person per run, score ≥ 60.
- **Jobs that vanish are closed** (`close_gone_opportunities()`, called at the end of full runs): not seen for 3 days on a board read OK in the last 12 h, past the closing date, or alert-email jobs after 30 days. Re-seen jobs reopen.
- **Workday 429s fixed** (`radar/http.py`): one concurrency limit per Workday server group (wd1, wd3…; 5 at a time) instead of per company, `Retry-After` honoured (else 5/15/45 s), timeouts retried once. Before: ~40 boards failed every full run.
- **Names**: `names.py` strips short number codes ("02 Reed…") and keeps ordinals ("20th Century"). `reclassify` renames old-name rows or closes them if the tidy copy exists (first run: 63 renamed, 148 duplicates closed). The radar's "seen again" update doesn't touch names, so name fixes need `reclassify`.
- Feed shows one card per company+title ("Leeds +3 more").

## Changes 2026-10-01
- Adzuna back (`data/seed/boards.csv`), labelled via Adzuna everywhere; Adzuna blocks automated redirect-following (403), so it can't be used to discover employer boards.
- `sources.company_name` (radar records each board's employer) → `watched_companies()` for the Companies page.
- `radar/discover/probe.py`: checks Greenhouse/Workable/Lever/Ashby by company name (name must be confirmed, ≥5 letters, has jobs). Low yield for big UK employers; research works better.
- `data/discovered/research.csv`: hand-researched boards (Workday mostly). Find a Workday board by searching the company on `myworkdayjobs.com` (WebSearch with allowed_domains). Respect robots.txt / 403s (McLaren, National Grid, Dyson site block tools → routes only).
- `radar/sources/devpost.py`: hackathons (hint "hackathon" → kind event). Events bypass the discipline filter; online events bypass the country filter (web `applyMatch`, radar `is_match`).
- Telegram `send_welcome()`: 3 best open matches for someone who just connected.

## Changes 2026-10-01 (later)
- **Disciplines** (`pipeline/classify.py` DISCIPLINES): added `biomedical`, `life_sciences`, `healthcare`, `environmental` (+ description variants), and engineering words that were missing (high voltage, protection & control, FPGA, geotechnical, dams, NDT, welding, calibration, metrology, HVAC, CFD, machine learning/AI). "Medical device/technology/engineer..." is biomedical, not healthcare.
- **Matching rules live in one place**: `web/src/lib/preferences.ts` (`DEGREE_DISCIPLINES`, `FIELD_DISCIPLINES`, `TYPE_KINDS`). `radar/match.py` parses them from that file (keep keys quoted, one entry per line) and takes title patterns from the classifier. A typed-in degree falls back to its field's tags.
- **Events**: event readers set `raw.employment` ("hackathon"/"event", which always means kind `event`) and `raw.disciplines` ([] = every degree). Events with tags only reach matching degrees; reclassify skips events.
  - `sources/mlh.py`: MLH season page (www.mlh.com/seasons/<year>/events, robots allow), schema.org Event microdata; keeps UK/Europe/online.
  - `sources/events.py` + `data/seed/events.csv`: hand-researched expos, conferences, fairs, science festivals (official dates and links). Add rows to add events; past ones drop out.
  - Devpost hackathons now `disciplines: []`.
- **Store** keeps the hiring system's type fields in `opportunities.raw` (`HINT_FIELDS`), so reclassify can re-apply rules. Reclassify no longer closes a role just because the title alone has no type (only staff titles close).
- **Inbox**: tracker links with the real address in the path (Amazon SES `awstrack.me`, used by Higherin) are decoded. TARGETjobs (`e.targetjobs.co.uk`) and Bright Network (`email.m.brightnetwork.co.uk`) use opaque trackers: check the first real alerts ("link hosts" log line).
- **Telegram**: event alerts read "Expo · ends 5 Nov" (`event_type` in `notify/personal.py`, same labels as the cards).

## Changes 2026-10-01 (night)
- `sources/nhsjobs.py`: NHS Jobs public search (robots.txt sets no rules), 11 entry-level keywords, 1 page (priority) or 3 (full). Titles with trainee/graduate(s)/newly qualified/preceptorship/assistant psychologist/student get the "graduate" hint; others must match the normal rules. Source kind `nhsjobs` (migration 20261001040000).
- `STAFF_ROLE` no longer matches bare "staff" (NHS Staff Nurse is entry level); only "staff engineer/scientist/developer/software/data/accountant/product".
- Health tags: clinician, MSK, audiology, health screening, wellbeing, practitioner, therapist, mental health, CWP.
- Workday science boards: found by POSTing likely site names to `/wday/cxs/{tenant}/{site}/jobs` (the tenant root returns 406, no redirect).

## Changes 2026-10-03
- Events are engineering-only: `sources/event_tags.py` (`engineering_tags`, `REGIONS` = UK, Europe, US/CA, Gulf). Devpost keeps only hackathons whose name/themes match; MLH keeps in-person events in REGIONS (online software weeks dropped), tagged for engineering + software.
- `events.csv` now has 10 international events (Formnext, electronica, MEDICA, Hannover Messe, CES, SAE WCX, ASME IMECE, ADIPEC, GITEX, WHX Dubai). Abroad events only show to users who picked those regions in Profile.
- Bright Network alerts arrive late because they're digest emails and its site blocks tools; owner told to set its email frequency to the most frequent.

## Changes 2026-10-05 (computing)
- `software` discipline now matches full-stack, front/back end, DevOps, cloud, SRE, web, mobile, iOS/Android, ML/AI/LLM/NLP, computer vision, technology graduate programmes, information security, test automation, games developer; description fallback counts python/java/javascript/typescript/react/kubernetes/aws/azure.
- Shared channel (`notify/telegram.py` `is_engineering`): `software` added to the set; everything else unchanged.
- Devpost: hackathons with no engineering/science theme are kept and tagged `["software"]` (computing degrees only).
- Boards: probe found Cloudflare, Monzo, Graphcore, Wayve, Quantexa, Faculty, Synthesia, Sophos, Thoughtworks, dunnhumby, GoCardless, PolyAI, Dexory, Carbon Clean, Ashfield MedComms; Workday: Nvidia, Cisco, Mastercard, PayPal, Lloyds (lbg), NatWest (rbs), Citi, Morgan Stanley, Deutsche Bank, Kainos, Broadcom, Workday. Not found: Arm, BT, Capgemini, Dell, Goldman, HSBC, Sage, Siemens, Vodafone; big tech (Google, Microsoft, Amazon, Apple, Meta) use their own sites (not read yet).
- Gotcha: `companies-data.ts` keys must be double-quoted, or `match.DIRECTORY` silently becomes empty (radar_checks now asserts it parses).

## Changes 2026-10-17
- **Paid access** in `notify/personal.py`: `access_state()` mirrors `web/src/lib/access.ts`; `_gate()` drops locked users (each gets one "your free trial has ended, unlock for £5" message, remembered in `profiles.trial_notice_at`) and gives trial users a budget of `TRIAL_ALERTS` = 5 personal alerts in total (counted in `alerts_sent`), then one 🔒 "N more matches" note. Welcome matches and reminders only for people with access. The shared channel is unchanged.
- Owner: personal bot felt "slow and shit" next to the channel. Both send in the same run; the difference was (1) types: the channel posts every kind (most are apprenticeships and graduate roles), personal only the types the user picked; (2) ~half of new UK roles had no discipline tag, which the channel took by technical title but For you/personal never matched. Fix: `GENERIC_ENGINEERING` / `GENERIC_SCIENCE` in `classify.py` give untagged technical titles an `engineering` or `science` tag; every engineering degree (and Computer Engineering, Materials Science, Physics) includes `engineering`, every science degree `science`; the channel set includes both so it is unchanged.
- `store.py` retries Supabase calls on 5xx (see [[11 Gotchas#Supabase hiccups]]).

## Changes 2026-10-17 (evening)
- Diagnosis of "personal alerts few and bad" (owner's last 7 days): channel 745 roles vs personal 58; 515 of the channel's were apprenticeships/grad roles the owner didn't pick (correct), but personal also had wrong-field roles (film "Post Production", "Materials Management", "Data Management & Automation"), the same role up to 3 times (employer + Gradcracker + Bright Network + Adzuna), and hackathons tagged for every degree. Sending itself is fast (~1 min after a role is found; employers' own boards are found within ~30-40 min).
- `classify.py`: "production" not after "post" / before assistant/runner/coordinator/company/data; "automation" only for machines (industrial/factory/controls/PLC/building automation, automation engineer/technician/intern); "materials" not management/handling/planning/buyer (→ business), "material" only with science/engineer/testing; IT support / compiler / helpdesk → software; insurance/broking → business; agronomy/agriculture → environmental; film/TV/broadcast/post-production → creative.
- `event_tags.py`: "software engineers" no longer tags every engineering degree. `exclusions.py`: excluded employers named in a title are excluded (e.g. "NTU x ST Engineering Hackathon"; ST Engineering added).
- `inbox.py` `_company_from`: Bright Network (`/graduate-jobs/<employer>/…`) and Higherin (`/jobs/<id>/<employer>/…`) give the employer. **This exposed 43 open BAE Systems / MBDA / AWE / Babcock roles** hidden behind "via Bright Network"; `reclassify.py` now renames "via <site>" rows from the link and checks exclusions on the new name (run: 43 excluded closed, 307 relabelled, 372 renamed, 2 duplicates closed). LinkedIn / TARGETjobs links don't name the employer (153 rows left).
- `match.py` `fit()` replaces `score()` (see [[06 Website#Match: facts, not a score (17 Oct)]]); `personal.py`: alerts show the label and ticks (no %), "via Gradcracker" instead of "posted today" for email finds, and **`same_role_key` / `is_repeat`** skip a role already sent to that person in the last 30 days (`REPEAT_DAYS`) or earlier in the run. `MIN_SCORE` removed (it let everything through).

## Changes 2026-10-17 (night)
- `match.py` `filters_for`: **every student kind** (`STUDENT_KINDS`, all `TYPE_KINDS` values) and **the degree's subjects plus the whole field** (`FIELD_DISCIPLINES`); `degree_disciplines()` = the degree's own. `fit(row, prefs, filters)` → `(rank, ticks, industry)`: ticks "Mechanical in the title" / "Asks for …" (own degree), "Chemical engineering" (other subject in the field), "Engineering role", "Any subject", industry; **no labels, no CV skills**; rank only orders (2 own degree in title, 1 own degree in advert or industry, 0 rest).
- `personal.py`: message starts with the type (🟦 PLACEMENT, 🟩 APPRENTICESHIP, 🟫 GRADUATE SCHEME, 🟧 HACKATHON…), then title, employer · place, details, ticks; first button **Open on Nimbus** = `{SITE_URL}/?open=<id>` (sign in / pay first); `MAX_PER_PERSON` 30 (then "…and N more on Nimbus"). Trial still 5 alerts. The shared channel (`notify/telegram.py`) is unchanged.
- Schedule: `nimbus-radar-priority` at `2,17,32,47 * * * *` (migration `20261017010000_radar_every_15_min.sql`); workflow renamed "every 15 min". Priority runs take ~5-7 min; the full run (~27 min, every 6 h at :50) still blocks them while it runs (shared concurrency group).
- Replay of the owner's last week with the new rules: 360 personal alerts (145 grad schemes, 61 internships, 58 apprenticeships, 53 placements, 36 graduate jobs…).

## Changes 2026-10-17 (late)
- `personal.py` `wanted()`: a role reaches a person if it's one of their matches **or**, for Engineering-field users, the main channel would post it (`ALERT_COUNTRIES` + `is_engineering`, any type) and the employer isn't muted. `match.py` `CHANNEL_EXTRA` adds `software` and `science` to Engineering's subjects (website mirrors it), `is_muted()` helper.
- `send_trial_reminders()` (called after `send_reminders` in `run.py`): trial users with Telegram whose trial ends within `TRIAL_REMIND_HOURS` (12) get one message with the /pay link; `profiles.trial_reminder_at` remembers it.
- **Main channel check (owner asked it's unaffected, 17 Oct late):** `notify/telegram.py` unchanged since 0b11d75; no personal filters, trial limits, paywall or repeat filter apply to it. Shared tagging/exclusion fixes moved last week's 745 channel posts to 732 (−14 defence employers found via Bright Network, −6 non-engineering: insurance, stock-keeping, agronomy, theatre/audio; +7). "Graduate Broadcast Engineer" had been dropped by the TV-word rule: `classify.py` now keeps an `engineering` tag when the title says "engineer" and only `creative` matched (`ENGINEER_TITLE`). The channel's one filter is still UK/Ireland engineering, computing and science (owner's choice, 5 Oct); removing it would add ~1,100 roles a week.

## Main channel posts everything (17 Oct, latest)
- Owner: the main channel is theirs only and must show **everything** with no filter ("just to confirm the bot is working"); the personal bot is the filtered one.
- `notify/telegram.py` `send_new`: every new row (no `is_engineering`, no country filter). UK/IE rows: one message each (`format_alert`, unchanged look), up to `MAX_SINGLE_PER_RUN` = 60; the rest of UK/IE and all abroad rows: `role_lists()` packs "• Type: <linked title> · employer · place" lines into messages under `LIST_CHARS` (3,800), headings "📋 N more new roles in the UK and Ireland" / "🌍 N new roles abroad". `PAUSE` 3.1 s (Telegram ~20 messages a minute per channel); `_send` retries 429s up to 5 times and never raises (a failure is printed with its status code only).
- `run.py`: personal alerts (`send_welcome`, `send_matches`) now go **before** `send_new`, so the channel's longer posting never delays them.
- `is_engineering` stays: it's the "engineering radar" that personal `wanted()` adds for engineering students.
- Volume last 7 days: priority runs 1,548 new, full runs 5,540 (biggest single run 2,599); ~1,740 UK/IE and ~4,100 abroad posted within a week.
