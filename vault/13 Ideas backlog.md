# Ideas backlog

Back to [[00 Start Here]] · updated 2026-10-17

## Paid version (owner, 17 Oct)
- First idea: one-time £3 by Monzo/PayPal with approval as the paywall. **Replaced the same day** by the approved plan: **£5 once via Stripe**, open sign-ups with a 2-day trial (5 jobs, 2 CVs), anonymous as "Nimbus", goal ~£300. Phases: money (done 17 Oct) → public website → ads and marketing. The full plan was written in Claude's plan file; its phases are summarised in [[00 Start Here#Going paid and public (plan approved 17 Oct)]].
- Phase 2 ideas: landing with an animated phone of Telegram alerts, how it works, what you get, fields, pricing, FAQ, live counts; privacy and terms pages; app icons and manifest; hosting that allows selling (Vercel Hobby is non-commercial: check Netlify / Cloudflare for Next.js 16 support).
- Phase 3 ideas: Remotion videos (9:16, 15-20 s: "It opened 2 minutes ago", "Your CV vs the job", "Every placement, one place"), QR posters, Instagram/TikTok templates, a daily "N placements opened today" story from the database, a 2-week posting plan, measure with "How did you hear" on Admin.
- Maybe later: channel as a free teaser (few posts a day, a day late).
- Channel: owner makes it private with join requests and removes non-payers (steps in [[Sessions/2026-10-01 to 17#17 Oct]]).
- Known caveats (owner informed, chose to ignore at this scale): Vercel Hobby is non-commercial; job-board listings (Gradcracker, Bright Network, Higherin, TARGETjobs, LinkedIn) shouldn't be resold; privacy page / ICO if it grows.

## Coverage
- Find boards: Haleon, Reckitt, Johnson Matthey, Takeda, Lilly, Boston Scientific, Novo Nordisk, Charles River, Arm, BT, HSBC, Vodafone, Sage, Dell, Goldman Sachs.
- Big tech career sites (Google, Microsoft, Amazon, Apple, Meta): own APIs; check robots/terms before reading.
- Readers: Recruitee, Pinpoint, Teamtailor, Personio (UK SMEs); jobs.ac.uk RSS; EURAXESS; Reed/Jooble APIs.
- Adzuna employers → research queue. JLR early-careers portal.

## Product
- CV checker: keywords learned per role type (partly done via `popularSkills`); tables/images checks for Word uploads.
- Free AI review (Gemini) is built and dormant; switch on only if the owner asks (they'd add `GEMINI_API_KEY` in Vercel).
- Hidden opportunities: "hosts students" flags, opening predictions, speculative routes, talent pools.
- Hiring posts with scam checks; company news; daily/weekly digest email; WhatsApp/Discord alerts.
- Chrome extension: autofill + passive capture (never automate Handshake/LinkedIn).
- Telegram: the bot's own menu (today's matches, tracker) and a Mini App.

## Matching (17 Oct)
- LinkedIn / TARGETjobs alert rows: read the employer from the email text (links don't name it), so the employer exclusion check works for them too.
- Owner might also like "Research" (KTP, research placements) or "Insight" types: suggest in Profile, don't change without asking.

## Suggested 17 Oct (late)
In order of importance (told to the owner):
1. **Hosting before charging**: Vercel's free Hobby plan is for non-commercial use only. Before taking money: Vercel Pro (~$20/month) or a free host that allows commercial use (Cloudflare / Netlify; check Next.js 16 support first).
2. **Stripe setup** (owner) + brand email on Admin (Privacy/Terms are now live, which Stripe asks for).
3. **Anonymity**: sign-in emails come from "Children of Khan" (Supabase SMTP sender name, dashboard) and the email footer says it too; the GitHub repo shows the owner's name.
4. **ICO data protection fee**: a paid service that stores personal data usually has to register with the ICO (about £50 a year; check the self-assessment on ico.org.uk).
5. **LinkedIn employer names** from the alert email text (153 rows "via LinkedIn"; also lets the defence check see the employer).
6. **More employers**: research boards for Haleon, Reckitt, Johnson Matthey, Takeda, Lilly, Arm, BT, Vodafone… and big tech's own sites.
7. **Delete my account** button in Profile (self-service privacy).
8. **Morning summary** in the bot ("Yesterday: 52 new: 8 placements…") for people who mute notifications.
9. **Landing page** (Phase 2) and **ads** (Phase 3) as planned.
- Stop saving roles outside the UK and Ireland in the radar (about 3/4 of open rows are abroad): smaller database, faster queries. Abroad events in events.csv are now unused.

## Email deliverability (18 Oct)
Sign-in emails go to spam: they're sent through a Gmail account via SMTP, with links to supabase.co / vercel.app. Real fix (owner): buy a domain (~£10/year, e.g. at Cloudflare), send through an email service (Resend: free up to 3,000 a month) with SPF, DKIM and DMARC records, sender "Nimbus <hello@yourdomain>"; also gives a brand email and a proper website address (helps Stripe and anonymity). Meanwhile: sender name "Nimbus" in Supabase → Auth → SMTP (dashboard), and ask people to mark the first email "Not spam".

## Suggested 18 Oct (owner: "how can we improve, be first to apply, hackathons abroad")
Nimbus (owner to pick):
1. **My companies watchlist**: 20-40 target employers, 🔔 alert the moment any role opens there (any type), those boards checked every 5 min; coverage check per company. Gaps seen 18 Oct: no open placements visible from Reckitt, Smith & Nephew, Siemens Gamesa (Hull), JLR, JCB, Dyson (none open, or their sites aren't read: JLR has its own portal). Blocked sites: sign the Nimbus Gmail up to each company's own job alerts.
2. **Opening soon**: remember when each employer opened roles before; Telegram heads-up a week ahead.
3. **Morning Telegram digest**: new since yesterday, closing this week and not applied, follow-ups due.
4. **Events abroad stream**: in-person engineering hackathons, competitions and summer programmes in Europe / North America / Middle East to the personal bot (or an Events channel); sources to check (terms first): Devpost and MLH (have), Junction, HackZurich, START Hack, EU space hackathons (Cassini, ActInSpace), IAESTE.
5. **Stage reminders**: online-test practice when a role moves to "Online test", interview prep when "Interview".
Owner (not code): CV numbers in every bullet + LinkedIn profile; 5-10 good applications a week through Nov-Dec, within 48 h of opening; Hull-local employers; IAESTE / university global-opportunities funding for summer abroad; spring weeks / insight days; Formula Student bullet with a number; Hull careers service mock interviews; numerical/SJT practice.

## Next sources (24 Oct)
- **Read only new links' pages** in job lists (skip roles already saved), so Reckitt/Kier/RWE can be checked every 15 minutes instead of 6 hours.
- **INEOS** (`careers.ineos.com/jobs/<id>/details`, no title in the link, no dates): needs its own reader.
- **Taleo** reader (Arup: `arupjobs.taleo.net`).
- JavaScript careers sites with no known hiring system: JCB, McLaren, Toyota UK, National Grid, Mott MacDonald, Ideal Heating, Network Rail, Balfour Beatty, Alstom, Yorkshire Water, Croda, Williams, Aston Martin, Honda. Look in the browser's network tab for the JSON they load (as with Oracle), one by one.
- Ford's current careers site (the Oracle one lists 0 jobs).
- Unreachable or robots.txt says no: BMW, Ørsted, Tata Steel, Spencer Group, AtkinsRéalis, WSP, Leyland (only via job-site emails).
- More hiring systems seen on UK sites: Recruitee, Teamtailor, Pinpoint, Eploy, Tribepad.
