# Daypass user journeys

Every journey in the app, tied back to the Gym App Product Build Pack. The visual version is `index.html`.

Source key: **Pack** is in the build pack's story maps. **Later** is below its MVP line. **Added** came from the owner's feedback.

## J1: Find, book and visit a gym

A traveler finds a gym nearby, books and pays for a visit, and gets there. Stories 1, 2, 3 and 5.

- **Who:** Member
- **From:** Build pack, Journey 1

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Search or select location | Give location permission and choose my location | `/home, /gyms` | Pack | Story 1, FR1, NFR6 | [Hero](screens/home-01-hero.jpg), [Location ask](screens/find-02-location-ask.jpg), [Search city](screens/find-01-search-city.jpg) |
| 2 | See gyms on the list and map | View gyms on the list and map, 20 per page | `/gyms?city=` | Pack | Story 1, FR1, NFR1 | [List and map](screens/find-03-list-and-map.jpg), [Gym cards](screens/find-04-gym-cards.jpg), [Full map](screens/find-06-full-map.jpg), [Map pin](screens/find-07-map-pin.jpg) |
| 3 | View gym details | Open a gym and view its details | `/gyms/[gym]` | Pack | Story 2, FR2, NFR8 | [Photos](screens/gym-01-photos.jpg), [What is included](screens/gym-04-what-is-included.jpg), [Hours and equipment](screens/gym-05-hours-and-equipment.jpg), [Location](screens/gym-06-location.jpg), [Reviews](screens/gym-07-reviews.jpg) |
| 4 | Book an appointment | Choose date and time | `/gyms/[gym]` | Pack | Story 3, FR4 | [Pick a time](screens/gym-02-pick-a-time.jpg), [Time chosen](screens/gym-03-time-chosen.jpg) |
| 5 | Sign up or log in | Enter user details. Only appears when booking | `Sheet, or /login` | Pack | Story 3, FR5, NFR5 | [Login when booking](screens/book-01-login-when-booking.jpg), [Log in](screens/login-01-log-in.jpg), [Create account](screens/login-02-create-account.jpg) |
| 6 | Make payment | Choose payment type and pay | `Sheet` | Pack | Story 3, FR6, NFR7 | [Pay](screens/book-02-pay.jpg), [Paid](screens/book-04-paid.jpg) |
| 7 | Get the pass | Booking is confirmed and shows in My bookings | `/bookings/[id]` | Pack | Story 3 AC1, FR7 | [Pass ready](screens/book-05-pass-ready.jpg), [Front](screens/pass-01-front.jpg), [What is included](screens/pass-02-what-is-included.jpg), [Actions](screens/pass-03-actions.jpg) |
| 8 | Get directions | Navigate to the gym | `Sheet on the pass` | Pack | Story 5, FR9 | [Directions](screens/pass-05-directions.jpg) |
| 9 | Keep it handy | Calendar from the build pack, Wallet preview added | `Sheets, /wallet` | Added | FR10 | [Add to calendar](screens/pass-06-add-to-calendar.jpg), [Add to wallet](screens/pass-07-add-to-wallet.jpg), [Wallet](screens/pass-08-wallet.jpg) |
| 10 | Rate the gym | Rate my experience out of 5, with an optional review | `/bookings/[id]` | Pack | Journey 1, last column | [Rate the gym](screens/door-12-rate-the-gym.jpg), [Rated](screens/door-13-rated.jpg) |

**What if:**

- **Location denied** (step 1): Type a city instead (Story 1, AC2). [Screen](screens/find-01-search-city.jpg)
- **Sort or filter (later)** (step 2): Results change and the page returns to the top. [Screen](screens/find-05-filters.jpg)
- **Nothing matches** (step 2): Told so, and offered Clear filters. [Screen](screens/find-08-no-results.jpg)
- **Gym has no photos** (step 3): All details still show, with a placeholder (Story 2, AC2). [Screen](screens/gym-08-no-photos.jpg)
- **Payment fails** (step 6): No booking is made and nothing is charged (Story 3, AC2). [Screen](screens/book-03-payment-declined.jpg)
- **No maps app** (step 8): The route opens in the browser (Story 5, AC2). [Screen](screens/pass-05-directions.jpg)

## J2: Return to the app and reschedule

A traveler with a booking comes back and moves it to a new time. Story 4.

