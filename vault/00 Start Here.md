# Nimbus: start here

Nimbus is a private job radar for UK students, built by the owner (a 2nd-year mechanical engineering student, first time coding) for themselves and their classmates ("Children of Khan"). It watches thousands of employers' own careers pages plus job-site alert emails, finds placements / internships / grad schemes / events the moment they open, and alerts people on Telegram. It also has a tracker, calendar, companies directory and a CV studio with a checker. **It never applies or messages employers for anyone.**

Live site: **https://nimbus-pi-three.vercel.app** (invite by approval) · Repo: `JaafarAlDarukee/nimbus` (**public**: never commit personal data) · Bot: **@NimbusRadarBot** · Channel: **Nimbus Alerts**

## If you are Claude starting a new session
1. Read [[12 Working with the user]] first: how to talk to the owner, and their standing rules (incl. **update this vault before starting and after finishing every task**).
2. Then [[02 Roadmap and status]] (what exists, what's next) and the latest session log: [[Sessions/2026-10-01 to 17]].
3. [[09 Decisions log]]: decisions already made; don't re-open them.
4. The area you're touching: [[03 Architecture]] · [[04 Radar]] · [[05 Database]] · [[06 Website]] · [[07 Design]]
5. [[08 Accounts and secrets]] (where keys live; never values), [[10 How to run things]] (incl. the test commands), [[11 Gotchas]] (Windows shell traps).
6. Private context about the owner (their CV, goals) is in Claude's local memory folder, not here (this repo is public).

## State on 17 Oct 2026
- **Everything is live and healthy.** Radar: priority run every 30 min, full run every 6 h (Supabase pg_cron → GitHub Actions). ~24,000 open roles, newest within minutes. Website on Vercel (auto-deploys from `main`). Telegram: shared channel + personal alerts per user.
- **Users:** only the owner (two accounts: their main one and a second test account). Friends were invited but didn't sign up; owner is now thinking of charging classmates a **one-time £3** (see [[13 Ideas backlog#Paid version (owner, 17 Oct)]]).
- **Checks:** `python -m radar.checks` (124 pass) and `cd web && npx tsx scripts/checks.ts` (136 pass). Run both after any change to matching, tagging, readers or CV logic.

## IN PROGRESS (17 Oct): going paid and public
Plan approved by the owner (full text in [[13 Ideas backlog#Paid version (owner, 17 Oct)]] and the session log): **Phase 1 money** (open sign-ups, 2-day free trial limited to 5 jobs and 2 CVs, then **£5 one-off** via a **Stripe** payment link shown as "NIMBUS"; webhook unlocks; Admin members + settings; sign-up questions "applications planned" and "how did you hear"); **Phase 2 public website** (landing with animations, privacy/terms, app icons, free commercial hosting); **Phase 3 ads** (Remotion motion graphics, posters, daily "opened today" story, growth plan). Owner stays anonymous as "Nimbus".

## Open items (in order)
1. **Paid access (waiting on the owner):** offered to show the owner's payment link on the "Request sent" screen and add a **Paid** tick on Admin. Owner must send their Monzo/PayPal link first (keep it out of the repo: use a Vercel env var). Owner to make the Telegram channel **private with join requests** (steps in [[Sessions/2026-10-01 to 17#17 Oct]]).
2. **Coverage gaps:** Haleon, Reckitt, Johnson Matthey, Takeda, Lilly, Boston Scientific, Novo Nordisk, Charles River, Arm, BT, HSBC, Vodafone, Sage, Dell, Goldman (no obvious Workday board); Google, Microsoft, Amazon, Apple, Meta (own career sites, not read yet).
3. **Owner actions suggested, not confirmed:** Bright Network email frequency → most frequent; Profile → add Europe/USA/Canada/UAE to see abroad events.
4. Ideas in [[13 Ideas backlog]] (learned keywords per role type, Recruitee/Teamtailor readers, hidden opportunities, digests…).

## Map
- [[01 Vision and plan]] · [[02 Roadmap and status]] · [[03 Architecture]] · [[04 Radar]] · [[05 Database]] · [[06 Website]] · [[07 Design]]
- [[08 Accounts and secrets]] · [[09 Decisions log]] · [[10 How to run things]] · [[11 Gotchas]] · [[12 Working with the user]] · [[13 Ideas backlog]]
- Session logs: [[Sessions/2026-09-26 to 30]] · [[Sessions/2026-10-01 to 17]]
