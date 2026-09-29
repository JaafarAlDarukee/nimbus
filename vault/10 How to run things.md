# How to run things

Back to [[00 Start Here]] · the PC is Windows; the Claude session has PowerShell and Git Bash. Project root: `C:\Users\MSI\Documents\nimbus`.

## First thing in any PowerShell command
New tools aren't on the app's PATH until refreshed:
```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

## Radar
- Local dry run: `.\.venv\Scripts\python.exe -m radar.run --tier priority --dry-run` (add `--only "Rolls-Royce"`).
- On GitHub: `gh workflow run radar-priority.yml` (inputs: `-f only=Adzuna -f dry_run=true`), `gh workflow run radar-full.yml`, `gh workflow run discover.yml`, `gh workflow run telegram-setup.yml`.
- Watch: `gh run list --limit 5`, `gh run watch <id>`, `gh run view <id> --log`.

## Database
- New migration: add `supabase/migrations/<timestamp>_<name>.sql`, then `npx --yes supabase db push --yes`.
- Query: `npx --yes supabase db query --linked "select …"`.
- Auth settings live in `supabase/config.toml`; preview with `'n' | npx --yes supabase config push`, apply auth only with `@('y','n') | npx --yes supabase config push` (the second answer declines storage). Keep unrelated values matching the live project first (see [[11 Gotchas]]).

## Website
- Dev server: `preview_start web` (Claude browser pane) or `npm --prefix web run dev` → http://localhost:3000.
- Type-check: `npx tsc --noEmit` inside `web/`. Build: `npm run build` inside `web/`.
- Design reference server: `preview_start design` → http://localhost:8765.

## Git
- Commit messages via a file (`git commit -F file`) when they contain quotes; end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `git pull --rebase` before push (discovery workflow commits to `data/discovered/`).

## Secrets (owner runs these)
`gh secret set NAME` then paste (input hidden). See [[08 Accounts and secrets]].