- **Who:** Member
- **From:** Build pack, Journey 2

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Return to the app | Open the app and stay logged in | `/home` | Pack | NFR5: session lasts 30 days unused | [Time left on home](screens/door-06-time-left-on-home.jpg), [Inbox](screens/other-01-inbox.jpg) |
| 2 | Find my booking | Open My bookings | `/bookings` | Pack | Story 4, FR7 | [List](screens/passes-01-list.jpg), [Past visit](screens/passes-02-past-visit.jpg), [Actions](screens/pass-03-actions.jpg) |
| 3 | Reschedule | Pick a new date and time | `Sheet on the pass` | Pack | Story 4, FR8 | [New time](screens/change-01-new-time.jpg) |
| 4 | Confirm the change | See the old and new slot, and confirm | `Sheet on the pass` | Pack | Story 4 AC1, FR8 | [Old and new](screens/change-03-old-and-new.jpg) |
| 5 | Get updated details | Receive confirmation, directions and calendar | `/bookings/[id]` | Pack | Story 4 AC1, FR9, FR10 | [Updated](screens/change-04-updated.jpg), [Directions](screens/pass-05-directions.jpg), [Add to calendar](screens/pass-06-add-to-calendar.jpg) |

**What if:**

- **Day before (later)** (step 1): A reminder lands in the Inbox. [Screen](screens/other-01-inbox.jpg)
- **Another gym (later)** (step 3): Move the booking, paying or getting back the difference. [Screen](screens/change-02-another-gym.jpg)
- **Plans fell through** (step 3): Cancel and get refunded. [Screen](screens/change-05-cancel.jpg)
- **Less than 24 hours away** (step 4): Told changes are no longer possible (Story 4, AC2). [Screen](screens/change-06-too-late.jpg)

## J3: At the door: scan in, train, scan out

One scan confirms on both devices within about 2 seconds, then a 1-hour countdown runs, with a 15-minute grace period before and after. A later scan checks the person out.

- **Who:** Member and front desk
- **From:** Added: owner feedback, not in the build pack

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Show the pass | Member opens the QR code at the desk | `Full screen on the pass` | Added | Member | [Show at desk](screens/door-01-show-at-desk.jpg) |
| 2 | Desk scans | Front desk scans, or types the code | `/staff` | Added | Front desk | [Scanner](screens/door-02-scanner.jpg) |
| 3 | Both devices confirm | Desk says Checked in, and the phone says it by itself | `/staff and the pass` | Added | Both devices | [Desk says checked in](screens/door-03-desk-says-checked-in.jpg), [Phone says checked in](screens/door-04-phone-says-checked-in.jpg) |
| 4 | Time left runs | Counts down the booked hour, on the pass and on Home | `/bookings/[id], /home` | Added | Member | [Time left](screens/door-05-time-left.jpg), [Time left on home](screens/door-06-time-left-on-home.jpg) |
| 5 | Scan out | A later scan, a slide on the pass, or Out on the panel | `/staff and the pass` | Added | Both devices | [Desk says checked out](screens/door-08-desk-says-checked-out.jpg), [Phone says checked out](screens/door-10-phone-says-checked-out.jpg) |
| 6 | Visit done | Entry, exit and time inside are kept, then rate the gym | `/bookings/[id]` | Added | Leads to Rate the gym in J1 | [Visit done](screens/door-11-visit-done.jpg), [Rate the gym](screens/door-12-rate-the-gym.jpg) |

**What if:**

- **Unknown code** (step 2): Not found. [Screen](screens/door-15-scan-not-found.jpg)
- **More than 15 minutes early** (step 2): Says too early. The door opens 15 minutes before the start.
- **Old or used pass** (step 2): Refused, and says which day. [Screen](screens/door-14-scan-already-used.jpg)
- **Scanned twice within 60 seconds** (step 3): Says Already in, and the visit carries on.
- **The hour ends** (step 4): A labelled 15-minute grace period counts down. [Screen](screens/door-16-grace-period.jpg)
- **Grace runs out** (step 4): Timer goes negative and red. [Screen](screens/door-07-over-time.jpg)
- **Gym refuses entry** (step 4): Claim a full refund. [Screen](screens/door-09-cant-get-in.jpg)
- **Never scanned out** (step 5): After 6 hours the timer stops, and the exit shows as not recorded. [Screen](screens/passes-02-past-visit.jpg)

