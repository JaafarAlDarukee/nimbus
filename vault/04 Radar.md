# Radar (the checker)

Back to [[00 Start Here]] · code in `radar/`

## Run
- `python -m radar.run --tier priority` (UK/IE; Workday only lists jobs posted in ~the last week) — every 30 min.
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
