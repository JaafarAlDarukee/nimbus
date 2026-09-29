# Design

Back to [[00 Start Here]]

## Sources
- The owner designed Nimbus in **Claude Design** (project `claude.ai/design/p/50f06b92-017c-4739-bfb3-ed773681098d`). This session can't open Claude Design links directly; the owner exports files instead.
- Handoff (local, git-ignored): `design/screens/design_handoff_nimbus/README.md` + `designs/*.dc.html` + `nimbus-data.js`. Also `design/screens/*v1.dc.html` (older versions) and `uploads/` (reference screenshots).
- View them: `preview_start design` → http://localhost:8765/Nimbus%20Landing.dc.html etc.
- My earlier concept board (superseded by the owner's design): Claude artifact "Nimbus brand and screens" https://claude.ai/artifact/DaeaDM27MNH4ukqFALtmzF

## Key rules from the handoff README
- **High fidelity**: colours, type, spacing, radii and copy are final; sample data must come from the backend.
- Night theme default; drawers/modals use Cloud (light). Opportunities/Calendar/CV studio use the brighter night `#111722` with the top glow.
- Top bar on app screens: 64px, logo + wordmark left, centred pill nav (Opportunities, Tracker, Calendar, Companies, CV studio, Profile), right "Telegram on · checked 4m ago".
- Tags: Placement sky, Internship lilac, Graduate mint, Spring week dawn, Apprenticeship teal, Research rose. Dawn only for deadlines.
- Match ring colours: mint ≥85, sky ≥75, dawn below.
- Logo: single-stroke cloud + dawn four-point star. Wordmark "Nimbus" in Newsreader with a sky star as the i-dot.
- Telegram button `#2AABEE`.

## Screens status
Landing ✅ · Onboarding ✅ (count uses real data; ATS score shows "Soon" instead of a fake 72) · Opportunities ⏭️ · Tracker ⏭️ · Calendar ⏭️ · Companies ⏭️ · CV studio ⏭️ · Profile ⏭️ · Mobile ⏭️ · Brand (reference only).

## Deviations agreed with the owner
- Defence, Nuclear, Fusion industries and defence companies removed (see [[09 Decisions log#Exclusions]]).
- Features not built yet say **Soon** rather than pretending.

## Motion
Owner feedback (2026-09-30): "no animation, it's so blank". The handoff says keep motion light (rings/bars .4s, chevrons .15s, scrims). Plan: twinkling stars, current-star pulse in the onboarding stepper, step content fade/slide-in, counting-up numbers, hover lifts. Keep it subtle and respect `prefers-reduced-motion`.
