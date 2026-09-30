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
- **Location fix**: `radar/geo.py` now puts US states / Canadian provinces / Australian states before UK town names ("Cambridge, MA" is US); multi-city lists count as UK if any city is. 93 saved rows corrected.

## In progress 🔄
- Owner is going through onboarding (animation added 2026-09-30).

## Next ⏭️ (in order)
1. ~~Animation pass on landing + onboarding~~ ✅ done 2026-09-30.
2. ~~**Opportunities** page from design~~ ✅ done 2026-09-30 (owner hasn't seen it signed in yet: ask for feedback).
3. **Personal Telegram alerts** (bot links accounts via `telegram_links`; per-user matching; the shared channel becomes news only).
4. **Tracker** from `Nimbus Tracker.dc.html` (table + board, stages, ghosted after 21 days). The Opportunities toast already links to `/tracker`, so this is the most-needed next screen.
5. **Profile** (edit preferences, alerts, log out).
6. **Calendar** (deadlines, interviews, "expected to open" predictions).
7. **Companies** (directory by field → degree → industry; company drawer).
8. **CV studio** (4-step; ATS scoring; Gemini "Give me ideas"; exports).
9. **Mobile** layouts + Telegram polish.
10. Go online: Vercel + domain; Supabase SMTP via Nimbus Gmail; invite friends.
11. Hidden opportunities (speculative routes, opening predictions), hiring posts, company news. See [[13 Ideas backlog]].

## Numbers to remember
- Radar priority run ≈ 9 min for ~2,900 boards (public repo, unlimited Actions minutes).
- Inbox check is every priority run (reads last 3 days, read-only).