## J4: Run the front desk

Real bookings and real scans only, so it shows zero until someone is scanned. Works across all gyms.

- **Who:** Admin: anyone with the password
- **From:** Added: owner feedback, not in the build pack

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Enter the password | No account needed | `/owner` | Added | Admin | [Password](screens/desk-01-password.jpg) |
| 2 | See the day | All zero until someone is scanned | `/owner` | Added | Real data only | [Panel zero](screens/desk-02-panel-zero.jpg) |
| 3 | Scan people in and out | Links to the door journey, J3 | `/staff` | Added | See J3 | [Scanner](screens/door-02-scanner.jpg), [Desk says checked in](screens/door-03-desk-says-checked-in.jpg) |
| 4 | Watch who is in | Time left for each person, updating every 4 seconds | `/owner` | Added | Live | [Panel someone in](screens/desk-03-panel-someone-in.jpg), [Panel over time](screens/desk-05-panel-over-time.jpg) |
| 5 | Read the log | Who came in and left today, and for how long | `/owner` | Added | Live | [Todays log](screens/desk-06-todays-log.jpg) |

**What if:**

- **Choose one gym** (step 2): Filters the panel to that gym. [Screen](screens/desk-04-one-gym.jpg)

## J5: List a gym

A gym lists itself for free, sets its price, pays 15% per booking and confirms its details every 90 days.

- **Who:** Gym owner
- **From:** Build pack: "Gyms list themselves and set their own day pass price", NFR8

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Find the offer | Tap Own a gym on Home | `/home` | Pack | Assumptions, section 1 | [Own a gym](screens/home-05-own-a-gym.jpg) |
| 2 | Read the deal | Your own price, 15% only when booked | `/partners` | Pack | Assumptions, section 1 | [Sell quiet hours](screens/gymowner-01-sell-quiet-hours.jpg) |
| 3 | List the gym | Log in and fill in the details | `/partners` | Pack | NFR8: confirm details every 90 days | [List a gym](screens/gymowner-02-list-a-gym.jpg) |

## J6: Track my training

A calendar of real visits, with rings, history and notes.

- **Who:** Member
- **From:** Added: owner feedback, not in the build pack

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Open my profile | Visits, cities and spend | `/account` | Added | Reuses FR7 data | [Profile](screens/account-01-profile.jpg) |
| 2 | Read rings and calendar | Swipe between months | `/account` | Added |  | [Rings and calendar](screens/account-02-rings-and-calendar.jpg) |
| 3 | Open a day | Times, time inside and a note that saves | `Sheet` | Added |  | [Day and note](screens/account-03-day-and-note.jpg) |
| 4 | Open a ring | History for that goal, and each row opens its day | `Sheet` | Added |  | [Ring history](screens/account-04-ring-history.jpg) |

## J7: Manage my account

Preferences, saved payment, Face ID, reminders, saved gyms, privacy and deletion.

- **Who:** Member
- **From:** Build pack stories below the MVP line, NFR5, NFR6

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
| 1 | Open settings | Every setting in one list | `/account` | Pack |  | [Menu](screens/settings-06-menu.jpg) |
| 2 | Search preferences | Save my preferences | `Sheet` | Later | J1, below the MVP line | [Search preferences](screens/settings-01-search-preferences.jpg) |
| 3 | Saved payment | Save my card for next time | `Sheet` | Later | J1, below the MVP line | [Saved payment](screens/settings-02-saved-payment.jpg) |
| 4 | Face ID | Log in with Face ID | `Sheet` | Later | J2, below the MVP line | [Face id](screens/settings-03-face-id.jpg) |
| 5 | Reminders | Get a reminder the day before | `Sheet, /inbox` | Later | J2, below the MVP line | [Reminders](screens/settings-04-reminders.jpg), [Inbox](screens/other-01-inbox.jpg) |
| 6 | Saved gyms | Gyms I tapped the heart on | `/saved` | Added |  | [Saved](screens/other-02-saved.jpg) |
| 7 | Privacy and deletion | Read the notice and erase my account | `/privacy, sheet` | Pack | NFR6: GDPR | [Privacy](screens/other-03-privacy.jpg), [Delete account](screens/settings-05-delete-account.jpg) |

## Build pack story map coverage

