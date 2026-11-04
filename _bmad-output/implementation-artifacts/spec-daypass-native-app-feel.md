---
title: 'Daypass: make it behave and feel like a real app'
type: 'feature'
created: '2026-11-04'
status: 'in-review'
baseline_revision: '2744e1d1422d316dbfefa439e65d57d160b61d57'
review_loop_iteration: 0
followup_review_recommended: true
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

### 2026-11-05

Owner chose a new direction from the reference images, after rejecting the full-screen gym hero: video opening, frosted glass, floating round navigation, cut-out athletes, marker notes, giant number on the next booking, swipe to book, rings. Location order: exact if allowed, saved home city, then general area from the network, with exact location offered after. Known-bad state avoided: assuming a default city.

## Review Triage Log

### 2026-11-05 — Review pass

- verdicts: 124 findings — high 7, medium 42, low 49, false 6, maybe-false 20. Grading was done by reading the cited code, with no separate verifier. Rows marked unverified were not traced.
- routing note: step 4 prefers `bad_spec` and a re-derive when in doubt. Findings here were patched in place instead, because the owner was changing the design live. This is a deviation, recorded in `process-log.md`.

**Blind Hunter**
- `[high]` `patch` Any logged-in account could read and use any pass at the door scanner — a real person's pass is now only visible to its owner, and demo passes stay shared so two phones can act out the door. No real staff role exists yet.
- `[medium]` `patch` Scanner race, re-scan and non-Daypass QR codes, and "Wrong date" on the right day — one winner on racing scans, new Too early result, prefix check, re-scan allowed once the result is read.
- `[high]` `patch` Self check-in had no limits, so a real account could use up a pass or rate early — real accounts limited to 1 hour before to 3 hours after the start; button hidden otherwise.
- `[medium]` `patch` Refund wording and timing — removed "we let the gym know", "spot is free" only for future sessions, early tap now explains. `defer`: refund is self-declared with no usage limit.
- `[medium]` `defer` Demo login has no rate limit and holds real capacity.
- `[medium]` `patch` Face ID can land in a demo account silently — the scan now says Demo Face ID and "Signed in to a demo account". `defer`: trying a real passkey first when the device flag is missing.
- `[high]` `patch` Personal pages stayed on the device after logout — copies are now removed at logout and account deletion.
- `[high]` `patch` Offline promise failed for passes opened by in-app links — an opened pass now asks to be saved. NOT yet verified: the offline worker only runs in production and that deploy is blocked.
- `[low]` `defer` Static cache never expires, `/img` marked immutable.
- `[medium]` `patch` Rating bars are generated but looked like real counts — labelled as estimated.
- `[medium]` `defer` Partner gyms get default facts owners can't correct. Pass back no longer shows when empty.
- `[medium]` `patch` Old sample reviews stayed public — backfill added and run.
- `[medium]` `patch` Account stats counted a real account's sample visit — excluded. `defer`: no-shows still count.
- `[medium]` `patch` A saved max price could not be cleared — clearing now writes an explicit "any".
- `[medium]` `defer` Choosing "Paris, Texas" opens the first match for the name.
- `[low]` `patch` A geocoder failure could be cached for a day — failures are no longer cached.
- `[low]` `patch` Reminder said Tomorrow for a session today — compares the gym's own calendar. `defer`: Reminders switch does not persist; disclosed as demo.
- `[medium]` `patch` "Next free" was not based on availability — relabelled "Next open time". `defer`: feeding real availability in.
- `[medium]` `patch` A server error made people look logged out — session kept unless the call succeeds.
- `[medium]` `patch` Lists stale for up to a minute after booking or login — refresh added on both.
- `[medium]` `patch` Used and expired passes stayed in Wallet (also seen in a screenshot) — filtered out.
- `[high]` `patch` Near-me search could dead-end in endless placeholders — the ask screen now appears after a failed location.
- `[low]` `patch` Location wording did not match behaviour — wording and privacy page updated.
- `[low]` `patch` Saved gyms showed a different rating — now shares the same calculation.
- `[medium]` `patch` Tests missed the riskiest rules — 13 tests added.
- `[low]` `defer` Release steps have no script entries.

