# Accounts and secrets

Back to [[00 Start Here]]

**Rule: the owner creates accounts and types every password/key themselves. Claude never asks for, handles or prints secret values.** If a secret is ever pasted in chat, advise rotating it.

## Services
| Service | What | Notes |
|---|---|---|
| GitHub | repo `JaafarAlDarukee/nimbus` (public) | `gh` CLI logged in on the PC. Student Pack active |
| Supabase | project `nimbus`, ref `rwcpwqhjmhsxtslamudm`, London | CLI linked (`npx supabase ...`); owner logged in via `npx.cmd supabase login` |
| Telegram | bot **@NimbusRadarBot** (token was rotated once); channel **Nimbus Alerts**: the owner's own backup of everything (owner, 17 Oct: make it private, nobody else; payers get the personal bot) | Owner's private chat with the bot is used for admin DMs. Branding images in `design/telegram/` |
| Gmail | a dedicated "Nimbus" Gmail with 2-step verification + app password "Nimbus" | Used by the radar inbox (IMAP). Owner's main Gmail is NOT connected |
| Adzuna | developer API (app id + key) | Credit "Jobs by Adzuna" wherever its jobs show |
| Google AI Studio / Gemini | **not set up; owner declined ("forget about AI")** | Optional `GEMINI_API_KEY` in Vercel would switch on CV studio's dormant Free AI review |
| Stripe | **not created yet** (17 Oct): owner creates it; business name and statement descriptor **NIMBUS**, product "Nimbus lifetime access" £5, a Payment Link redirecting to `/pay?paid=1`, a webhook to the `stripe-webhook` Edge Function | The Payment Link URL is pasted on Admin (stored in `app_settings`, not the repo) |
| Vercel | Owner signed up with GitHub (Hobby), 1 Oct. Project `nimbus` (team slug `nimbus24`), root directory `web`, deploys on every push to `main`. Live at https://nimbus-pi-three.vercel.app | Env vars (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, pasted by the owner. Supabase `site_url` + redirect URLs point here (`supabase/config.toml`, config push). Custom domain: not yet. |

## Where each secret lives (names only)
- **GitHub Actions secrets**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (channel), `TELEGRAM_ADMIN_CHAT_ID` (owner's DM), `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`. List names with `gh secret list`.
- **Supabase Edge Function secrets**: `TELEGRAM_BOT_TOKEN` (bot webhook), `STRIPE_WEBHOOK_SECRET` (to add when Stripe is set up: the webhook endpoint's signing secret).
- **Supabase Vault**: `github_dispatch_token` (fine-grained GitHub PAT, nimbus repo only, Actions read/write, ~1 year expiry: renew before it lapses).
- **`web/.env.local`** (git-ignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable = safe in browsers).
- `.env.example` at the repo root lists every variable name.

## Owner's personal details
Not stored in this repo on purpose (public). The owner's profile is the admin (always counts as paid). The owner sells **anonymously as "Nimbus"**: Stripe's public name, the statement and the support email must not show their name.

## Email sending (since 1 Oct)
Supabase Auth → Emails → SMTP: host `smtp.gmail.com`, port 465, the Nimbus Gmail with an app password named **"Supabase"** (owner typed it), sender name **"Children of Khan"**. Rate limit 30 emails/hour (dashboard). Templates in `supabase/templates/` via `config push`.

## Job-site accounts (Nimbus Gmail, 1 Oct)
Gradcracker (follows all employer hubs), Higherin (saved searches), Bright Network (preferences + emails), TARGETjobs (tracker). LinkedIn alerts stay on the owner's own account; a Gmail filter forwards only `jobalerts-noreply@linkedin.com`.
