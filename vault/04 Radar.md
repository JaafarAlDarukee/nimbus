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

