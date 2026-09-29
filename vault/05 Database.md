# Database (Supabase)

Back to [[00 Start Here]] · project `nimbus`, ref `rwcpwqhjmhsxtslamudm`, region London (eu-west-2)

## Migrations (`supabase/migrations/`, apply with `npx supabase db push`)
1. `20260928000000_init.sql`: all core tables + RLS + realtime on opportunities.
2. `20260928230000_radar_trigger.sql`: pg_cron + pg_net + `public.dispatch_radar(workflow)`.
3. `20260930000000_onboarding.sql`: `profiles.first_name/last_name/onboarded_at`, Discord channel, `telegram_links`, private `cvs` storage bucket.
4. `20260930010000_access_requests.sql`: `access_requests` + `hook_before_user_created` (approval lock).
5. `20260930020000_first_user_admin.sql`: first account becomes admin.

## Tables
- Shared (read by signed-in users; written by the radar with the secret key): `companies`, `company_aliases`, `recruiting_routes`, `opportunities`, `company_news`.
- Radar internals (admins read): `sources` (board health), `checker_runs`.
- Per user (owner-only RLS): `profiles` (preferences jsonb, is_admin, names, onboarded_at), `notification_channels`, `applications` (tracker stages incl. ghosted/speculative), `calendar_events`, `alerts_sent`, `telegram_links`.
- `access_requests`: anyone can insert (email only); admins read/decide.

## Auth
- Invite by approval: `hook_before_user_created` refuses emails not approved in `access_requests` (enabled via `supabase/config.toml` + `npx supabase config push`).
- Owner's email is approved (added directly in the DB, not in the repo). Owner's profile: `is_admin = true`.
- Site URL `http://localhost:3000`, redirect `http://localhost:3000/**` (update when deployed).
- Emails currently use Supabase's default sender (only delivers to project members). Custom templates ready in `supabase/templates/` but need SMTP. See [[11 Gotchas#Supabase email]].

## Cron
`cron.job`: `nimbus-radar-priority` (`5,35 * * * *`) and `nimbus-radar-full` (`50 */6 * * *`), calling `dispatch_radar` with the GitHub token in **Vault** as `github_dispatch_token`.

## Storage
Bucket `cvs` (private, 5 MB, PDF/DOCX). Users may only touch `<their user id>/…`.

## Useful queries
Run with `npx supabase db query --linked "<sql>"` (see [[10 How to run things]]). Never select `vault.decrypted_secrets`.
