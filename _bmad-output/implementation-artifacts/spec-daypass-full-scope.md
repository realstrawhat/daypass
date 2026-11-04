---
title: 'Daypass: gym day pass web app, full build pack scope'
type: 'feature'
created: '2026-11-04'
status: 'in-review'
baseline_revision: 'NO_VCS'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/Gym_App_Product_Build_Pack - Copy.pdf'
  - '{project-root}/REF'
warnings: ['oversized', 'multiple-goals']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gyms sell monthly or yearly contracts, and finding one that sells a single day means checking every website or calling. Travelers (A1) and irregular gym goers (A2) need one place to find, book and pay for one session.

**Approach:** A responsive Next.js and Postgres web app covering every item in the build pack: FR1-10, all five MVP stories, the story map stories above and below the MVP line, the gym-side assumptions, and the NFRs that software can satisfy. Visual direction comes from the REF folder.

## Boundaries & Constraints

**Always:**
- A booking is visible and confirmed only after payment succeeds (NFR7).
- Slot capacity and booking changes use single atomic SQL statements, so concurrent users cannot overbook.
- Retried or double-tapped payments reuse an idempotency key and never charge twice.
- Changes are refused less than 24 hours before the session, on the server.
- User location is used only for the request and is never stored or logged (NFR6).
- Passwords are hashed with scrypt. Sessions end after 30 days unused (NFR5).
- EU hosting: Vercel fra1 and Neon in Frankfurt.
- Works from 360 px to desktop with no horizontal scroll, keyboard access, visible focus, reduced motion respected.

**Never:**
- Never take real payment or collect real card numbers. The user chose a clearly labelled demo wallet, styled after Apple Pay without Apple marks, behind a provider adapter.
- Never present seeded gyms as real businesses. Listings are labelled as demo data.
- Never deploy to the account hosting kodialex.com or the Adara Trust site. Target account: rockzzalex11@gmail.com.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nearby search | Location allowed, gyms within 5 km | Pins and list with distance and price | Fall back to city search |
| Location denied | Permission refused | City input is offered | Plain message, nothing stored |
| No photos | Gym has empty photo list | Placeholder image, all details still show | No broken image |
| Pay success | Sat 10:00 free at €12, logged in | Confirmed, shows in My bookings | None expected |
| Pay failure | Declined card in demo wallet | No booking, not charged, slot freed | Message with retry |
| Double tap | Same idempotency key twice | One booking, one charge | Second call returns the first result |
| Last spot race | Two users, one spot left | One wins | Loser told the slot was taken |
| Reschedule | Sat booking, Sun free | Shows Sunday, Saturday spot freed, updated confirmation | Old vs new shown first |
| Inside 24 h | Visit under 24 h away | Told changes are no longer possible | Enforced by the server |
| Directions | Google Maps, Apple Maps or none | Opens the chosen app with the gym as destination | Falls back to browser |
| Move gym | New gym has a different price | Pay the difference or get a refund | Same rules as reschedule |

</intent-contract>

## Code Map

- `app/` -- pages and API routes (Node.js runtime)
- `lib/db.ts` -- Neon client
- `lib/auth.ts` -- scrypt hashing and 30-day sliding sessions
- `lib/bookings.ts` -- atomic hold, pay, reschedule, move, cancel
- `lib/gyms.ts` -- search, sort, filter, recommend, map area, slots
- `lib/payments.ts` -- external provider adapter with the demo wallet
- `scripts/setup-db.mjs` -- schema and seed
- `components/` -- search, map, wallet sheet, hologram pass, booking flow
- `tests/` -- race, double-charge, 24-hour and failed-payment checks

## Tasks & Acceptance

**Execution:**
- `scripts/setup-db.mjs` -- create schema and seed demo gyms -- real data layer
- `lib/*` -- implement domain logic above -- single source of booking rules
- `app/api/*` -- expose search, auth, checkout, bookings, reviews, partners, account -- full stack
- `app/**/page.tsx`, `components/*` -- build screens from the REF direction -- requested UI
- `tests/*` -- cover the I/O matrix edge cases -- NFR7 evidence
- `vercel.json` -- pin fra1 -- NFR6

**Traceability, every build pack item:**
- FR1 list and map, 20 per page: `/gyms`. FR2 details: `/gyms/[slug]`. FR3 sort and filter: `/gyms`. FR4 slots: gym page. FR5 accounts: `/login`. FR6 payment: wallet sheet. FR7 bookings: `/bookings`. FR8 change until 24 h: pass page. FR9 directions: directions sheet. FR10 calendar: `.ics` and Google Calendar.
- J1 MVP: ask location, nearby gyms, pins and list, details, dates and slots, confirm, log in, register, pay, view and cancel, directions.
- J1 later: type a city, recommended sort, map-area filter, price and rating sort, read reviews, save preferences, save card, rate out of 5, rating prompt, text review.
- J2 MVP: stay logged in, upcoming list, open booking, free slots at same gym, select slot, old vs new confirm, 24 h block, updated confirmation, directions.
- J2 later: Face ID via passkey, day-before reminder, move to another gym, price difference or refund, add new time to calendar.
- Assumptions: gyms list themselves and set price at `/partners`, 15% commission paid by gym, confirm details every 90 days.
- NFR6: `/privacy`, account deletion request with 30-day window, location never stored.

