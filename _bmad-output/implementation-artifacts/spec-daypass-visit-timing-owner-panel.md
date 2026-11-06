---
title: 'Daypass: visit timing, interactive calendar and a live owner panel'
type: 'feature'
created: '2026-11-06'
status: 'in-review'
baseline_revision: 'f497c26'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-daypass-native-app-feel.md'
  - '{project-root}/_bmad-output/implementation-artifacts/process-log.md'
---

## Intent

Owner feedback, 6 November, in the owner's words:

- "Interactive calendar in profile page the matrix dots should be interactive and even rigns with history logs and notes"
- "Pause button remove on hero page"
- "Scroll go to back to top when you select a category"
- "Press interactive card to move a bit and also swipe should still exist"
- "entry or exit timing with a timer also create a demo app like u act as a gym owner and u can dat shi and u see a live admin typa panel with times and stuff"
- "set ad,in apssword uxdd", read as: the admin panel's password is `uxdd`

The paste held an image placeholder just before the timing request. No image reached Claude.

## Boundaries & Constraints

- Login stays optional for browsing. The owner panel has its own password and does not need a Daypass account.
- The panel shows real bookings and scans only. Nothing is made up, so a gym with no scans shows zero.
- Anyone with the admin password is an admin and can scan any pass, at any gym. They see first name and last initial, never the full name or email. The door rules still apply.
- The password is stored as a hash and checked on the server.
- Database changes only add things, so the version already live keeps working.
- Refine, don't redesign: Home keeps its layout.
- No new outside services. One new package, `jsqr`, so the camera scanner can read QR codes on iPhones.

## I/O & Edge-Case Matrix

| Case | Expected |
|------|----------|
| Scan a pass for the first time | Checked in, and the timer starts |
| Scan again within 60 seconds | "Already in". A double scan must not end the visit |
| Scan again after 60 seconds | Checked out, with the time inside |
| Scan after checking out | "Already used", with both times |
| Slide to check out by mistake | Undo for 5 minutes |
| One hour passes | The countdown reaches zero, then goes negative and red. Nobody is locked out |
| The desk scans a pass on another device | Both devices confirm within about 2 seconds, with no reload |
| Nobody checks out for 6 hours | The timer stops and the visit says the exit wasn't recorded |
| Visit from before this change | Same: exit not recorded. No time is invented |
| Tap a day with no visit | The sheet opens, and a note can still be written |
| Close the sheet with an unsaved note | The note saves |
| Empty a note and save | The note is deleted |
| Wrong admin password | Refused, with a message. The panel's data stays locked |
| Panel opened with nobody scanned | Everything shows zero, with a prompt to scan a pass |
| Pass for another gym, with one gym chosen on the panel | Refused and not checked in. With all gyms chosen, it is accepted |
| Panel left in a hidden tab | Stops asking for updates, and catches up on return |

## Code Map

| Area | File |
|------|------|
| Door rules, timer labels | `lib/hours.ts` |
| Check-out, double scan guard | `lib/bookings.ts` |
| Panel password, live data | `lib/owner.ts`, `app/api/owner/**` |
| Panel screens | `app/owner/page.tsx`, `components/OwnerPanel.tsx` |
| Calendar, rings, notes | `components/VisitCalendar.tsx`, `app/api/notes/route.ts`, `app/account/page.tsx` |
| Timer on a pass and on Home | `components/ui/StayTimer.tsx`, `components/PassView.tsx`, `components/HomeClient.tsx` |
| Card press | `components/ui/sensory.ts`, `app/inspo.css` |
| Scroll to top | `components/GymSearch.tsx` |
| Database | `scripts/setup-db.mjs` |

## Tasks & Acceptance

- [x] Every calendar dot opens that day, with its visits, entry and exit times and a note that saves.
- [x] Every ring opens its history, and a row opens that day.
- [x] Home has no pause button. Reduced motion and data saver still keep the video still.
- [x] Choosing a sort chip or a filter on Find returns to the top.
- [x] Pressing a card visibly moves it, and swiping a row still scrolls it without opening anything.
- [x] Entry and exit are recorded, and a live timer shows on the pass and on Home.
- [x] `/owner` asks for the password, then shows who is inside, arrivals, the day's log and totals, updating without a reload.
- [x] An admin can check people in and out, and a real check-in made elsewhere appears on the panel by itself.
- [x] No made-up data on the panel: a gym with no scans shows zero.

## Spec Change Log

- 6 November: written before the code. The password request arrived while Claude was reading the code, and is included above.
- 6 November: "category" was read as Find's sort chips and filters, because Home's tiles already landed at the top when measured. The panel was built inside the app rather than as a separate app.
- 6 November: owner feedback removed all made-up data from the panel and made it universal: all gyms, any admin with the password. See row 71 of the process log.
- 6 November: the timer became a countdown of the booked hour, and a scan now confirms on both devices. A user flow map was added in `userflow/`. See row 75.
- 6 November: a session is 1 hour, with 15 minutes' grace before and after. The door opens 15 minutes before the start and closes 15 minutes after the hour ends. See row 77.

## Design Notes

- **Dot size.** The old three-month row gave each day about 15 px, too small to tap. Apple asks for 44 pt and Google for 48 dp. The calendar now shows one month at a time at phone width, swiped sideways, which gives about 46 px per day and keeps the dot grid. On a phone 360 px wide it is about 42 px.
- **Pause button.** WCAG 2.2.2 asks for a way to pause moving content that runs longer than 5 seconds. The owner's request wins here, and the conflict is recorded in the process log.
- **Press.** The press effect and the scroll animation on the big Home cards both set `transform`, and the animation wins, so those cards never moved. The press now uses the separate `scale`, `translate` and `rotate` properties. It lets go when the finger moves, so the browser's own swiping is untouched.

## Verification

See "Checks run" in `process-log.md`. The status stays `in-review` because the four BMad reviewers have not run and the owner has not seen it on a phone.
