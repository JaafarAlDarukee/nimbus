# Roadmap and status

Back to [[00 Start Here]] · updated 2026-10-17 · full history in [[Sessions/2026-09-26 to 30]] and [[Sessions/2026-10-01 to 17]]

## Live ✅
**Radar** ([[04 Radar]])
- Readers: Workday, SuccessFactors, Greenhouse, Lever, Ashby, SmartRecruiters, Workable, RSS, sitemaps, Adzuna (labelled), Nimbus inbox (Gradcracker, Higherin, Bright Network, TARGETjobs, LinkedIn alerts…), **NHS Jobs**, **Devpost**, **MLH**, curated **events.csv** (16 UK + 10 international).
- ~3,300 boards: Common Crawl discovery + probe + hand research (`data/discovered/research.csv`: AstraZeneca, Dyson, Mercedes F1, 28 pharma/medtech, ~27 tech/fintech/banks…).
- Classification: kind, discipline tags (engineering fields, `software`, `biomedical`, `life_sciences`, `healthcare`, `environmental`, generic `engineering`/`science`, `business`, `creative`), skills, closing dates. Exclusions: no defence, nuclear, weapons, Airbus, BAE, Boeing…
- Schedule: priority every 30 min, full every 6 h (Supabase pg_cron → GitHub Actions); Supabase calls retried on 5xx.
- Telegram: shared **Nimbus Alerts** channel (UK/IE engineering + computing roles); **personal alerts** per linked user (For you rules), welcome matches, deadline reminders, follow-up nudges.

**Website** ([[06 Website]]) at nimbus-pi-three.vercel.app
- Landing ("Welcome to Children of Khan, boy 🫵"), **open sign-ups with a 2-day free trial** (5 jobs, 2 CVs, 5 Telegram alerts), **/pay** (£5 once via Stripe), onboarding (4 fields: Engineering, Science, Medical and health, Computing; 50+ degrees), Opportunities (For you / All, drawer with LinkedIn people to find), Tracker, Calendar, Companies (by field/degree, routes for blocked employers), Profile, Admin (money, members with Mark paid, payment links, invite card, company suggestions, old access requests).
- CV studio: r/EngineeringResumes template, ATS checker, read advert from a link, Use my CV (one-click tailoring), example CV, Claude pop-up, LinkedIn tips, downloads (PDF/Word/Google Doc).

**Email**: Supabase sends sign-up emails through the Nimbus Gmail as "Children of Khan".

## Users
17 Oct: 5 website accounts (owner included), 3 finished sign-up, 2 on personal alerts; 5 people in the channel. Nobody has paid yet (Stripe not set up).

## Next ⏭️
1. Owner sets up Stripe (steps in [[00 Start Here#Open items (in order)]]), then a test-mode payment end to end.
2. Phase 2: public website (landing with animations, privacy/terms, app icons, hosting that allows selling). Phase 3: ads and social media.
3. Coverage gaps: Haleon, Reckitt, Johnson Matthey, Takeda, Lilly, Boston Scientific, Novo Nordisk, Charles River, Arm, BT, HSBC, Vodafone, Sage, Dell, Goldman; big tech own sites (Google, Microsoft, Amazon, Apple, Meta).
4. See [[13 Ideas backlog]].

## Numbers (17 Oct)
- ~24,000 open roles; ~1,845 new UK roles per week (about a third apprenticeships/grad jobs).
- Priority run ≈ 5–7 min; full run longer.