**Acceptance Criteria:**
- Given the build pack, when each traceability line is exercised on the deployed app, then it behaves as written.
- Given any page at 360 px, when loaded, then there is no horizontal scrolling.

## Spec Change Log

### 2026-11-04 — Owner direction during the build
- Trigger: project owner reviewed the live preview and said it felt like a website, and asked to see login at the start.
- Amended: the app opens on a login screen with a "Look around first" route, so the build pack's journey (browse first, log in at booking) still works. Marketing landing page removed. Added Home screen, tab bar and side rail, map-backed list sheet on phones, and a web app manifest.
- Known-bad state avoided: a marketing website with a top navigation bar and footer.
- KEEP: atomic booking SQL, hologram pass, demo wallet, separate routes for each screen.

### 2026-11-04 — Mandatory login (misread, reverted)
- Trigger: the owner's message about login and their professor was read as "make login mandatory".
- Amended: all app screens and gym data were gated behind login, then deployed.
- Known-bad state: the owner meant the opposite. This entry stands as a record of the mistake and is replaced by the next entry.

### 2026-11-04 — Optional login, as the professor requires
- Trigger: owner clarified that login is not mandatory, and said it is not right as per their professor. Their earlier message also said login should not be at the start.
- Amended: the app opens on Home for everyone. Guests can browse Home, search, gym pages and the gym owner page. Login is asked for when booking, which matches the build pack's story map (Book an appointment, then Signup / Login, then Make payment). Passes and Account need a login. This replaces the login-first start screen from the earlier owner direction.
- Known-bad state avoided: a login wall before people can see any gyms.
- KEEP: return to the requested page after login, and the selected time staying selected through login.

## Review Triage Log

### 2026-11-04 — Review pass (all 4 layers reported; triage incomplete)

Blind Hunter, Verification Gap and Intent Alignment reported before the patches below. Edge Case Hunter reported after they were deployed. It repeated several patched items and added about 40 smaller ones that were neither verified nor fixed in this time box. Findings are summarised per root cause rather than one row per reported finding, which falls short of the workflow's one-row-per-finding rule. Status stays `in-review` for that reason.

Notable Edge Case Hunter items still open: the session cookie is never reissued, so active users are logged out 30 days after login rather than after 30 unused days (NFR5); a paid hold that expires mid-payment can return success with no booking; a slot time with non-zero seconds passes validation; a user can book two gyms for the same hour; malformed requests return 500 instead of 400; the geocoder has no timeout; partner coordinates have no range check.

- patched and covered by re-run tests or checks:
  - `[high]` `[patch]` Page entrance animation trapped fixed elements on phones, so the map sat behind the list and the view toggle and book bar were not fixed. Animation changed to opacity only.
  - `[high]` `[patch]` A reused checkout key could pay for the previously held slot. Key now resets per selection and the server refuses a key used for a different slot. New test added.
  - `[medium]` `[patch]` Checkout stayed stuck after a closed wallet following a decline or expired hold. Resets when the wallet closes.
  - `[medium]` `[patch]` A price rise could be charged without being shown. The server now refuses when a difference is due and no payment method was approved.
  - `[medium]` `[patch]` Open redirect after login via a backslash path. `safeNext` refuses backslashes.
  - `[medium]` `[patch]` Expired holds kept slots full. Availability now releases them.
  - `[medium]` `[patch]` Accounts pending deletion could still log in. Password and passkey login now refuse them.
  - `[low]` `[patch]` New gyms showed a 0.0 rating and sank in ranking. They now show "New" and rank with a neutral rating.
  - `[medium]` `[patch]` Test gaps: added invalid-slot, login and logout, stranger and unpaid-hold read tests. The 24-hour test now reports a skip instead of passing silently.
- deferred, see frontmatter list below for the main items.

Not fixed at time-box end: charge is called before the move is secured (harmless while simulated, must change with a real provider); no automated account erasure; no service worker, so passes need a connection; no check-in endpoint for gym staff; sample visit reviews count publicly; no rate limiting; no Content-Security-Policy; client flows can stick on network failure; iOS tilt permission is not requested for the hologram; search state is lost on back; a session counts as past the moment it starts; test gaps for hold expiry, payments ledger, partners, reviews and time zones.

## Design Notes

Direction from REF: true black and paper white surfaces meeting with a notched sheet (Luma), huge condensed caps (Zonixx), acid lime used as whole surfaces, not just accents (Evgeny, Kaliadziuk), a lime ribbon with text on a path and hand-written notes (Fitness & Activity), day pills and glass controls (Flexon), dot-matrix calendar (Vikram). The memorable element is the hologram day pass.

Limits software alone cannot prove: NFR3 needs five real test users, NFR8 needs real gyms, NFR10 is measured over time. Report these plainly.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm test` -- expected: all pass against the real database
- `npm run build` -- expected: success

**Manual checks (if no CLI):**
- Drive the full journey in Chrome at 360 px and desktop on the deployed URL.
