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
| `/` Opportunities | `src/app/(app)/page.tsx` (data) + `src/components/opportunity-feed.tsx` (UI) + `src/lib/opportunity-view.ts` (row → card, match score, why) | ✅ design-matched |
| `/admin` | `src/app/(app)/admin/` | ✅ approve / decline access requests |
| `/tracker`, `/calendar`, `/companies`, `/cv-studio`, `/profile` | `src/app/(app)/<name>/page.tsx` using `components/coming-soon.tsx` | ⏭️ stand-ins; build each from its design file |

- `src/proxy.ts`: refreshes the session; signed-out visitors → `/login` (except `/login`, `/auth/*`).
- `src/app/(app)/layout.tsx`: requires login and `onboarded_at`, else → `/onboarding`; renders `components/app-shell.tsx` (design top bar; sets `data-theme="bright"` on /, /calendar, /cv-studio). "checked Xm ago" comes from the `radar_last_checked()` SQL function.
- `src/app/(app)/actions.ts`: `track(opportunityId, "saved" | "applied")` writes `applications` (applied → `applied_at`, follow-up in 14 days; saving never downgrades an applied row).
- Opportunities details: `?tab=all`, `?type=<chip label>`, `?q=`, `?n=` (show more). Match score is a transparent heuristic (58 base + type/discipline/location/skills overlaps, max 97) and every "why" line is a real overlap. Logos: Google favicon of the employer's own domain only (not hiring-system hosts), else the initial.

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
