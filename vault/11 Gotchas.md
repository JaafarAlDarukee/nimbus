# Gotchas (learned the hard way)

Back to [[00 Start Here]]

## Windows / PowerShell
- `npx` in the owner's terminal: scripts are blocked (execution policy). Use **`npx.cmd`** instead of `npx` in instructions for the owner. (Claude's own PowerShell tool can run `npx`.)
- `Set-Content -Encoding utf8` in PowerShell 5.1 writes a **BOM**; write files with the Write tool or `[IO.File]::WriteAllText(..., New-Object System.Text.UTF8Encoding $false)`.
- Double quotes inside PowerShell here-strings break `git commit -m`: use `git commit -F <file>`.
- `jq` strings with spaces inside `gh ... --jq '...'` break in PowerShell; use the Bash tool for jq, or simpler output.
- Editing Python regexes through a Bash heredoc into a Python string can turn `\b` into a backspace character. Use the Edit tool for regex lines, then check with `od -c`.
- Long Bash heredocs with JS template strings can break (`unexpected EOF`) or turn `\n` into real newlines: write the script to the scratchpad with the Write tool and run it.
- If the in-app browser pane is hidden, screenshots time out: use `get_page_text` / `find` and retry screenshots later.
- The in-app browser pauses CSS animations in a background tab: a drawer can look half-transparent in a screenshot. Bring the tab to the front before judging.
- Design files use `content-box` and `line-height: normal`; Tailwind uses `border-box` and 1.5 (see [[07 Design]]).
- `Set-Location` persists between PowerShell calls; return to the project root afterwards.

## GitHub
- Scheduled workflows get delayed/skipped, especially at :00/:30 → Supabase pg_cron triggers them.
- Public repo = public logs: print counts only, never emails, names, chat ids or job lists from inboxes.

## Common Crawl (discovery)
- The index is overloaded: 503, 504, cut-off responses and dropped connections. `radar/discover/commoncrawl.py` retries, second-passes failed pages, and combines 3 crawls. A bad run can only add boards (merge), never shrink.

## Supabase email
- The built-in email sender only delivers to **project members** (the owner) and is rate-limited; the free plan **won't allow custom email templates** without your own SMTP.
- Before inviting friends: set SMTP to the Nimbus Gmail (Auth → SMTP settings, app password typed by the owner), then uncomment the templates in `supabase/config.toml` and `config push`.
- Login links requested from the landing page use PKCE → must be opened in the **same browser**. Approval emails use the implicit flow → work anywhere (`/auth/confirm`).

## Supabase config push
- It pushes every declared auth setting. Before pushing, preview and set unrelated local values to match the live project (we matched: `max_frequency = "1m0s"`, `otp_length = 8`, MFA TOTP enroll/verify = true, storage analytics enabled/max_namespaces = 10).

## Workday
- Country filter can be nested inside a location group; some tenants return duplicate postings across pages (dedupe by URL). Names come with codes ("GBA0 Revvity"): clean with `pipeline/names.py`.

## Telegram
- A bot can't message anyone until they message it first (Start). Channel posts need the bot as channel admin. `telegram-setup.yml` lists chat ids that messaged the bot.
- Workday rate-limits per server group (`wd1.myworkdayjobs.com`), not per company subdomain.
- Supabase Edge Functions: deploy with `npx supabase functions deploy <name> --use-api --no-verify-jwt` (no Docker needed). Their secrets are separate from GitHub's: set in dashboard → Edge Functions → Secrets.
- Telegram webhooks and `getUpdates` can't both work: with the webhook set, the old `telegram-setup` workflow (getUpdates) returns nothing.
- `radar.reclassify` must be re-run after changing classify/names rules; the radar only fixes new rows.

## Reclassify and type hints
- Until 1 Oct 2026 the store didn't save the hiring system's type fields, so `radar.reclassify` closed 1,190 roles whose type came from those fields (SmartRecruiters "intern", Devpost hackathons). Fixed in code. Rows still to reopen (owner approval needed for the bulk update): `status='closed' and last_seen_at > now()-3 days and (closes_at is null or closes_at > now()-1 day)` where `kind_for(title, None)` is None, not staff, not excluded.
- Bulk `update` statements on the live database are blocked by the safety check unless the owner approves; ask first.
- Shell heredocs on this PC still turn `\b` into a backspace character inside Python strings: write patch scripts with the Write tool, then grep for `\x08`.
