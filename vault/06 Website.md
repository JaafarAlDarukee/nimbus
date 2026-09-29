# Website

Back to [[00 Start Here]] · code in `web/` (Next.js 16.3, React 19, Tailwind 4, shadcn base-nova)

> Next.js 16 differs from older versions: `middleware` is now `src/proxy.ts`; `cookies()`, `params`, `searchParams` are async; read `web/node_modules/next/dist/docs/` before using unfamiliar APIs (see `web/AGENTS.md`).

## Routes
| Route | File | Status |
|---|---|---|
| `/login` (Landing) | `src/app/login/page.tsx`, `login-form.tsx` | ✅ design-matched; request access flow |
| `/auth/callback` | `src/app/auth/callback/route.ts` | ✅ PKCE code exchange (same browser) |
| `/auth/confirm` | `src/app/auth/confirm/page.tsx` | ✅ handles hash tokens, token_hash, code |
| `/onboarding` | `src/app/onboarding/page.tsx`, `onboarding-flow.tsx` | ✅ 10 steps, saves to `profiles` |
| `/` Opportunities | `src/app/(app)/page.tsx` | ⚠️ old first version; to be rebuilt from design |
| `/admin` | `src/app/(app)/admin/` | ✅ approve / decline access requests |
| Tracker, Calendar, Companies, CV studio, Profile | — | ⏭️ not built |

- `src/proxy.ts`: refreshes the session; signed-out visitors → `/login` (except `/login`, `/auth/*`).
- `src/app/(app)/layout.tsx`: requires login and `onboarded_at`, else → `/onboarding`. Still uses the **old** `AppSidebar`; replace with the design's 64px top bar.

## Brand and tokens
- `src/app/globals.css`: Night (default) and Cloud (`[data-theme="light"]`) tokens from the design (`--bg`, `--s1`, `--sky`, `--dawn`…), exposed as Tailwind colours (`bg-s1`, `text-tx2`, `border-line2`, `text-t-sky`…), plus shadcn variable mapping.
- Fonts: Newsreader (`font-serif`), Helvetica Neue stack (`font-sans`), Geist Mono (`font-mono`), set in `src/app/layout.tsx`.
- `src/components/brand.tsx`: `LogoMark`, `Wordmark` (star as the i-dot), `Brand`, `Sparkle`, `StarField` (seeded), `TelegramFab`.

## Auth
- Invite by approval. Landing: approved → login email; not approved → "Request access" (inserts `access_requests`). Admin approves in `/admin` → server action sends sign-in email with a session-less implicit-flow client → lands on `/auth/confirm`.
- Supabase keys in `web/.env.local` (URL + **publishable** key only; git-ignored).

## Matching
`src/lib/preferences.ts`: `Preferences` type (stored in `profiles.preferences`), defaults, `matchFilters` (degree → radar disciplines, opportunity types → radar kinds, locations → country codes, "Worldwide" = anywhere) and `applyMatch` for Supabase queries. Used by the onboarding count; to be reused by the For you feed and personal alerts (port to SQL or Python for the radar).
`src/lib/onboarding-data.ts`: option lists from the design data, **without** Defence / Nuclear / Fusion.

## Local dev
`.claude/launch.json` has `web` (npm --prefix web run dev, port 3000) and `design` (serves the handoff on port 8765).