| Map | Line | Story card | Screen | Status |
|-----|------|------------|--------|--------|
| J1 | MVP | Ask for location permission | [Location ask](screens/find-02-location-ask.jpg) | Built |
| J1 | MVP | Show nearby gyms from my current location | [List and map](screens/find-03-list-and-map.jpg) | Built |
| J1 | MVP | Show gym pins on the map and in a list | [Full map](screens/find-06-full-map.jpg) | Built |
| J1 | MVP | See photos, details, location and a Book button | [Photos](screens/gym-01-photos.jpg) | Built |
| J1 | MVP | View and select free dates and slots | [Pick a time](screens/gym-02-pick-a-time.jpg) | Built |
| J1 | MVP | Confirm my selection | [Time chosen](screens/gym-03-time-chosen.jpg) | Built |
| J1 | MVP | Log in with my existing account | [Log in](screens/login-01-log-in.jpg) | Built |
| J1 | MVP | Register a new account | [Create account](screens/login-02-create-account.jpg) | Built |
| J1 | MVP | Choose payment type and pay | [Pay](screens/book-02-pay.jpg) | Simulated: no outside provider |
| J1 | MVP | View booked and previous appointments | [List](screens/passes-01-list.jpg) | Built |
| J1 | MVP | Cancel an appointment | [Cancel](screens/change-05-cancel.jpg) | Built |
| J1 | MVP | Open directions in my maps app | [Directions](screens/pass-05-directions.jpg) | Built |
| J1 | Later | Type a city instead | [Search city](screens/find-01-search-city.jpg) | Built |
| J1 | Later | Recommend top gyms by rating, location and price | [Gym cards](screens/find-04-gym-cards.jpg) | Built |
| J1 | Later | Filter gyms by map zoom level | [Full map](screens/find-06-full-map.jpg) | Built: search this area |
| J1 | Later | Sort gyms by price and rating | [Filters](screens/find-05-filters.jpg) | Built |
| J1 | Later | Read reviews | [Reviews](screens/gym-07-reviews.jpg) | Built, with sample reviews |
| J1 | Later | Save my preferences | [Search preferences](screens/settings-01-search-preferences.jpg) | Built |
| J1 | Later | Save my card for next time | [Saved payment](screens/settings-02-saved-payment.jpg) | Built, simulated |
| J1 | Later | Get a prompt to rate the gym | [Rate the gym](screens/door-12-rate-the-gym.jpg) | Built |
| J1 | Later | Add a text review | [Rate the gym](screens/door-12-rate-the-gym.jpg) | Built |
| J2 | MVP | Stay logged in when I return | [Time left on home](screens/door-06-time-left-on-home.jpg) | Built |
| J2 | MVP | See my upcoming bookings | [List](screens/passes-01-list.jpg) | Built |
| J2 | MVP | Open the booking I want to change | [Actions](screens/pass-03-actions.jpg) | Built |
| J2 | MVP | See free slots at the same gym | [New time](screens/change-01-new-time.jpg) | Built |
| J2 | MVP | Select a new slot | [New time](screens/change-01-new-time.jpg) | Built |
| J2 | MVP | See old vs new slot and confirm | [Old and new](screens/change-03-old-and-new.jpg) | Built |
| J2 | MVP | Get blocked if less than 24 h before | [Too late](screens/change-06-too-late.jpg) | Built |
| J2 | MVP | Get an updated confirmation | [Updated](screens/change-04-updated.jpg) | Built |
| J2 | MVP | Open directions to the gym | [Directions](screens/pass-05-directions.jpg) | Built |
| J2 | Later | Log in with Face ID | [Face id](screens/settings-03-face-id.jpg) | Built, not proven on a real device |
| J2 | Later | Get a reminder the day before | [Inbox](screens/other-01-inbox.jpg) | In-app only: no email or push |
| J2 | Later | Move the booking to another gym | [Another gym](screens/change-02-another-gym.jpg) | Built |
| J2 | Later | Pay a price difference or get a refund | [Another gym](screens/change-02-another-gym.jpg) | Built, simulated |
| J2 | Later | Add the new time to my calendar | [Add to calendar](screens/pass-06-add-to-calendar.jpg) | Built |

## Requirements from the build pack

The status comes from "Limits to state honestly" in `process-log.md`.

