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
- A real person's name or visit never appears on the panel, except to that person. Only sample guests and demo passes are shown to everyone, which is the same rule the door scanner already follows.
- The password is stored as a hash and checked on the server.
- Database changes only add things, so the version already live keeps working.
- Refine, don't redesign: Home keeps its layout.
- No new outside services and no new packages.

## I/O & Edge-Case Matrix

| Case | Expected |
|------|----------|
| Scan a pass for the first time | Checked in, and the timer starts |
| Scan again within 60 seconds | "Already in". A double scan must not end the visit |
| Scan again after 60 seconds | Checked out, with the time inside |
| Scan after checking out | "Already used", with both times |
| Slide to check out by mistake | Undo for 5 minutes |
| Nobody checks out for 6 hours | The timer stops and the visit says the exit wasn't recorded |
| Visit from before this change | Same: exit not recorded. No time is invented |
| Tap a day with no visit | The sheet opens, and a note can still be written |
| Close the sheet with an unsaved note | The note saves |
| Empty a note and save | The note is deleted |
| Wrong admin password | Refused, with a message. The panel's data stays locked |
| Panel opened at night | Sample traffic runs all day, so the demo works at any hour |
| Pass for another gym typed at the panel | Refused and not checked in |
| Panel left in a hidden tab | Stops asking for updates, and catches up on return |

## Code Map

| Area | File |
|------|------|
| Door rules, timer labels | `lib/hours.ts` |
| Check-out, double scan guard | `lib/bookings.ts` |
| Sample guests | `lib/door-guests.ts` |
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
- [x] The owner can check people in and out, and a demo pass checked in elsewhere appears on the panel.

## Spec Change Log

- 6 November: written before the code. The password request arrived while Claude was reading the code, and is included above.
- 6 November: "category" was read as Find's sort chips and filters, because Home's tiles already landed at the top when measured. The panel was built inside the app rather than as a separate app.

## Design Notes

- **Dot size.** The old three-month row gave each day about 15 px, too small to tap. Apple asks for 44 pt and Google for 48 dp. The calendar now shows one month at a time at phone width, swiped sideways, which gives about 46 px per day and keeps the dot grid. On a phone 360 px wide it is about 42 px.
- **Pause button.** WCAG 2.2.2 asks for a way to pause moving content that runs longer than 5 seconds. The owner's request wins here, and the conflict is recorded in the process log.
- **Press.** The press effect and the scroll animation on the big Home cards both set `transform`, and the animation wins, so those cards never moved. The press now uses the separate `scale`, `translate` and `rotate` properties. It lets go when the finger moves, so the browser's own swiping is untouched.
- **Sample traffic.** Guests are worked out from the gym and the date, not stored, so every viewer sees the same day with no background job. Only what the owner does is saved, and it is cleared after two days.

## Verification

See "Checks run" in `process-log.md`. The status stays `in-review` because the four BMad reviewers have not run and the owner has not seen it on a phone.