**Intent Alignment** (descriptive, recorded as divergences)
- `[high]` `patch` Offline row: see above, unverified until deployed.
- `[medium]` `patch` Desk check-in: demo pass could never reach valid easily — unchanged for a far-off pass by design, valid proven by new test. `defer`: simulated scan does not go through the staff path.
- `[medium]` `patch` Search and back: on-screen arrow dropped filters — it now returns to the last search. `maybe-false`: scroll position on the arrow is not restored; would need a browser check.
- `[low]` `patch` New gym on Saved rail showed 0.0 — fixed through the shared rating.
- `[high]` `patch` Demo session could consume a real pass — same fix as the scanner.
- `[medium]` `patch` Tests never ran real-account rules — new tests use registered accounts.
- `[medium]` `patch` Simulated scan not limited — same fix as self check-in.
- `[low]` `defer` FaceScan drawing sits close to Apple's glyph. Owner judgement.
- `[low]` `defer` Demo balance fixed, refunds always say demo card.
- `[medium]` `defer` Demo logins move real space counts. Same as rate limit row.
- `[low]` `reject` Saving a gym asks for login — saving needs an account, the intent lists booking and payment as examples.
- `[low]` `patch` Reduced motion not honoured in two smooth scrolls — both now respect it.
- `[low]` `patch` City from position kept on device, not disclosed — disclosed on the privacy page.

**Verification Gap**
- `[medium]` `patch` Desk valid, expired, cancelled and QR prefix untested — test added.
- `[high]` `patch` Refused entry untested for real accounts — test added.
- `[medium]` `patch` Check-in lock on PATCH and stranger access untested — tests added.
- `[medium]` `patch` Public versus demo reviews untested — test added.
- `[medium]` `patch` Filter tests passed on empty results — replaced with non-empty, narrowing and nearest-order checks; open now added.
- `[medium]` `patch` `lib/hours.ts` untested — `tests/hours.test.mjs` added.
- `[low]` `patch` Reminder and mark-read untested — test added.
- `[low]` `defer` Session and cache headers unasserted.
- `[medium]` `defer` Demo clean-up not tested, though reading the query shows it filters on `is_demo`.
- `[low]` `defer` Partner and account validation untested.
- `[low]` `patch` Guest redirects for new screens untested — added.
- `[low]` `patch` Seconds and missing key untested — added.
- `[medium]` `defer` Offline has no automated check; needs a manual airplane-mode run once deployed.
- Other findings in this layer duplicate rows above: `/api/staff`, `/checkin`, offline saving, logout copies, places cache, reminder title, `is_public` backfill, saved rating, demo capacity. Same verdicts and routes, 9 rows.

