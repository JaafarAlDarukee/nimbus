# Ideas backlog

Back to [[00 Start Here]]

## Product
- **Hidden opportunities** (e.g. Yamazaki Mazak, Sony UK TEC): "hosts students" flags, opening predictions from past years, short-window catcher, speculative route (where/how to contact; the user contacts them), talent-pool forms.
- **Hiring posts** ("send your CV to…") from Google Alerts / Reddit into the inbox, with scam checks. Show contact + "Copy to Claude"; never send.
- **Company news** and hiring signals (company newsroom + Google News) → Companies page, interview prep, weekly digest, Discord #news.
- Sector tagging of opportunities (motorsport, aerospace, medtech…) so industries from onboarding can filter.
- Research sources: jobs.ac.uk RSS, EURAXESS, national labs, university summer research.
- More sources: JLR early-careers portal, Reed / Jooble APIs, Teamtailor, Recruitee, Personio, SuccessFactors/Oracle sites for big UK employers, Companies House discovery.
- Company logos (design uses favicons by domain; need a domain per company, fallback initial letter).
- WhatsApp (CallMeBot, personal use) and Discord alerts; daily 07:30 digest email; weekly digest.
- Chrome extension: autofill + passive capture of jobs the user views (optional, never automating Handshake).
- CV studio: ATS scoring, "Give me ideas" (Gemini), exports; owner will supply a CV template.

## Going live
- Deploy `web/` to Vercel (Hobby is non-commercial; fine for now). Set env vars there.
- Free domain from the GitHub Student Pack (Namecheap `.me` or `.tech`).
- Update Supabase Site URL + redirect URLs; SMTP via Nimbus Gmail; custom email templates on.

## Business
Free for friends now (student credits are non-commercial). If ever charging: sole trader registration, ICO fee, privacy policy/terms, Stripe, check data-source terms, paid tiers (Vercel Pro, Supabase Pro, WhatsApp API), drop anything relying on logged-in automation.
