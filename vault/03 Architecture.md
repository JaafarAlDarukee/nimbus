# Architecture

Back to [[00 Start Here]]

```
 Supabase pg_cron (every 30 min / 6 h) ──calls GitHub API──▶ GitHub Actions (public repo)
                                                           │  radar-priority.yml / radar-full.yml
 Employers' hiring systems, Adzuna, Nimbus Gmail ◀─reads── │  python -m radar.run
                                                           ▼
                                      Supabase Postgres (opportunities, sources, checker_runs…)
                                                           │
             Telegram (channel now; personal DMs next) ◀───┤  radar/notify/*
                                                           ▼
                          Website (Next.js 16, web/) ── Supabase Auth (invite by approval)
```

## Pieces
| Piece | Where | Notes |
|---|---|---|
| Radar (checker) | `radar/` (Python 3.12) | Runs in GitHub Actions, never on the home PC (IP safety). See [[04 Radar]] |
| Discovery | `radar/discover/` + `.github/workflows/discover.yml` | Weekly; Common Crawl → boards with UK jobs → `data/discovered/*.csv` |
| Database, auth, storage, cron | Supabase project `nimbus` (London) | See [[05 Database]] |
| Website | `web/` Next.js 16 + Tailwind 4 + shadcn (base-nova) | Local dev at http://localhost:3000; not deployed yet. See [[06 Website]] |
| Alerts | Telegram bot **@NimbusRadarBot**, channel **Nimbus Alerts** | See [[04 Radar#Alerts]] |
| Design | `design/` (git-ignored, local only) + Claude Design project | See [[07 Design]] |

## Why this shape
- GitHub Actions: free compute; repo made public for unlimited minutes. Logs are therefore **public** → never print personal data. See [[09 Decisions log]].
- Supabase cron: GitHub's own schedules were skipping runs; Supabase triggers them reliably (`public.dispatch_radar`).
- Personal data (profiles, CVs, trackers) only lives in Supabase with row-level security.