**Edge Case Hunter**
- `[medium]` `patch` GymSearch: saved price cap; `[low]` `patch` non-numeric maxPrice or minRating rendered NaN.
- `[medium]` `patch` GymSearch: late response overwriting a cached search; `[medium]` `patch` load-more merging into a changed search; `[low]` `patch` repeated empty pages.
- `[high]` `patch` near=1 failure endless skeleton; `[medium]` `patch` ask screen skipped when last coordinates were held; `[medium]` `patch` late auto-redirect replacing a chosen city; `[low]` `patch` empty area search jumping to a city; `[low]` `patch` raw "Failed to fetch" shown.
- `[low]` `reject` In-memory search cache never expires — a visit is short, and adding expiry is more than a direct fix.
- `[medium]` `defer` SearchOverlay picks the first geocoder hit; `[low]` `reject` Enter before suggestions arrive, unlikely in everyday use.
- `[low]` `patch` places failure cached; `[low]` `patch` empty `city=` with coordinates publicly cacheable.
- `[high]` `patch` `/api/staff` any user; `[medium]` `patch` racing scans; `[low]` `patch` same-day early scan; `[high]` `patch` real user simulate; `[medium]` `patch` public rating without a visit.
- `[low]` `patch` gym name lookup failing after a committed action. `[medium]` `defer` demo rate limit. `[low]` `patch` reminder Today or Tomorrow.
- `[low]` `patch` saving a missing gym returned a server error; `[low]` `patch` UUID check on saved; `[low]` `defer` UUID check on partners; `[low]` `patch` saved rating.
- `[low]` `reject` Partner submits one coordinate — the pin falls back to the city centre, acceptable for a demo form.
- `[low]` `patch` empty facts on the pass back; `[medium]` `patch` `is_public` backfill.
- `[medium]` `maybe-false` GymBooking stale price in the sheet — not traced. Would need a booking after a price change inside the page cache window. An earlier fix refuses a silent price rise.
- `[medium]` `patch` stale lists after payment; `[low]` `patch` WalletSheet reset mid-payment.
- `[medium]` `patch` nested sheet Back closing the parent; `[low]` `patch` scroll lock lost with a nested sheet; `[medium]` `patch` sheet close undoing navigation (Wallet link, change flow).
- `[low]` `defer` Sheets that navigate leave a dead history entry, needing an extra Back press.
- `[medium]` `patch` expired pass still looked active; `[low]` `patch` checked-in state now syncs on refresh; `defer` polling while the desk screen is open.
- `[low]` `defer` wake lock leak and re-request after backgrounding.
- `[low]` `patch` ChangeFlow stale error; `[low]` `patch` nearby-gym failure blocked retry.
- `[low]` `patch` StaffScanner rescan after failure; `[low]` `patch` old result shown during next check; `[low]` `patch` double camera start. `defer` camera on unmount during prompt.
- `[medium]` `patch` session 5xx. `[low]` `reject` Unread badge race, one refresh corrects it. `[low]` `reject` Login redirect loop, the session refresh on mount ends it after one bounce.
- `[medium]` `patch` Face ID silent demo; `[low]` `patch` logout on 5xx; `[high]` `patch` logout saved copies; `[high]` `patch` in-app passes not saved; `[low]` `patch` uncached pages showing the Passes document.
- `[low]` `patch` GymPhoto failure placeholder; `[low]` `patch` map failure message over a working map; `[medium]` `patch` SlotPicker pulling the page; `[low]` `patch` Home success toast with nothing found; `[low]` `patch` coordinates sent to BigDataCloud after a server error.
- `[low]` `defer` Home picks cached empty if the database fails during render.
- `[medium]` `patch` Next slot wording; `defer` real availability. `[low]` `reject` resolved city while travelling within one visit, unlikely.
- `[medium]` `patch` Wallet used or expired; `[medium]` `patch` stale content after login; `[low]` `patch` RevealIntro replay after refresh.
- `[low]` `patch` "Next free" wording.
- `[false]` `reject` Demo pass cannot do desk scan then refused entry — by design, a used pass has no refund, and a second booking covers the sequence.
- `[false]` `reject` Search and gym screens show loading after prefetch — open times are live data, so this is intended and uncached searches are expected to load.
- `[low]` `defer` Reminders toggle not saved; disclosed as a demo setting. `[low]` `defer` Demo balance fixed.
- `[high]` `patch` First-time visitor denying location reached an endless skeleton — same fix as near=1.
- Remaining rows in this layer repeat the Blind Hunter service worker and Wallet items above, with the same verdicts: 4 `[false]` as separate findings, 20 `[maybe-false]` kept at `defer` where the same claim could not be separately traced.

## Design Notes

Static browsing pages make shared-element morphs possible, because the docs say a morph plays only when the destination renders in the same commit as the navigation. Personal data moves to the client through one session call, cached for instant repaint.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm test` -- expected: all pass
- `npm run build` -- expected: success

**Manual checks (if no CLI):**
- Drive the acceptance journey in a phone-sized browser on the live link, and run a Lighthouse audit.
