# Daypass: implementation process log

This records what happened during the build, including failures and how each was corrected and checked.

Scope note: the workshop asks for one story from the Unit 7 pack. The project owner asked for everything in the build pack, so the full scope was built. Story 3, "Book an appointment", is a good one to present as the main story.

## BMad workflow used

| Stage | What was used | Output |
|-------|---------------|--------|
| Setup | BMad v6.12.4 installed in the project, plus AGENTS.md and .gitignore from the course boilerplate | `_bmad/`, `.agents/` |
| Plan | `bmad-build-auto` steps 1 and 2 | `spec-daypass-full-scope.md` |
| Implement | `bmad-build-auto` step 3, with one deviation below | App source |
| Check | `bmad-build-auto` step 4: Blind Hunter, Edge Case Hunter, Verification Gap and Intent Alignment reviewers | Review Triage Log in the spec |

### Deviations from the BMad workflow

- Step 3 says a fresh subagent implements from the spec. The code was written directly in the main session, so that the owner's live feedback could be applied as it arrived.
- Steps 1 to 3 were read and followed out of the strict order. Implementation began before steps 3 and 4 had been read, and step 4 ran later.
- There is no Git repository, so the review ran against a generated diff of all source files instead of a real diff, and no baseline revision exists.
- BMad's separate PRD, architecture and epics workflows were not run. The Unit 7 build pack already held that planning, so the spec points to it directly.

## Failures and corrections

| # | What went wrong | What changed | How it was checked |
|---|-----------------|--------------|--------------------|
| 1 | The PDF would not render because `pdftoppm` is not installed | Extracted text with pypdf and rendered the two story map pages with PyMuPDF | Read all 6 pages, including both story maps |
| 2 | The computer was logged into a Vercel account hosting another site, not the one requested. An empty `daypass` project was created there before this was noticed | Stopped, unlinked, and logged in as rockzzalex11@gmail.com. Nothing was deployed to the first account. The empty project remains there | Account email read back from Vercel, and the project is now on the monamobile team |
| 3 | `vercel integration add` rejected `--yes`, then the Neon terms needed accepting, then region `aws-eu-central-1` was rejected | Used `--non-interactive`, the owner accepted the terms, and the region was changed to `fra1` | Database created and 192 gyms seeded |
| 4 | Buttons led to 404 pages in the live preview | The target pages had not been written yet, so they were built | All routes return 200 |
| 5 | The owner tried a Vercel address that returned 404 DEPLOYMENT_NOT_FOUND | Gave the correct production address | Page and API checked on the live link |
| 6 | The map was blank: "Worker failed to load" with MapLibre 6 under Next.js | Pinned MapLibre to 5.24.0 | 20 price pins and map tiles visible in the test browser |
| 7 | On phones the search button ran off the screen | A grid item was stretching to its content, so the column was limited to the screen width | No sideways overflow when measured at 390 px |
| 8 | "Search this area" appeared before the map had been touched | The button now reacts only to moves made by a person | Not shown on load in the test browser |
| 9 | Owner feedback: "it doesn't feel like an app, it's like a website", and login should come first | Replaced the landing page with a login start screen, added Home, tabs and a side rail, and made the list a sheet over the map on phones | Reviewed at phone and desktop sizes. Login appears first on the live link |
| 10 | Owner feedback: the home page did not fit the screen and felt heavy | Sized the start screen to the viewport, removed the animated ribbon, and combined duplicate user lookups in each request | Live pages measured at about 100 to 530 ms from this computer |
| 11 | The hologram sticker looked grey | Rebuilt its colour layers so the rainbow shows | Checked on the pass screen |
| 12 | The test command failed: "Cannot find module tests" | Pointed the command at the test file | 9 of 9 tests pass |

| 13 | BMad review: on phones the map sat behind the list, leaving a blank black area, and sticky controls were not fixed. The page entrance animation caused it | Entrance animation changed to opacity only | Measured on the live link at 390 px |
| 14 | BMad review: changing slot after closing the wallet could pay for the old slot | Each selection gets a new checkout key, and the server refuses a key used for a different slot | New automated test |
| 15 | BMad review: open redirect after login, expired holds blocking slots, pending-deletion accounts able to log in, silent charge after a price rise, new gyms showing 0.0 | Fixed each one | Type check, tests and code review of the change. Not each one was driven by hand |
| 16 | A message about login and the professor was misread as "make login mandatory", so every screen was locked behind login and deployed. The owner meant the opposite | Reverted the lock. The start screen was also removed, so the app opens on Home and asks for login when booking, as the build pack's story map shows | New automated test checks guests can browse and cannot book, plus a check on the live link |
| 17 | Refreshing sample data added 150 duplicate gyms, because changing the generator changed its random order | Removed only those rows, which had no bookings, and setup now seeds only empty cities | City counts read back at 24 each |
| 18 | Owner feedback: some features did not work and the app did not feel like an app | Second BMad spec, `spec-daypass-native-app-feel.md`. Static browsing pages, drag-to-dismiss sheets, push banners, search overlay, filters, and working simulations of Wallet, inbox, Face ID, desk check-in and refused-entry refunds | Back-end tests, plus a browser check on the live link |
| 19 | Owner feedback: black and white photos make it hard to judge a gym | Colour on every gym photo, with black and white kept for the login screen and city tiles | Live browser check |
| 20 | Owner feedback: the design was good but not exciting | Photo-led cards, swipeable Home, cinematic gym page, hologram moment, lime ribbon, designed loading and error states | Live browser check |
| 21 | Owner feedback: the map did not show their location | Added a you-are-here dot and a locate button. Location stays in memory only | Live browser check |

## Second round: BMad process notes

- The spec was written before this round's code, which is an improvement on the first round.
- Claude Code again wrote the code directly instead of a fresh subagent, so the owner's changes could be applied as they came.
- The owner asked to push, deploy and then test, so the live check and the BMad review run after the first deploy of this round.

## Checks run

- `npm run typecheck`: no errors.
- `npm test`: 13 of 13 pass against the real database. They cover 20 results per page, declined payment, double payment, racing for a last spot, reschedule, two changes at once, reused checkout keys, invalid times, login and logout, reading another person's pass, the 24-hour rule, refund and ownership, and price differences between gyms.
- BMad review: all 4 reviewers reported. The fourth (Edge Case Hunter) came back after the fixes were deployed, and its about 40 smaller findings are not yet checked or fixed. The spec stays at `in-review` because triage is incomplete. See its Review Triage Log for what was fixed and what was left.
- Browser walkthrough at phone size as a new user: book, decline, retry, pay, pass, reschedule, updated confirmation.

## Limits to state honestly

- Gyms, prices and reviews are invented sample data, so NFR8 (pin within 50 m of the real entrance) cannot be shown.
- Payment is simulated at the owner's request. No external provider is connected, so FR6 is met in the flow but not with real money.
- The wallet pass is a preview. A real one needs Apple and Google developer accounts.
- The day-before reminder is an in-app banner and a calendar alert. No email or push is sent.
- Account deletion records the request, logs the person out and blocks further logins. The erasure itself within 30 days is not automated yet.
- NFR5 is only partly met: the login cookie is set once, so regular users are logged out 30 days after logging in, not after 30 days unused.
- Face ID uses passkeys. The setup step was reached, but a real Face ID login was not completed on a physical device.
- NFR3 needs five real test users. NFR1 and NFR9 were not measured on a mid-range phone or under load. NFR10 can only be measured over time.
- WCAG 2.2 AA was designed for but not formally audited.

## Peer test

Still to do by the student. See `peer-feedback-template.md`. No feedback has been invented here.
