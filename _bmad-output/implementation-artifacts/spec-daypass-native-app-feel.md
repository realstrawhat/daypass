---
title: 'Daypass: make it behave and feel like a real app'
type: 'feature'
created: '2026-11-04'
status: 'in-progress'
baseline_revision: '2744e1d1422d316dbfefa439e65d57d160b61d57'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-daypass-full-scope.md'
  - '{project-root}/research/daypass-ux/report.md'
  - '{project-root}/reports/Day pass app improvements.md'
warnings: ['oversized', 'multiple-goals']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The owner reports that Daypass still feels like a website, some features do not work, and design, motion, micro-interaction, smoothness and performance fall short. Research found clarity bugs and an unsolved moment at the gym door.

**Approach:** Keep the build pack's behaviour and the black and lime identity. Rebuild the interaction layer so browsing is instant and motion is native-feeling. Replace everything that cannot be real in a student project with a working simulation that behaves 1:1. Add a subtle demo login so a tester never has to sign up. Apply research recommendations 1 to 7.

## Boundaries & Constraints

**Always:**
- Login stays optional and appears at booking or payment. Passes and Account need a session. The demo login satisfies that with a real session on a demo account.
- Every simulated feature works end to end against the real database and is honestly labelled as a demo somewhere a viewer can find it.
- Booking rules from the first spec still hold: atomic capacity, one charge, 24-hour rule, booking only after payment.
- Time slots stay, because FR4 requires them.
- Motion respects reduced motion, and nothing relies on motion alone to communicate.
- Works from 360 px to desktop with keyboard access and visible focus.
- Location is never stored.

**Never:**
- Never use Apple or Google logos, or present the demo wallet or Face ID as the real products.
- Never collect real card numbers or take real payment.
- Never use fake urgency such as invented counts or resetting timers.
- Never let the demo login reach a non-demo account.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Demo login | Tap the subtle link | New demo session with sample passes and messages, returns to where the person was | Plain message on failure |
| Demo Face ID | Tap Log in with Face ID | Scan animation, then the demo session | Falls back to password message |
| Add to wallet | Tap on pass | Pass flies into the demo Wallet and stays there | Already-added state |
| Desk check-in | Simulated or staff scan | Pass becomes checked in, staff sees valid | Used, expired, wrong date and unknown code each get a clear result |
| Refused entry | Tap I can't get in on the day | Full refund recorded, spot freed, message sent | Refused for other people's bookings and already refunded ones |
| Offline at the door | Pass opened before, no signal | Saved pass still shows | Offline notice |
| Search and back | Filter, open a gym, go back | Same results, filters and scroll position | None expected |
| Slot chosen | Select a time | Main button and sticky bar agree | None expected |
| New gym | No ratings | Shows New | None expected |

</intent-contract>

## Code Map

- `app/layout.tsx` -- stops reading cookies so browsing pages are static and prefetchable
- `components/session.tsx` -- client session, unread count, next booking
- `components/ui/*` -- sheet, toast, push banner, haptics
- `components/GymSearch.tsx`, `SearchOverlay.tsx`, `FilterSheet.tsx`, `GymMap.tsx` -- search experience
- `components/GymBooking.tsx`, `WalletSheet.tsx`, `AuthSheet.tsx` -- booking flow
- `components/HoloPass.tsx`, `PassView.tsx` -- pass, flip, desk mode
- `app/wallet`, `app/inbox`, `app/staff` -- simulated Wallet, email and push inbox, staff scanner
- `lib/hours.ts` -- opening hours and next slot, shared by server and client
- `scripts/setup-db.mjs`, `scripts/upgrade-data.mjs` -- schema and data upgrade
- `public/sw.js` -- offline support

## Tasks & Acceptance

**Execution:**
- `scripts/*` -- add demo users, check-ins, wallet state, messages, saved gyms, pass facts; reseed unique reviews and photos -- real data behind every simulation
- `lib/*`, `app/api/*` -- demo login, messages, saved gyms, check-in, refused entry, staff check, city suggestions, sliding sessions, hardening from the last review -- full stack
- `components/*`, `app/**` -- rebuild screens and motion -- requested experience
- `tests/booking-rules.test.mjs` -- cover the new behaviour -- evidence

**Research items included:** sticky bar agreement, Open instead of Free, Show map only when useful, results sooner, believable reviews, cards with review count, hours and next slot, pass facts on each gym.

**Acceptance Criteria:**
- Given a first-time visitor, when they tap through find, book, demo login, pay, pass, add to wallet, desk scan and refused entry, then every step works with no dead ends.
- Given browsing pages, when navigating between them after prefetch, then the page appears without a loading state.
- Given any screen at 360 px, when loaded, then there is no sideways scrolling.

## Spec Change Log

## Review Triage Log

## Design Notes

Static browsing pages make shared-element morphs possible, because the docs say a morph plays only when the destination renders in the same commit as the navigation. Personal data moves to the client through one session call, cached for instant repaint.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm test` -- expected: all pass
- `npm run build` -- expected: success

**Manual checks (if no CLI):**
- Drive the acceptance journey in a phone-sized browser on the live link, and run a Lighthouse audit.
