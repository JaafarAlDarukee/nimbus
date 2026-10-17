# Database (Supabase)

Back to [[00 Start Here]] · project `nimbus`, ref `rwcpwqhjmhsxtslamudm`, region London (eu-west-2)

## Migrations (`supabase/migrations/`, apply with `npx supabase db push`)
1. `20260928000000_init.sql`: all core tables + RLS + realtime on opportunities.
2. `20260928230000_radar_trigger.sql`: pg_cron + pg_net + `public.dispatch_radar(workflow)`.
3. `20260930000000_onboarding.sql`: `profiles.first_name/last_name/onboarded_at`, Discord channel, `telegram_links`, private `cvs` storage bucket.
4. `20260930010000_access_requests.sql`: `access_requests` + `hook_before_user_created` (approval lock).
5. `20260930020000_first_user_admin.sql`: first account becomes admin.
6. `20261017000000_paywall.sql`: paid access (see below).

## Tables
- Shared (read by signed-in users; written by the radar with the secret key): `companies`, `company_aliases`, `recruiting_routes`, `opportunities`, `company_news`.
- Radar internals (admins read): `sources` (board health), `checker_runs`.
- Per user (owner-only RLS): `profiles` (preferences jsonb, is_admin, names, onboarded_at), `notification_channels`, `applications` (tracker stages incl. ghosted/speculative), `calendar_events`, `alerts_sent`, `telegram_links`.
- `access_requests`: anyone can insert (email only); admins read/decide. History only since open sign-ups (17 Oct).
- `payments`, `app_settings`: see Paid access below.

## Paid access (17 Oct)
- `profiles.paid_at` (null = unpaid), `profiles.trial_ends_at` (default now() + 2 days; existing accounts got 2 days from 17 Oct), `profiles.trial_notice_at` (when the bot sent "your trial ended"). Users can't write these columns (column grants); the webhook (service role) and admin functions do.
- `payments` (user, amount in pence, currency, unique Stripe session): admins read.
- `app_settings(key, value)`: `stripe_link` and `channel_invite`. Signed-in users read `stripe_link`; `channel_invite` only paid users and admins; admins write.
- `admin_members()` and `admin_set_paid(target, paid)`: SECURITY DEFINER, check the caller is admin.
- Edge Function `stripe-webhook` (`supabase/functions/stripe-webhook/`, `verify_jwt = false`): checks `Stripe-Signature` (HMAC-SHA256 with `STRIPE_WEBHOOK_SECRET`, 5-minute window), then on a paid `checkout.session.completed` sets `paid_at` for `client_reference_id` (or the account with the payer's email) and records the payment. No match → logs it; mark paid by hand in Admin.
- Known gap (accepted at this scale): trial users could read every role straight from the API; the limits are in the website and the radar.

## Auth
- **Open sign-ups since 17 Oct**: `[auth.hook.before_user_created] enabled = false` (config push). The hook and `access_requests` still exist; switch the hook back on to return to invite-only.
- Owner's email is approved (added directly in the DB, not in the repo). Owner's profile: `is_admin = true`.
- Site URL `http://localhost:3000`, redirect `http://localhost:3000/**` (update when deployed).
- Emails go through custom SMTP (the Nimbus Gmail, set in the dashboard, not in config.toml) with the Nimbus templates in `supabase/templates/` (live since 2026-10-01). Gmail allows a few hundred emails a day: fine for friends.

## Cron
`cron.job`: `nimbus-radar-priority` (`5,35 * * * *`) and `nimbus-radar-full` (`50 */6 * * *`), calling `dispatch_radar` with the GitHub token in **Vault** as `github_dispatch_token`.

## Storage
Bucket `cvs` (private, 5 MB, PDF/DOCX). Users may only touch `<their user id>/…`.

## Useful queries
Run with `npx supabase db query --linked "<sql>"` (see [[10 How to run things]]). Never select `vault.decrypted_secrets`.
