# Decisions log

Back to [[00 Start Here]] · newest last. Don't re-open these without the owner asking.

- **2026-09-26 · Build our own instead of paying for Runway.** Runway is US-only anyway.
- **2026-09-26 · Name: Nimbus** ("Opportunities, the moment they form."). Calm, minimal, like Runway/Linear. Earlier names (Undercut, F1 wording) were rejected as cringe.
- **2026-09-28 · Intelligence radar, not a bot.** Nimbus never emails or messages employers. It shows company, role, location, apply link, disciplines/skills and *published* contacts; the user applies or emails themselves. No auto-mailer.
- **2026-09-28 · Crawl in GitHub Actions, not on the home PC** (IP safety). Prefer structured sources: hiring-system APIs, RSS, sitemaps, before custom portals. Respect blocks (e.g. BAE's 403): never bypass.
- **2026-09-28 · AI**: Gemini free tier for parsing/scoring; "Copy to Claude" prompts for CV/cover letters. Local Ollama dropped (GTX 1660 Super too small).
- **2026-09-28 · Stack**: Next.js + Tailwind + shadcn on Vercel, Supabase free tier. No tablet/24-7 PC.
- **2026-09-28 · Supabase pg_cron triggers the radar** because GitHub's cron skipped most runs.
- **2026-09-28 · Exclusions**: no Airbus, BAE Systems, Boeing, or anything nuclear / weapons / defence (companies and roles). Rolls-Royce kept for civil roles only. Defence/Nuclear/Fusion industries not offered in onboarding.
- **2026-09-29 · Repo made public** for unlimited GitHub Actions minutes (owner OK'd). Consequence: no personal data in commits or CI logs; logs print counts only.
- **2026-09-29 · Channel alerts: engineering-type UK roles only**; first check of a new board is silent; only jobs posted in the last 7 days alert.
- **2026-09-29 · Inbox privacy**: forward only `jobalerts-noreply@linkedin.com` from the main Gmail; sign up to other sites' alerts with the Nimbus Gmail directly. Nimbus never reads the main inbox.
- **2026-09-29 · Owner's own design (Claude Design handoff) replaces my concept board.** High fidelity.
- **2026-09-30 · Invite by approval**: request access → owner approves on `/admin` (pinged on Telegram) → sign-in email. Enforced by a Supabase before-user-created hook. First account = admin.
- **2026-09-30 · Honest UI**: features not built yet show "Soon"; no fake scores or counts.

## Exclusions
No Airbus, BAE Systems, Boeing, or any nuclear / weapons / defence company or role. Enforced in `radar/pipeline/exclusions.py` (companies, title words, repeated description words) and in onboarding options (`web/src/lib/onboarding-data.ts`). Rolls-Royce: civil roles only. See [[04 Radar#Exclusions]].

## 2026-10-01
- CV studio's ATS score weights: keywords 40%, impact 25%, layout 20%, sections 15%. A summary section is marked as "improve" (r/EngineeringResumes drops it for students). One page is the rule.
- **Shared Telegram channel stays** for anyone interested; everyone also gets private alerts (owner's choice).
- **Adzuna is back**, labelled "via Adzuna" (it's ~5 days behind and links to job boards). Owner: coverage matters more than the delay.
- **CV template**: the r/EngineeringResumes template is the main CV format (owner's choice).
- **ATS**: build our own checker in the website (owner's choice), not a third-party service.
- **AI**: no Gemini key for now (owner doesn't want to manage keys); use built-in ideas + "Copy to Claude" prompts.
- Sites that block tools (robots.txt Disallow, 403) are never read; they get a "How to get in" route instead and their roles come via job-alert emails.
- **2026-10-01 · No in-browser AI model**: a local model would be hundreds of MB per phone, slow and weaker than Claude. Instead: rule-based tailoring and checks (explainable, never invents) + one-click Tailor with Claude. A built-in AI via the Anthropic API is offered to the owner (needs their key in Vercel; pennies per CV); Gemini free tier not used for CVs because Google may use free-tier data.
- **2026-10-01 · Soft skills**: kept in Skills only when the advert asks for them (screening software counts them); otherwise shown in bullets.
- **2026-10-01 · No built-in AI for now** (owner): CV help is the rules + example CV + a step-by-step "attach your CV and this prompt to Claude or Gemini" guide. The Gemini review code stays, switched off without a key.

## 2026-10-17 · Paid and public
- **Price: £5 once, lifetime access** (owner). Not monthly. Replaces the earlier "£3 by Monzo/PayPal" idea.
- **Stripe Payment Link** (checkout and statement show "NIMBUS"), unlocked automatically by a webhook. Owner chose Stripe after first saying no to it.
- **Open sign-ups with a 2-day free trial** limited to **5 jobs, 2 CVs** (and 5 personal Telegram alerts), then pay. Replaces invite by approval.
- **Anonymous**: sold as "Nimbus"; the owner's name never shows.
- Order: **money → website → ads and marketing**.
- Under £1,000 a year is covered by the UK trading allowance (no registration). Claude won't help hide income above it.

## 2026-10-17 · Matching
- **No % match score** (owner: "more like a guess"). Ticks with the real facts + a label (Top match / Good match / Worth a look) worked out from them, on the site and in Telegram.
- **Each role once** per person, however many sources list it (30-day memory for Telegram).
- "Worth a look" roles (general "Engineering role" titles) are still sent: they include many good placements (Cummins Quality, Curtins, Sulzer), ranked after Top/Good.

## 2026-10-17 (night) · Show everything
- **For you and personal alerts show every type and the whole field** ("I want to show everything, I don't want to hide"; a Mechanical student sees Chemical roles too). Split by type: columns on a computer, tabs on a phone.
- **No labels** (Top/Good/Worth a look) and **no CV skills** in matching (many adverts don't list skills).
- **Personal bot = notifications; applying goes through the Nimbus website** ("Open on Nimbus"), so people sign in / pay. One message per role, as soon as found.
- **Main channel stays exactly as it is, for the owner only** (their backup if the system fails); not given to payers.
- **Radar every 15 min.** A server for faster checks is fine with the owner if needed later.

## 2026-10-17 (late)
- **The personal bot never has less than the main channel** (owner) for engineering students.
- Claude chose and published: trial-ending reminder, Privacy/Terms (refunds within 14 days, owner can change), app icon. The owner asked for suggestions to be made and published.

## 2026-10-17 (latest) · Main channel
- **Main channel = every new role, no filter**, owner only (replaces "engineering-type UK roles only" from 29 Sep). UK/IE one message each, the rest as lists. **Personal bots are the filtered version.**

- **2026-10-17 · Field channels**: the owner's own private channels per field (Engineering, Medical & health, Business, Computing, Science, Creative), everything instantly, UK & Ireland only; main everything-channel kept. Computing (software, data, cyber, AI) is its own field; a role that is both (embedded software) goes to both channels.
- **2026-10-17 · Channels are UK and Ireland only** (owner: "for now"); the radar still saves roles elsewhere for people who chose those places.
- **2026-10-17 · Website: UK and Ireland only**; no location question.