| ID | What it asks | Where to see it | Status |
|----|--------------|-----------------|--------|
| FR1 | Show gyms near the user on a list and a map, at least 20 per page | [List and map](screens/find-03-list-and-map.jpg) | Met |
| FR2 | Show photos, opening hours, equipment, price and location | [Photos](screens/gym-01-photos.jpg) | Met |
| FR3 | Sort and filter gyms by rating and price | [Filters](screens/find-05-filters.jpg) | Met |
| FR4 | Show free dates and slots, and book without contacting the gym | [Pick a time](screens/gym-02-pick-a-time.jpg) | Met |
| FR5 | Sign up and log in so bookings are saved | [Log in](screens/login-01-log-in.jpg) | Met |
| FR6 | Take payment through an external provider | [Pay](screens/book-02-pay.jpg) | Partly: the flow works, but payment is simulated at the owner's request |
| FR7 | Show upcoming and past bookings | [List](screens/passes-01-list.jpg) | Met |
| FR8 | Reschedule or cancel until 24 hours before | [Old and new](screens/change-03-old-and-new.jpg) | Met |
| FR9 | Open directions in the user's maps app | [Directions](screens/pass-05-directions.jpg) | Met |
| FR10 | Add a session to the personal calendar | [Add to calendar](screens/pass-06-add-to-calendar.jpg) | Met |
| NFR1 | Map and list load within 2 s on a mid-range phone on 4G | [List and map](screens/find-03-list-and-map.jpg) | Partly: list and pins about 1.4 s in simulation, full street map about 6 to 7 s |
| NFR2 | No sideways scrolling from 360 px to desktop | [Find](screens/desktop-02-find.jpg) | Partly: tested in Chrome, only partly in the Safari engine, not in Firefox |
| NFR3 | 4 of 5 first-time users book within 3 minutes unaided | [Pick a time](screens/gym-02-pick-a-time.jpg) | Not measured: needs five real test users |
| NFR4 | WCAG 2.2 AA, text resizable to 200% | [Hero](screens/home-01-hero.jpg) | Not audited: designed for it. Removing the Home pause button goes against 2.2.2 |
| NFR5 | HTTPS, hashed passwords, session ends after 30 days unused | [Log in](screens/login-01-log-in.jpg) | Met |
| NFR6 | GDPR, EU hosting, location not stored, deletion within 30 days | [Delete account](screens/settings-05-delete-account.jpg) | Met, with one thing to note: the front desk shows first name and last initial to anyone with the password |
| NFR7 | Booking only after payment succeeds, no double charges | [Payment declined](screens/book-03-payment-declined.jpg) | Met, tested |
| NFR8 | Pin within 50 m of the entrance, details confirmed every 90 days | [Location](screens/gym-06-location.jpg) | Partly: gyms are sample data, so the 50 m cannot be shown |
| NFR9 | Results within 2 s with 500 gyms and 1,000 users | [Gym cards](screens/find-04-gym-cards.jpg) | Not measured under load |
| NFR10 | At least 99.5% uptime | [Hero](screens/home-01-hero.jpg) | Not measurable yet: needs time |

## Screens

### Home

- [Hero](screens/home-01-hero.jpg)
- [Gyms](screens/home-02-gyms.jpg)
- [Categories](screens/home-03-categories.jpg)
- [Cities](screens/home-04-cities.jpg)
- [Own a gym](screens/home-05-own-a-gym.jpg)

### Find

- [Search city](screens/find-01-search-city.jpg)
- [Location ask](screens/find-02-location-ask.jpg)
- [List and map](screens/find-03-list-and-map.jpg)
- [Gym cards](screens/find-04-gym-cards.jpg)
- [Filters](screens/find-05-filters.jpg)
- [Full map](screens/find-06-full-map.jpg)
- [Map pin](screens/find-07-map-pin.jpg)
- [No results](screens/find-08-no-results.jpg)

### Gym page

- [Photos](screens/gym-01-photos.jpg)
- [Pick a time](screens/gym-02-pick-a-time.jpg)
- [Time chosen](screens/gym-03-time-chosen.jpg)
- [What is included](screens/gym-04-what-is-included.jpg)
- [Hours and equipment](screens/gym-05-hours-and-equipment.jpg)
- [Location](screens/gym-06-location.jpg)
- [Reviews](screens/gym-07-reviews.jpg)
- [No photos](screens/gym-08-no-photos.jpg)

