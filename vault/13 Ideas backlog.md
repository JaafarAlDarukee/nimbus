# Ideas backlog

Back to [[00 Start Here]] · updated 2026-10-17

## Paid version (owner, 17 Oct)
- Owner wants classmates to pay a **one-time £3** (≤10 people). No monthly, no Stripe for now, no cash referrals.
- Plan agreed in chat: payment by Monzo/PayPal link → owner approves in Admin after the money lands (approval is the paywall).
- To build when the owner sends the link: show it on the "Request sent" screen (store it in a Vercel env var, not the repo) and a **Paid** tick / date per person on Admin. Maybe: personal alerts only for paid users; channel as a free teaser (few posts a day, a day late).
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
