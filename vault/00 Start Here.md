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

## Next up (as of 2026-10-01, owner said "lets go")
Done already: every design screen, personal Telegram (owner connected 1 Oct), Adzuna back, research boards, Devpost hackathons. Details in [[02 Roadmap and status]].

**Owner's latest instructions (1 Oct), in order of work:**
1. [x] (done 1 Oct, `bffdfd9`) **CV template = the r/EngineeringResumes template** as the main CV: one column, name + contact line, Education, Experience, Projects, Technical skills (grouped), no summary for students, action-verb bullets with numbers, one page. Real **.docx** (npm `docx`) and PDF export. Build it into CV studio ([[06 Website]] `components/cv-studio.tsx`, `lib/cv.ts`).
2. [x] (done 1 Oct, `bffdfd9`; learned keywords per role type still to do) **ATS checker "program" inside the website** that students use to raise their score: upload CV (PDF/Word) + paste or pick a job advert → score with a breakdown (keywords learned from Nimbus's own adverts for that role type, measurable results, action verbs, sections, contact details, length/one page, readability of the file: columns/tables/reading order) and a fix-it list. Could live in CV studio as its own tab.
3. [x] (done: built-in ideas + "Copy a prompt for Claude") **Gemini: owner doesn't want to deal with keys** ("u do all"). Claude must never create accounts or handle keys, so make AI optional: keep built-in ideas and add "Copy to Claude" prompts (owner has Claude Pro). Don't ask for a Gemini key again unless the owner brings it up.
4. [~] (drawer link done `8ce3888`; research queue of Adzuna's employers still to do) **Adzuna links go to third-party sites**: Adzuna blocks automated redirect-following (403), so add a "Find it on their own site" link in the drawer (search for company + title on the employer's careers site) and put Adzuna's employers (not yet watched, hiring students) at the top of the research queue.
5. [~] (1 Oct: owner switched on Gradcracker (follows all 198 hubs; defence ones excluded in `radar/pipeline/exclusions.py`), Higherin saved searches, Bright Network preferences + emails, TARGETjobs tracker. LinkedIn: owner made job alerts and a Gmail filter forwarding only jobalerts-noreply@linkedin.com to the Nimbus Gmail (general forwarding stays disabled). Check the first emails parse, especially Bright Network and TARGETjobs link formats.) **Job alerts**: owner made accounts with the Nimbus Gmail on TARGETjobs, Bright Network, Higherin (= RateMyPlacement's new name, higherin.com) and Gradcracker, but has **no alerts/trackers switched on yet**. Guide them (simple clicks). Make sure the inbox parser knows higherin.com emails. LinkedIn: forward only job-alert emails.
6. [ ] Keep researching big employers' boards (list in [[04 Radar#Changes 2026-10-01]]) and adding routes to `web/src/lib/company-routes.ts`.
7. [~] Before inviting friends: ✅ site online at https://nimbus-pi-three.vercel.app (Vercel, 1 Oct; auth site_url pushed). ✅ Supabase SMTP via the Nimbus Gmail (owner set it in the dashboard with a new app password "Supabase"; sender name "Children of Khan"). ✅ Nimbus email templates live (config push). Email rate limit raised to 30/h in the dashboard. ⏳ Test sign-up with one friend. Custom domain later.

**1 Oct, later ("check everything for all degrees" + events):** done: science/health/environmental tags, every degree mapped (incl. Civil, Aerospace, Electronic, Mechatronics, Automotive, Manufacturing, Materials, General Engineering), MLH hackathons, `data/seed/events.csv` (16 researched UK expos/conferences), "Expo or careers fair" type, Higherin tracker links. The roles the 1 Oct reclassify wrongly closed reopened themselves: every radar run sets `status=open` on rows it sees again (`store.py`). Waiting on the owner: owner picking a nicer `*.vercel.app` name; testing sign-up with one friend. Science coverage is thin (UK: ~21 life-sciences, ~57 healthcare roles): next, add pharma/biotech/NHS employers' boards.

The owner says they are "kinda shit in computing": give one small step at a time, exact clicks, and do everything that doesn't need their accounts yourself.

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

**1 Oct, evening (owner: "highest chance for my boys", easier CV, local AI?, LinkedIn tips):** built "Use my CV" (upload once, rebuilt in the template and tailored), Tailor it, three kinds of skill suggestions incl. ones learned from real adverts, evidence hints, Tailor with Claude, LinkedIn "Before you apply" (CV studio + drawer). Decision pending with the owner: built-in AI via an Anthropic API key (pennies per CV) vs staying with Copy-to-Claude. See [[09 Decisions log]].

**1 Oct, late: full test before sharing.** Website: types, lint, production build OK; 119 logic checks OK (matching for all 42 degrees, checker, tailoring, prompts, example). Radar: 76 checks OK (types, tags, exclusions, matching, readers, events, MLH, inbox). Live site: private pages redirect to login, previews 404. Database: ~15.8k open roles (~1.9k UK), 68 events. Runs: full 5/5, priority 31/34 (3 cancelled by overlap). Telegram function active. Inbox: Gradcracker 51, Bright Network 30, Higherin 4, TARGETjobs 1 jobs from real alerts. Owner said "forget about AI": the Gemini review stays dormant (no key). Admin page has an "Invite a friend" card. **Next: owner invites friends** (first one as a test of sign-up email), then optional nicer *.vercel.app name, more science/NHS employers.

**1 Oct, last:** CV studio has a big "Never made a CV? Look at this first" box on steps 1-3 and the empty page, and a big "Make your CV much better with Claude" pop-up (copies CV text + advert, no download needed; opens by itself the first time a CV reaches the check). Coverage: 28 science/medtech Workday boards added to `data/discovered/research.csv`; new NHS Jobs reader (`radar/sources/nhsjobs.py`). Still to find: Haleon, Reckitt, Johnson Matthey, Takeda, Lilly, Boston Scientific, Novo Nordisk, Charles River boards (not on obvious Workday sites). Owner is about to invite friends.

**5 Oct, IN PROGRESS: computing for friends (owner's request).** Friends in computing (CS, ML/AI, data science) want jobs and grad schemes. Plan: (1) the shared "Nimbus Alerts" channel also posts computing roles, without changing how it looks or works; (2) Computing becomes a real field in onboarding/Profile (CS, Software Eng, AI/ML, Data Science, Cyber, Computer Eng...) so For you and personal Telegram alerts work for them; (3) computing industries; (4) software/AI hackathons go to computing degrees only. Owner rule: update the vault before starting and after finishing.
