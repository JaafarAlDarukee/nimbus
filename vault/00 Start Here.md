# Nimbus: start here

*Opportunities, the moment they form.*

Nimbus is a private job radar for UK engineering students (the owner is a 2nd-year mechanical engineering student). It watches thousands of employers' own careers pages, finds placements / internships / grad schemes / research roles the moment they open, and alerts users (Telegram first). It shows where and how to apply. **It never applies or messages employers for anyone.**

## If you are Claude starting a new session
Read in this order, then carry on from **Next up** below:
1. [[12 Working with the user]]: how to talk to and guide the owner (beginner, step by step)
2. [[02 Roadmap and status]]: what's done, what's in progress, what's next
3. [[09 Decisions log]]: decisions already made; don't re-open them
4. [[03 Architecture]], then the area you're touching: [[04 Radar]] · [[05 Database]] · [[06 Website]] · [[07 Design]]
5. [[08 Accounts and secrets]] (where keys live; never values) and [[10 How to run things]]
6. [[11 Gotchas]] before running commands on this Windows machine

## Next up (as of 2026-09-30)
- [ ] Owner is logged in and on onboarding (admin ✓, not onboarded yet). Add **gentle animation** to landing + onboarding (owner said it feels blank). See [[07 Design]].
- [ ] Owner finishes onboarding; verify preferences saved ([[05 Database]] `profiles.preferences`).
- [ ] **Opportunities page** from the design (For you feed using [[06 Website#Matching]], match rings, white detail drawer, "Open and apply" → tracker). Replace the old sidebar layout with the design's top bar.
- [ ] **Personal Telegram alerts**: bot links `telegram_links` codes to accounts, then each user gets only their matches. See [[04 Radar#Alerts]].
- [ ] Then Tracker → Profile → Calendar → Companies → CV studio ([[02 Roadmap and status]]).
- [ ] Before inviting friends: connect the Nimbus Gmail as Supabase's email sender (SMTP) and switch on the custom templates. See [[11 Gotchas#Supabase email]].
- [ ] Put the site online (Vercel + free Student Pack domain). See [[13 Ideas backlog]].

## Map
- [[01 Vision and plan]]
- [[02 Roadmap and status]]
- [[03 Architecture]]
- [[04 Radar]]
- [[05 Database]]
- [[06 Website]]
- [[07 Design]]
- [[08 Accounts and secrets]]
- [[09 Decisions log]]
- [[10 How to run things]]
- [[11 Gotchas]]
- [[12 Working with the user]]
- [[13 Ideas backlog]]
- [[Sessions/2026-09-26 to 30]]: what happened, in order
