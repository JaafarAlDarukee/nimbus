# Nimbus

*Opportunities, the moment they form.*

A private radar for UK engineering placements, internships, grad schemes, research roles and
unadvertised opportunities. Nimbus finds them and alerts you with the link, the key details and
published contact routes. You decide what to apply for and who to contact; Nimbus never
messages anyone on your behalf.

## Layout

| Folder | What it is |
|---|---|
| `web/` | Dashboard: Next.js + Tailwind + shadcn/ui, hosted on Vercel |
| `radar/` | Python crawler run by GitHub Actions |
| `supabase/` | Database schema (`migrations/`) and server functions (`functions/`) |
| `data/seed/` | Starting list of companies |
| `.github/workflows/` | Schedules: priority radar every 30 min, full radar every 2 h, digests |

## Keys

Every key the project uses is listed in `.env.example`. Real values never go in git.
