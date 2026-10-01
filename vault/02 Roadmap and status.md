# Roadmap and status

Back to [[00 Start Here]] · updated 2026-09-30

## Done ✅
- **Stage 0–2, foundations**: tools installed (Git, Node 24, Python 3.12, gh), repo `JaafarAlDarukee/nimbus` (**public**, see [[09 Decisions log]]), Supabase project (London), GitHub secrets. See [[08 Accounts and secrets]].
- **Radar v1**: readers for Workday, SuccessFactors, Greenhouse, Lever, Ashby, SmartRecruiters, Workable, RSS, sitemaps, Adzuna, Nimbus inbox (Gmail IMAP). Classification (kind, disciplines, skills, rolling, closing date). Exclusions. See [[04 Radar]].
- **Reliable schedule**: Supabase pg_cron starts the radar via GitHub API every 30 min (priority) and 6 h (full); GitHub cron is backup. See [[05 Database#Cron]].
- **Telegram channel alerts** ("Nimbus Alerts"): engineering-type UK roles posted in the last week, from boards already known. See [[04 Radar#Alerts]].
- **Stage 4, company universe**: discovery via Common Crawl → ~2,900 boards (Greenhouse 1,258 · Ashby 623 · Workday 411 · Workable 385 · SmartRecruiters 207 · Lever 36) + Adzuna. First full check: 4,170 opportunities, 1,175 UK.
- **Stage 5, Nimbus inbox**: dedicated Gmail + app password connected; parser for Gradcracker, LinkedIn, RateMyPlacement, Bright Network, Handshake, TARGETjobs, Prospects, Indeed. Owner still setting up alerts/forwarding (LinkedIn filter only `jobalerts-noreply@linkedin.com`; other sites sign up directly with the Nimbus Gmail).
- **Design**: owner's Claude Design handoff (10 screens) received and saved locally. See [[07 Design]].
- **Website phase 1**: design tokens + fonts + brand; Landing (pixel-matched); 10-step Onboarding with live matching count; invite-by-approval (request access → admin approves → email); `/admin` page. See [[06 Website]].
- **Opportunities (2026-09-30)**: design top bar + Opportunities page matched side by side with `Nimbus Opportunities.dc.html` (desktop and phone): For you / All, search, type chips, match rings, light drawer, CV-check popup, toast. Save / Apply write to `applications`. Other nav items show a "Being built next" stand-in.
- **All design screens (2026-09-30)**: Tracker, Profile, Companies, Calendar, CV studio and the phone layout, each checked side by side with its design file. See [[06 Website]] and [[07 Design]].
- **Location fix**: `radar/geo.py` now puts US states / Canadian provinces / Australian states before UK town names ("Cambridge, MA" is US); multi-city lists count as UK if any city is. 93 saved rows corrected.

- **1 Oct**: Tracker stage picker + row editor; Calendar applied / closing / opened / expected-to-open; Companies UK counts, linked status, "How to get in"; Telegram welcome matches; Adzuna back; Devpost hackathons; events skip degree/country filters.

## In progress 🔄
- Owner is going through onboarding (animation added 2026-09-30).

## Next ⏭️ (in order) — plan agreed 2026-10-01
**The big problem is coverage**: on 1 Oct only 34 of the 323 directory companies were watched (Common Crawl discovery found mostly US tech/finance). Fix in three ways:
1. **Owner: job-alert emails to the Nimbus Gmail** (Gradcracker, RateMyPlacement, Bright Network, TARGETjobs, LinkedIn job alerts). Covers mainstream UK employers whose sites block tools (McLaren, National Grid…). Inbox reader works; no alert emails yet.
2. **Claude: research the directory's top employers** (motorsport, automotive, aerospace, rail, energy, pharma, medtech): find their hiring system; add readable boards to `data/discovered/research.csv` (test-read with `python -m radar.run --tier full --only "<name>" --dry-run`); add a route (careers page, how, published contact, opening window) to `web/src/lib/company-routes.ts`. Done so far: AstraZeneca, Dyson, Mercedes F1, Smith+Nephew, GE Aerospace, Renishaw, GE HealthCare, P&G, Siemens Gamesa/Healthineers, Mitsubishi Electric; routes for JLR, Toyota, McLaren, National Grid, Network Rail…
3. **Adzuna** is back (labelled "via Adzuna", ~5 days late, closes after 30 days or when the employer's own copy exists).
Then:
4. More readers: Recruitee, Pinpoint, Teamtailor (UK SMEs); events: MLH UK hackathons, engineering competitions and conferences (curated list).
5. **CV studio v2**: keywords learned from Nimbus's own adverts per role type; real ATS file checks (reading order, columns, tables, headers, images, length); AI suggestions (Gemini key or Copy to Claude); 3 ATS-safe templates exported as real .docx and PDF, one CV per job. Needs from the owner: a CV design they like (or "pick for me"), optional Gemini key.
6. Go online: Vercel + domain; Supabase SMTP via Nimbus Gmail; invite friends (each gets their own For you and Telegram).
7. Hidden opportunities (speculative routes), hiring posts, company news. See [[13 Ideas backlog]].

## Numbers to remember
- Radar priority run ≈ 9 min for ~2,900 boards (public repo, unlimited Actions minutes).
- Inbox check is every priority run (reads last 3 days, read-only).
