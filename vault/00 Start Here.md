# Nimbus: start here

Nimbus is a private job radar for UK students, built by the owner (a 2nd-year mechanical engineering student, first time coding) for themselves and their classmates ("Children of Khan"). It watches thousands of employers' own careers pages plus job-site alert emails, finds placements / internships / grad schemes / events the moment they open, and alerts people on Telegram. It also has a tracker, calendar, companies directory and a CV studio with a checker. **It never applies or messages employers for anyone.**

Live site: **https://nimbus-pi-three.vercel.app** (open sign-ups: 2 days free, then **£5 once** for lifetime access) · Repo: `JaafarAlDarukee/nimbus` (**public**: never commit personal data) · Bot: **@NimbusRadarBot** · Channel: **Nimbus Alerts**

## If you are Claude starting a new session
1. Read [[12 Working with the user]] first: how to talk to the owner, and their standing rules (incl. **update this vault before starting and after finishing every task**).
2. Then [[02 Roadmap and status]] (what exists, what's next) and the latest session log: [[Sessions/2026-10-01 to 17]].
3. [[09 Decisions log]]: decisions already made; don't re-open them.
4. The area you're touching: [[03 Architecture]] · [[04 Radar]] · [[05 Database]] · [[06 Website]] · [[07 Design]]
5. [[08 Accounts and secrets]] (where keys live; never values), [[10 How to run things]] (incl. the test commands), [[11 Gotchas]] (Windows shell traps).
6. Private context about the owner (their CV, goals) is in Claude's local memory folder, not here (this repo is public).

## State on 17 Oct 2026
- **Everything is live and healthy.** Radar: priority run every 15 min, full run every 6 h (Supabase pg_cron → GitHub Actions). ~24,000 open roles, newest within minutes. Website on Vercel (auto-deploys from `main`). Telegram: shared channel + personal alerts per user.
- **Users (17 Oct):** 5 website accounts (owner included), 3 finished sign-up, 2 on personal Telegram alerts; 5 people in the channel.
- **Checks:** `python -m radar.checks` (171 pass) and `cd web && npx tsx scripts/checks.ts` (162 pass).
- **Website and channels cover the UK and Ireland only** (owner, 17 Oct, last). Newest summary for the owner: Session log "18 Oct: recap". Run both after any change to matching, tagging, readers or CV logic.

## Done 19 Oct: the five job-search improvements (all in Telegram)
1. **Watchlist**: bot commands `/watch A, B`, `/unwatch A`, `/watchlist` (supabase/functions/telegram `onWatch`, `coverage`): stored in `profiles.preferences.watch`; each company shows ✅ careers site read / 📧 job-site emails only / ❓ not covered (noted in `company_suggestions`). Watched companies' roles (any student type, engineering only) alert first with 🔔 (`personal.watched_as`, `WATCH_KINDS`). **Checked every 5 minutes**: `radar-watch.yml` (`run.py --watch`, own concurrency group), pg_cron `nimbus-radar-watch` `*/5`. Owner hasn't added companies yet (suggested list given).
2. **Opening soon**: `watch_status()` shows open now / last opened / "usually opens around" from the same employer's first placement last season (works once there's a year of history, i.e. from autumn 2027).
3. **Morning digest** 07:30 UK (`send_morning_digest`, `profiles.digest_sent_on`): new since yesterday, closing in 7 days not applied (direct links), your companies, Mondays: upcoming in-person events.
4. **Events in the bot**: in-person hackathons, competitions, fairs in UK/IE/Europe/North America/Middle East (`wanted_event`), "(abroad)" shown; 68 abroad + 16 UK upcoming on 19 Oct.
5. **Stage buttons**: after Applied → Online test / Interview / Offer / Rejected update the tracker and send tips (`STAGES`, `stageTips`).
Checks: radar 184. Owner also asked about an "AI agent that watches for me": answered with options (Claude API in the radar to judge fit and tailor CV bullets per alert; needs the owner's Anthropic API key in GitHub secrets; costs per month from the claude-api skill: Opus 5.5 ~$15-22, Sonnet 5.5 ~$7-11, Haiku 5.5 under $1 for ~30 adverts a day). Waiting for the owner's choice.

## NOW (18 Oct, night): Nimbus is PRIVATE, for the owner only
Owner: "might just close it and not give it to anyone… make it for me only, with no payment, no nothing". Done with switches, not deletions: `PRIVATE = true` in `web/src/lib/access.ts` and `radar/notify/personal.py`. Only admins get into the website (others see `/private`), personal Telegram alerts only for admins, **no trial or payment messages to anyone** (friends' trials were about to end), `/pay`, `/pricing`, `/terms` off, Admin hides money/payment/invites, **no new accounts** (`[auth] enable_signup = false`, config push). The paid plan, Stripe steps and Phase 2/3 below are **on hold**. To reopen: set both `PRIVATE` to false and `enable_signup = true`, config push. Data, tables and the `stripe-webhook` function are untouched (unused). Owner's answers (18 Oct): **delete the 4 other accounts** (owner does it in the Supabase dashboard: Authentication → Users; then Storage → cvs leftover folders (2 CV files) and Table Editor → access_requests (5 rows) — Claude can't permanently delete data itself); owner removes people from the main channel; **personal bot = placements, internships, spring weeks and insight days only** (`BOT_KINDS` in personal.py; ~26 a day last week), website unchanged (owner barely uses it).

## Done 18 Oct: real opening dates, defence opt-in, Abroad tab, pricing page, louder trial
- **opened_at** (migration `20261018000000_opened_at_defence.sql`): employer's posted date, or the earliest near-identical role at the same employer (`set_opened_at`, called by the radar after saving). The feed sorts by it; "Just opened" only for employer-site roles; job-site finds say "via Gradcracker" and old ones "listed since 30 Sep"; alerts only for roles opened in the last week. Example: a Caterpillar placement emailed by Gradcracker on 18 Oct now opens 19 Sep (as on Caterpillar's site). Backfill: 1,546 of 5,812 open UK/IE roles opened over a day before Nimbus found them.
- **Defence roles opt-in** (owner's change; CLAUDE.md updated): kept with `defence = true`, hidden unless Profile → "Defence and nuclear roles" → Show them; never in channels. First run saved 458 (56 UK/IE).
- **Abroad tab** on Opportunities (roles outside UK/IE, "(abroad)"); For you/All stay UK/IE.
- **/pricing** (public): free trial vs £5 once, what you get (`PAID_FEATURES` in lib/access.ts, also on /pay), "when do you hear about a role" bars (honest: employer site / Nimbus within ~30 min / job sites hours to weeks).
- **Trial**: banner bigger, orange in the last 12 h; bot tells new trial users when the trial ends; the 12-hour reminder was already live.
- **Emails**: signed "Nimbus". Spam fix needs the owner: own domain + email service (see [[13 Ideas backlog#Email deliverability (18 Oct)]]).
- Asked the owner what "the website is still unusable" means exactly.

## Field channels (17 Oct, built; waiting for the owner to create them)
The owner's private Telegram channels per field, everything instantly, UK & Ireland: **Engineering, Medical & health, Business, Computing, Science, Creative**. Main everything-channel stays. **Owner's steps:** in Telegram make a private channel → Administrators → add **@NimbusRadarBot** (Post Messages on) → the bot DMs "✅ Nimbus can post in …" → Admin → "Your Telegram field channels" → pick the field → Save. Repeat per field. Only channels added by the owner's own connected Telegram register. Details: [[04 Radar#Field channels (17 Oct)]].

## Main channel = everything in the UK and Ireland (17 Oct, latest)
**Update:** owner cancelled the rest of the world ("focus on UK and Ireland for now"): the main channel posts every new UK and Ireland role, no abroad lists. The paragraph below describes the earlier worldwide version.

The owner's channel ("Children of Khan" branding) now posts **every new role the radar finds** (all subjects, types and countries), to show the radar is working; it's for the owner only. UK and Ireland roles one message each (up to 60 a check), the rest as lists (~15 roles a message, linked). ~7,000 new roles a week (~1,740 UK/IE, ~4,100 abroad). **Personal bots stay filtered** (their matches + every UK/IE engineering, computing and science role for engineering students) and are sent **before** the channel. See [[04 Radar#Main channel posts everything (17 Oct, latest)]].

## Done 17 Oct, late: the bot gets everything the channel posts, + improvements
- **Personal bot ⊇ main channel** for engineering students: computing and science roles, Ireland, untagged technical titles (last week that was 158 roles the bot had missed). For you also shows computing and science for engineers.
- **Trial reminder** on Telegram ~12 h before a free trial ends (once).
- **Privacy** and **Terms** pages (public; 14-day refund rule; contact email set on Admin, shown once the owner adds the brand email).
- **App icon + manifest**: "Add to Home screen" shows the Nimbus cloud.
- Suggestions given to the owner (not built): see [[13 Ideas backlog#Suggested 17 Oct (late)]].

## Done 17 Oct night: show everything, split by type, apply through Nimbus, every 15 min
Owner's decisions, all live: For you and personal alerts show **every type** and **every subject in the user's field** (a Mechanical student sees Chemical, Civil, Electrical, general engineering, apprenticeships, graduate jobs…); the "what kind of opportunities" sign-up question is gone. **For you on a computer = 4 side-by-side columns** (Placements & internships · Graduate jobs · Apprenticeships · Events & research); **phone = type tabs with counts**. **No Top/Good/Worth-a-look labels, no CV-skills ticks** (facts only). **Personal bot: one message per role, type on top, up to 30 per check, "Open on Nimbus"** (website first, so people sign in / pay, then the employer). **Main channel unchanged and private for the owner only** (no invite for payers). **Radar every 15 min.** Sign-in email now also has a **6-digit code** (works inside Telegram/Instagram browsers) and signing in returns to the role tapped. Replay of the owner's last week: **360 alerts (~51 a day)** instead of 58. Details: [[06 Website#Show everything, split by type (17 Oct night)]], [[04 Radar#Changes 2026-10-17 (night)]].

## Done 17 Oct evening: better personal alerts, ticks instead of %
Owner: personal Telegram had "a small number of jobs and most of them are bad"; the "80% match" felt like a guess. Now: **ticks + label** (Top match / Good match / Worth a look) from facts only, on the site and in Telegram; **each role sent once** however many places list it; stricter subject words; Bright Network / Higherin employers read from the link. Replaying the owner's last week: 76 alerts instead of 58 (16 repeats/wrong-field removed, 34 real placements added). **Found and fixed: 43 open BAE Systems / MBDA / AWE / Babcock roles** were showing because "via Bright Network" hid the employer; closed by reclassify. Details: [[04 Radar#Changes 2026-10-17 (evening)]], [[06 Website#Match: facts, not a score (17 Oct)]].

## Going paid and public (plan approved 17 Oct)
Owner stays anonymous as "Nimbus". Full plan in [[13 Ideas backlog#Paid version (owner, 17 Oct)]].
- **Phase 1 money: built and live (17 Oct).** Open sign-ups; 2-day free trial with 5 jobs, 2 CVs and 5 personal Telegram alerts; then `/pay` (**£5 once** via a Stripe Payment Link); the `stripe-webhook` Edge Function unlocks the account; Admin shows money, members (Mark paid) and the payment links. Details: [[06 Website#Paid access (17 Oct)]], [[05 Database#Paid access (17 Oct)]]. **Waiting on the owner's Stripe setup** (open item 1). Until the Stripe link is pasted on Admin, `/pay` says "Payments open very soon".
- **Phase 2 public website** (next): landing with animations, privacy/terms, app icons, hosting that allows selling. Anonymity gap to raise with the owner: the public GitHub repo's account name shows their real name (options: a new brand GitHub account, or a private repo, which loses unlimited Actions minutes).
- **Phase 3 ads**: Remotion motion graphics, posters, daily "opened today" story, growth plan.

## Open items (in order)
0. **LinkedIn / TARGETjobs alert rows** (153 open) still have no employer name ("via LinkedIn"): their links don't include it. Title and description exclusion checks still apply, but the employer check can't. Next: read the employer from the email text (LinkedIn alert emails list title, company, place).
1. **Owner's Stripe setup** (Claude guides click by click; the owner types every detail and key):
   1. Create a **Stripe** account. Public business name and statement descriptor: **NIMBUS**. Support email: a brand email without the owner's name (make a new "Nimbus" Gmail if needed).
   2. Product **"Nimbus lifetime access"**, £5, one-off. Create a **Payment Link**; after payment, redirect to `https://nimbus-pi-three.vercel.app/pay?paid=1`.
   3. Developers → Webhooks → add endpoint `https://rwcpwqhjmhsxtslamudm.supabase.co/functions/v1/stripe-webhook`, event `checkout.session.completed` (and `checkout.session.async_payment_succeeded`). Copy its **signing secret** into Supabase → Edge Functions → Secrets as `STRIPE_WEBHOOK_SECRET`.
   4. On **Admin → Payment link and contact**, paste the Payment Link and the brand contact email (it appears on Privacy and Terms, which Stripe asks for).
   5. Telegram: make **Nimbus Alerts** private and remove everyone else: it's the owner's own backup now (owner, 17 Oct). Paying users get the personal bot, not the channel.
   6. Test in Stripe **test mode** first (a test account, test card), then switch the link to live.
2. **Coverage gaps:** Haleon, Reckitt, Johnson Matthey, Takeda, Lilly, Boston Scientific, Novo Nordisk, Charles River, Arm, BT, HSBC, Vodafone, Sage, Dell, Goldman (no obvious Workday board); Google, Microsoft, Amazon, Apple, Meta (own career sites, not read yet).
3. **Owner actions suggested, not confirmed:** Bright Network email frequency → most frequent; more LinkedIn job alerts (engineering placement / internship / graduate / apprenticeship, UK) forwarded to the Nimbus Gmail; create the field channels; decide hosting before charging (Vercel Hobby is non-commercial); stop saving abroad roles in the radar? (asked 17 Oct, no answer yet).
4. Ideas in [[13 Ideas backlog]] (learned keywords per role type, Recruitee/Teamtailor readers, hidden opportunities, digests…).

## Map
- [[01 Vision and plan]] · [[02 Roadmap and status]] · [[03 Architecture]] · [[04 Radar]] · [[05 Database]] · [[06 Website]] · [[07 Design]]
- [[08 Accounts and secrets]] · [[09 Decisions log]] · [[10 How to run things]] · [[11 Gotchas]] · [[12 Working with the user]] · [[13 Ideas backlog]]
- Session logs: [[Sessions/2026-09-26 to 30]] · [[Sessions/2026-10-01 to 17]]
