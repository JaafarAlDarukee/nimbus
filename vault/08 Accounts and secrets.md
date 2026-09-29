# Accounts and secrets

Back to [[00 Start Here]]

**Rule: the owner creates accounts and types every password/key themselves. Claude never asks for, handles or prints secret values.** If a secret is ever pasted in chat, advise rotating it.

## Services
| Service | What | Notes |
|---|---|---|
| GitHub | repo `JaafarAlDarukee/nimbus` (public) | `gh` CLI logged in on the PC. Student Pack active |
| Supabase | project `nimbus`, ref `rwcpwqhjmhsxtslamudm`, London | CLI linked (`npx supabase ...`); owner logged in via `npx.cmd supabase login` |
| Telegram | bot **@NimbusRadarBot** (token was rotated once); channel **Nimbus Alerts** | Owner's private chat with the bot is used for admin DMs |
| Gmail | a dedicated "Nimbus" Gmail with 2-step verification + app password "Nimbus" | Used by the radar inbox (IMAP). Owner's main Gmail is NOT connected |
| Adzuna | developer API (app id + key) | Credit "Jobs by Adzuna" wherever its jobs show |
| Google AI Studio / Gemini | not set up yet | For parsing/CV features later |
| Vercel, domain | not set up yet | See [[13 Ideas backlog]] |

## Where each secret lives (names only)
- **GitHub Actions secrets**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (channel), `TELEGRAM_ADMIN_CHAT_ID` (owner's DM), `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`. List names with `gh secret list`.
- **Supabase Vault**: `github_dispatch_token` (fine-grained GitHub PAT, nimbus repo only, Actions read/write, ~1 year expiry: renew before it lapses).
- **`web/.env.local`** (git-ignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable = safe in browsers).
- `.env.example` at the repo root lists every variable name.

## Owner's personal details
Not stored in this repo on purpose (public). The owner's email is approved in `access_requests` in the database; their profile is the admin.