### Log in

- [Log in](screens/login-01-log-in.jpg)
- [Create account](screens/login-02-create-account.jpg)

### Book and pay

- [Login when booking](screens/book-01-login-when-booking.jpg)
- [Pay](screens/book-02-pay.jpg)
- [Payment declined](screens/book-03-payment-declined.jpg)
- [Paid](screens/book-04-paid.jpg)
- [Pass ready](screens/book-05-pass-ready.jpg)

### Passes

- [List](screens/passes-01-list.jpg)
- [Past visit](screens/passes-02-past-visit.jpg)

### A pass

- [Front](screens/pass-01-front.jpg)
- [What is included](screens/pass-02-what-is-included.jpg)
- [Actions](screens/pass-03-actions.jpg)
- [Details](screens/pass-04-details.jpg)
- [Directions](screens/pass-05-directions.jpg)
- [Add to calendar](screens/pass-06-add-to-calendar.jpg)
- [Add to wallet](screens/pass-07-add-to-wallet.jpg)
- [Wallet](screens/pass-08-wallet.jpg)

### Change or cancel

- [New time](screens/change-01-new-time.jpg)
- [Another gym](screens/change-02-another-gym.jpg)
- [Old and new](screens/change-03-old-and-new.jpg)
- [Updated](screens/change-04-updated.jpg)
- [Cancel](screens/change-05-cancel.jpg)
- [Too late](screens/change-06-too-late.jpg)

### At the door

- [Show at desk](screens/door-01-show-at-desk.jpg)
- [Scanner](screens/door-02-scanner.jpg)
- [Desk says checked in](screens/door-03-desk-says-checked-in.jpg)
- [Phone says checked in](screens/door-04-phone-says-checked-in.jpg)
- [Time left](screens/door-05-time-left.jpg)
- [Time left on home](screens/door-06-time-left-on-home.jpg)
- [Over time](screens/door-07-over-time.jpg)
- [Desk says checked out](screens/door-08-desk-says-checked-out.jpg)
- [Cant get in](screens/door-09-cant-get-in.jpg)
- [Phone says checked out](screens/door-10-phone-says-checked-out.jpg)
- [Visit done](screens/door-11-visit-done.jpg)
- [Rate the gym](screens/door-12-rate-the-gym.jpg)
- [Rated](screens/door-13-rated.jpg)
- [Scan already used](screens/door-14-scan-already-used.jpg)
- [Scan not found](screens/door-15-scan-not-found.jpg)
- [Grace period](screens/door-16-grace-period.jpg)

### Front desk panel

- [Password](screens/desk-01-password.jpg)
- [Panel zero](screens/desk-02-panel-zero.jpg)
- [Panel someone in](screens/desk-03-panel-someone-in.jpg)
- [One gym](screens/desk-04-one-gym.jpg)
- [Panel over time](screens/desk-05-panel-over-time.jpg)
- [Todays log](screens/desk-06-todays-log.jpg)

### Gym owners

- [Sell quiet hours](screens/gymowner-01-sell-quiet-hours.jpg)
- [List a gym](screens/gymowner-02-list-a-gym.jpg)

### Profile and calendar

- [Profile](screens/account-01-profile.jpg)
- [Rings and calendar](screens/account-02-rings-and-calendar.jpg)
- [Day and note](screens/account-03-day-and-note.jpg)
- [Ring history](screens/account-04-ring-history.jpg)

### Settings

- [Search preferences](screens/settings-01-search-preferences.jpg)
- [Saved payment](screens/settings-02-saved-payment.jpg)
- [Face id](screens/settings-03-face-id.jpg)
- [Reminders](screens/settings-04-reminders.jpg)
- [Delete account](screens/settings-05-delete-account.jpg)
- [Menu](screens/settings-06-menu.jpg)

### Other screens

- [Inbox](screens/other-01-inbox.jpg)
- [Saved](screens/other-02-saved.jpg)
- [Privacy](screens/other-03-privacy.jpg)
- [Credits](screens/other-04-credits.jpg)
- [Not found](screens/other-05-not-found.jpg)
- [Offline](screens/other-06-offline.jpg)

### Desktop

- [Home](screens/desktop-01-home.jpg)
- [Find](screens/desktop-02-find.jpg)
- [Gym](screens/desktop-03-gym.jpg)
