<p align="center">
  <a href="https://daypass-six.vercel.app"><img src="userflow/readme/banner.jpg" alt="Daypass: one gym, one day, no contract. Three phone screens showing gym search, a day pass with a QR code and a visit countdown." width="100%"></a>
</p>

<p align="center">
  <b>Book a gym for the day, in any city. No membership, no contract, just a pass on your phone.</b>
</p>

<p align="center">
  <a href="https://daypass-six.vercel.app"><img src="https://img.shields.io/badge/Try_it_live-d7ff3e?style=for-the-badge&logo=vercel&logoColor=000" alt="Try it live"></a>
  <a href="userflow/journeys.md"><img src="https://img.shields.io/badge/All_user_journeys-111?style=for-the-badge&logo=figma&logoColor=d7ff3e" alt="All user journeys"></a>
  <a href="#run-it-on-your-computer"><img src="https://img.shields.io/badge/Run_it_locally-111?style=for-the-badge&logo=nodedotjs&logoColor=d7ff3e" alt="Run it locally"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=fff" alt="Next.js">
  <img src="https://img.shields.io/badge/React-000?logo=react&logoColor=61dafb" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-000?logo=typescript&logoColor=3178c6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Neon_Postgres-000?logo=postgresql&logoColor=00e599" alt="Neon Postgres">
  <img src="https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=fff" alt="Vercel">
  <img src="https://img.shields.io/badge/Installable_app-000?logo=pwa&logoColor=d7ff3e" alt="Installable web app">
  <img src="https://img.shields.io/badge/95_automated_tests-000?logo=checkmarx&logoColor=d7ff3e" alt="95 automated tests">
  <img src="https://img.shields.io/badge/Planned_with-BMad-d7ff3e?labelColor=000" alt="Planned with BMad">
</p>

<p align="center">
  <a href="#see-it-in-action">See it in action</a> ·
  <a href="#guide-for-the-professor">Professor's guide</a> ·
  <a href="#what-you-can-do">Features</a> ·
  <a href="#every-journey-step-by-step">Journeys</a> ·
  <a href="#screens">Screens</a> ·
  <a href="#how-it-checks-against-the-brief">Brief checklist</a> ·
  <a href="#how-it-was-made">How it was made</a> ·
  <a href="#run-it-on-your-computer">Run it</a>
</p>

---

## The idea

You're travelling, or your usual gym is across town, and you just want to train for an hour. Today that means a sign-up form, a joining fee and a month's contract.

**Daypass** turns that into four taps: find a gym near you, pick a time, pay, and walk in with a pass on your phone. The front desk scans it, your hour starts counting down, and the visit is saved to your training calendar.

Gyms win too. They list themselves for free, set their own price and sell their quiet hours, paying 15% only when someone books.

> [!NOTE]
> This is a working class project, not a real business. The gyms are sample listings across 8 European cities and **payments are simulated**, so no real money moves. Everything else is real: accounts, bookings, scans at the door and the front-desk panel all run on a live database.

## See it in action

<table>
  <tr>
    <td width="44%" align="center">
      <img src="userflow/readme/walkthrough.gif" alt="Animated walkthrough: open the app, find a gym, pick a time, pay, get the pass, show it at the desk, check in, watch the hour count down and rate the gym." width="320">
    </td>
    <td width="56%">

**From "where can I train?" to "checked in" in ten steps.**

1. Open Daypass and say where you're training
2. Browse gyms on a list or a map
3. Look at photos, equipment, hours and reviews
4. Pick a free time slot
5. Log in only now, then pay with a saved card
6. Your pass is ready, with a QR code
7. Show it at the front desk
8. **Both phones confirm** within about 2 seconds
9. Your hour counts down, with a 15-minute grace period
10. Scan out, see your visit, rate the gym

<a href="https://daypass-six.vercel.app"><b>Try it on your phone →</b></a>

  </td>
  </tr>
</table>

## Guide for the professor

<sub>For anyone marking or reviewing this project. It takes about 5 minutes, ideally on a phone.</sub>

**Try the app**

1. **Open [daypass-six.vercel.app](https://daypass-six.vercel.app)** on your phone. To see it as an app, use *Share → Add to Home Screen* on iPhone, or *⋮ → Add to Home screen* on Android.
2. **Browse freely.** There's no login wall. Search a city, open the map, look at a gym.
3. **Book a time.** Pick a slot and swipe to book. Logging in appears only now. Tap **Skip this, use a demo account** to get a throwaway account with some sample visits, which is deleted after 14 days.
4. **Pay.** It's *Demo Pay*, so no real money moves. Choose **Test decline** first to see a failed payment that books nothing, then **Demo card** to pay.
5. **Walk in.** On the pass, tap **Show at the desk**, then **Demo: simulate the desk scan**. The phone confirms the check-in and the 1-hour countdown starts. To try it with two real devices, open the [front desk](https://daypass-six.vercel.app/owner) on a laptop with the password **`uxdd`**, then scan the phone's QR code with the scanner. The panel shows who's in and their time left, live.
6. **Look around.** Change the booking (blocked within 24 hours), check *Account* for the training calendar, and scan out to rate the gym.

**Find the coursework evidence**

| The brief asks for | Where it is |
|---|---|
| A story built with BMad | The specs in [`_bmad-output/implementation-artifacts`](_bmad-output/implementation-artifacts) and the [BMad usage record](_bmad-output/BMAD-usage-record.txt) |
| A record of failures and corrections | [`process-log.md`](_bmad-output/implementation-artifacts/process-log.md): every problem, what was tried and what fixed it |
| Feedback from a student outside the team | [`peer-feedback-template.md`](_bmad-output/implementation-artifacts/peer-feedback-template.md), with resulting changes in the process log |
| User journeys and screens | [`userflow/journeys.md`](userflow/journeys.md), 7 journeys and 86 screens, linked to the build pack |
| How it measures up | [The brief checklist](#how-it-checks-against-the-brief) below, including what isn't met |

## What you can do

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="userflow/screens/find-04-gym-cards.jpg" alt="Gym cards for Berlin with price, rating, distance and next free time">
      <h3>Find</h3>
      Search a city or share your location. Gyms show on a list and a map, sorted by best match, nearest or cheapest, with filters for price and rating.
    </td>
    <td width="33%" valign="top">
      <img src="userflow/screens/gym-03-time-chosen.jpg" alt="Booking a session: a date strip and a grid of free time slots">
      <h3>Book</h3>
      See free slots for the next week and swipe to book. Logging in only appears at this point, so you can browse without an account.
    </td>
    <td width="33%" valign="top">
      <img src="userflow/screens/book-05-pass-ready.jpg" alt="A holographic day pass for Iron Gym, Berlin, with a QR code">
      <h3>Get your pass</h3>
      A pass with a QR code, directions, add to calendar and a Wallet preview. Change the time or gym, or cancel, until 24 hours before.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <img src="userflow/screens/door-05-time-left.jpg" alt="A countdown showing 59 minutes 56 seconds left, with a slide to check out">
      <h3>Walk in</h3>
      The desk scans your pass and both screens confirm. Your hour counts down, then a labelled 15-minute grace period, then goes red.
    </td>
    <td valign="top">
      <img src="userflow/screens/account-02-rings-and-calendar.jpg" alt="Activity rings and a monthly calendar of visits">
      <h3>Track</h3>
      Rings for visits, gyms tried and cities this year, plus a calendar of every real visit. Tap a day to see times and add a note.
    </td>
    <td valign="top">
      <img src="userflow/screens/desk-03-panel-someone-in.jpg" alt="The front desk panel showing who is in and how long they have left">
      <h3>Run the desk</h3>
      A live panel for gym staff: who's in, how long they have left, who's over time, and today's log. Real scans only, no fake data.
    </td>
  </tr>
</table>

### And the small things

- **Works like an app.** Add it to your home screen on iPhone or Android and it opens full screen, with an offline page when there's no signal.
- **Face ID or fingerprint login,** using passkeys.
- **Built for phones first,** tested at iPhone 16 Pro Max size, and it scales up to a full desktop layout.
- **Private by design:** your location is never stored, and you can delete your account and all its data from Settings.
- **Honest about what's not real:** declined cards, "too late to change" and "this gym has no photos yet" all have their own screens.

## Every journey, step by step

Click a journey to open it. Each one comes with the real screens. The [interactive flow map](userflow/index.html) shows the same thing as a big zoomable diagram: download the repo and double-click `userflow/index.html`.

```mermaid
flowchart LR
    A([Open Daypass]) --> B[Find a gym<br/>list or map]
    B --> C[Gym page<br/>photos, hours, reviews]
    C --> D[Pick a time]
    D --> E{Logged in?}
    E -- no --> F[Log in or<br/>create account]
    E -- yes --> G[Pay]
    F --> G
    G -- declined --> G
    G -- paid --> H[Pass with QR code]
    H --> I[Desk scans]
    I --> J[1 hour countdown<br/>+ 15 min grace]
    J --> K[Scan out]
    K --> L([Rate the gym])
    H -. more than 24 h before .-> M[Change or cancel]
    M --> H

    classDef volt fill:#d7ff3e,stroke:#d7ff3e,color:#000;
    classDef dark fill:#111,stroke:#444,color:#fff;
    class A,H,L volt;
    class B,C,D,E,F,G,I,J,K,M dark;
```

<details>
<summary><b>J1 · Find, book and visit a gym</b> &nbsp;<sub>Member · from the brief</sub></summary>
<br>

A traveller finds a gym nearby, books and pays, and gets there.

<table>
  <tr>
    <td><img src="userflow/screens/find-02-location-ask.jpg" alt="Location request"><br><sub>1. Share location or type a city</sub></td>
    <td><img src="userflow/screens/find-03-list-and-map.jpg" alt="List and map"><br><sub>2. Gyms on a list and map</sub></td>
    <td><img src="userflow/screens/gym-01-photos.jpg" alt="Gym photos"><br><sub>3. Gym details</sub></td>
    <td><img src="userflow/screens/gym-02-pick-a-time.jpg" alt="Pick a time"><br><sub>4. Pick a time</sub></td>
  </tr>
  <tr>
    <td><img src="userflow/screens/book-01-login-when-booking.jpg" alt="Log in when booking"><br><sub>5. Log in only now</sub></td>
    <td><img src="userflow/screens/book-02-pay.jpg" alt="Pay"><br><sub>6. Pay</sub></td>
    <td><img src="userflow/screens/pass-01-front.jpg" alt="Pass"><br><sub>7. Get the pass</sub></td>
    <td><img src="userflow/screens/pass-05-directions.jpg" alt="Directions"><br><sub>8. Get directions</sub></td>
  </tr>
</table>

**What if…**
- *Location is denied:* type a city instead.
- *Nothing matches the filters:* you're told, with a Clear filters button.
- *The gym has no photos:* every detail still shows, with a placeholder.
- *The payment fails:* no booking is made and nothing is charged.

<table><tr>
  <td width="25%"><img src="userflow/screens/find-08-no-results.jpg" alt="No results"><br><sub>No results</sub></td>
  <td width="25%"><img src="userflow/screens/gym-08-no-photos.jpg" alt="No photos"><br><sub>No photos</sub></td>
  <td width="25%"><img src="userflow/screens/book-03-payment-declined.jpg" alt="Payment declined"><br><sub>Payment declined</sub></td>
  <td width="25%"><img src="userflow/screens/book-04-paid.jpg" alt="Paid"><br><sub>Paid</sub></td>
</tr></table>
</details>

<details>
<summary><b>J2 · Come back and reschedule</b> &nbsp;<sub>Member · from the brief</sub></summary>
<br>

Plans changed. Move the booking to a new time, or even another gym, and see the old and new side by side before confirming.

<table><tr>
  <td><img src="userflow/screens/passes-01-list.jpg" alt="My passes"><br><sub>1. Find my booking</sub></td>
  <td><img src="userflow/screens/change-01-new-time.jpg" alt="New time"><br><sub>2. Pick a new time</sub></td>
  <td><img src="userflow/screens/change-03-old-and-new.jpg" alt="Old and new"><br><sub>3. Old vs new</sub></td>
  <td><img src="userflow/screens/change-04-updated.jpg" alt="Updated"><br><sub>4. Updated</sub></td>
</tr></table>

**What if…**
- *It's less than 24 hours away:* changes are blocked, and the app says why.
- *You want another gym:* move it there, paying or getting back the difference.
- *Plans fell through:* cancel and get refunded.

<table><tr>
  <td width="33%"><img src="userflow/screens/change-06-too-late.jpg" alt="Too late to change"><br><sub>Too late to change</sub></td>
  <td width="33%"><img src="userflow/screens/change-02-another-gym.jpg" alt="Another gym"><br><sub>Another gym</sub></td>
  <td width="33%"><img src="userflow/screens/change-05-cancel.jpg" alt="Cancel"><br><sub>Cancel</sub></td>
</tr></table>
</details>

<details>
<summary><b>J3 · At the door: scan in, train, scan out</b> &nbsp;<sub>Member and front desk · added from feedback</sub></summary>
<br>

One scan confirms on **both** devices, the member's phone and the desk, within about 2 seconds. Then the hour counts down.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member's phone
    participant D as Front desk
    participant S as Daypass server
    M->>D: Shows QR code
    D->>S: Scan code
    S-->>D: Checked in ✓
    S-->>M: Checked in ✓ (on its own, ~2 s)
    Note over M: 1 hour countdown<br/>then 15 min grace
    D->>S: Scan again later
    S-->>D: Checked out ✓
    S-->>M: Visit done: time inside saved
    M->>S: Rate the gym
```

<table><tr>
  <td><img src="userflow/screens/door-01-show-at-desk.jpg" alt="Show at desk"><br><sub>1. Show the pass</sub></td>
  <td><img src="userflow/screens/door-03-desk-says-checked-in.jpg" alt="Desk says checked in"><br><sub>2. Desk: checked in</sub></td>
  <td><img src="userflow/screens/door-04-phone-says-checked-in.jpg" alt="Phone says checked in"><br><sub>3. Phone: checked in</sub></td>
  <td><img src="userflow/screens/door-06-time-left-on-home.jpg" alt="Time left on Home"><br><sub>4. Time left, also on Home</sub></td>
</tr><tr>
  <td><img src="userflow/screens/door-16-grace-period.jpg" alt="Grace period"><br><sub>Grace period</sub></td>
  <td><img src="userflow/screens/door-07-over-time.jpg" alt="Over time"><br><sub>Over time</sub></td>
  <td><img src="userflow/screens/door-11-visit-done.jpg" alt="Visit done"><br><sub>Visit done</sub></td>
  <td><img src="userflow/screens/door-14-scan-already-used.jpg" alt="Already used"><br><sub>Old pass refused</sub></td>
</tr></table>

**What if…** the code is unknown, it's more than 15 minutes early, the pass was already used, it's scanned twice by accident, the gym refuses entry (claim a full refund), or nobody scans out (the timer stops after 6 hours).
</details>

<details>
<summary><b>J4 · Run the front desk</b> &nbsp;<sub>Gym staff · added from feedback</sub></summary>
<br>

A password-protected panel for staff, covering every gym or just one. It updates every 4 seconds and shows only real bookings and scans, so it reads zero until someone walks in. Members appear as first name and last initial only.

<table><tr>
  <td><img src="userflow/screens/desk-02-panel-zero.jpg" alt="Panel at zero"><br><sub>Quiet day</sub></td>
  <td><img src="userflow/screens/door-02-scanner.jpg" alt="Scanner"><br><sub>Scanner</sub></td>
  <td><img src="userflow/screens/desk-05-panel-over-time.jpg" alt="Someone over time"><br><sub>Someone over time</sub></td>
  <td><img src="userflow/screens/desk-06-todays-log.jpg" alt="Today's log"><br><sub>Today's log</sub></td>
</tr></table>
</details>

<details>
<summary><b>J5 · List a gym</b> &nbsp;<sub>Gym owner · from the brief</sub></summary>
<br>

Free to list, your own price, 15% only when someone books. Details are confirmed every 90 days so listings stay accurate.

<table><tr>
  <td width="33%"><img src="userflow/screens/home-05-own-a-gym.jpg" alt="Own a gym"><br><sub>Find the offer</sub></td>
  <td width="33%"><img src="userflow/screens/gymowner-01-sell-quiet-hours.jpg" alt="Sell quiet hours"><br><sub>Read the deal</sub></td>
  <td width="33%"><img src="userflow/screens/gymowner-02-list-a-gym.jpg" alt="List a gym"><br><sub>List the gym</sub></td>
</tr></table>
</details>

<details>
<summary><b>J6 · Track my training</b> &nbsp;<sub>Member · added from feedback</sub></summary>
<br>

<table><tr>
  <td><img src="userflow/screens/account-01-profile.jpg" alt="Profile"><br><sub>Profile</sub></td>
  <td><img src="userflow/screens/account-02-rings-and-calendar.jpg" alt="Rings and calendar"><br><sub>Rings and calendar</sub></td>
  <td><img src="userflow/screens/account-03-day-and-note.jpg" alt="A day with a note"><br><sub>A day, with a note</sub></td>
  <td><img src="userflow/screens/account-04-ring-history.jpg" alt="Ring history"><br><sub>Ring history</sub></td>
</tr></table>
</details>

<details>
<summary><b>J7 · Manage my account</b> &nbsp;<sub>Member · from the brief</sub></summary>
<br>

<table><tr>
  <td><img src="userflow/screens/settings-06-menu.jpg" alt="Settings"><br><sub>Settings</sub></td>
  <td><img src="userflow/screens/settings-03-face-id.jpg" alt="Face ID"><br><sub>Face ID</sub></td>
  <td><img src="userflow/screens/settings-04-reminders.jpg" alt="Reminders"><br><sub>Reminders</sub></td>
  <td><img src="userflow/screens/settings-05-delete-account.jpg" alt="Delete account"><br><sub>Delete account</sub></td>
</tr></table>
</details>

## Screens

<p align="center">
  <img src="userflow/screens/desktop-02-find.jpg" alt="Desktop: finding gyms in Berlin" width="100%">
  <br><sub>The same app on a laptop</sub>
</p>

<details>
<summary><b>Open the full gallery: all 86 screens</b></summary>
<br>

| Home | Search | Gym | Book |
|:-:|:-:|:-:|:-:|
| <img src="userflow/screens/home-02-gyms.jpg" alt="Home: gyms" width="200"> | <img src="userflow/screens/find-01-search-city.jpg" alt="Search a city" width="200"> | <img src="userflow/screens/gym-04-what-is-included.jpg" alt="What is included" width="200"> | <img src="userflow/screens/book-04-paid.jpg" alt="Paid" width="200"> |
| <img src="userflow/screens/home-03-categories.jpg" alt="Home: categories" width="200"> | <img src="userflow/screens/find-05-filters.jpg" alt="Filters" width="200"> | <img src="userflow/screens/gym-05-hours-and-equipment.jpg" alt="Hours and equipment" width="200"> | <img src="userflow/screens/login-02-create-account.jpg" alt="Create account" width="200"> |
| <img src="userflow/screens/home-04-cities.jpg" alt="Home: cities" width="200"> | <img src="userflow/screens/find-06-full-map.jpg" alt="Full map" width="200"> | <img src="userflow/screens/gym-07-reviews.jpg" alt="Reviews" width="200"> | <img src="userflow/screens/login-01-log-in.jpg" alt="Log in" width="200"> |

| Pass | Keep it handy | Everything else | |
|:-:|:-:|:-:|:-:|
| <img src="userflow/screens/pass-02-what-is-included.jpg" alt="Back of the pass" width="200"> | <img src="userflow/screens/pass-06-add-to-calendar.jpg" alt="Add to calendar" width="200"> | <img src="userflow/screens/other-01-inbox.jpg" alt="Inbox" width="200"> | <img src="userflow/screens/other-02-saved.jpg" alt="Saved gyms" width="200"> |
| <img src="userflow/screens/pass-04-details.jpg" alt="Pass details" width="200"> | <img src="userflow/screens/pass-07-add-to-wallet.jpg" alt="Add to Wallet" width="200"> | <img src="userflow/screens/settings-01-search-preferences.jpg" alt="Search preferences" width="200"> | <img src="userflow/screens/settings-02-saved-payment.jpg" alt="Saved payment" width="200"> |
| <img src="userflow/screens/passes-02-past-visit.jpg" alt="Past visit" width="200"> | <img src="userflow/screens/pass-08-wallet.jpg" alt="Wallet" width="200"> | <img src="userflow/screens/other-06-offline.jpg" alt="Offline" width="200"> | <img src="userflow/screens/other-05-not-found.jpg" alt="Page not found" width="200"> |

Every screen, with its name, is in [`userflow/screens`](userflow/screens).
</details>

## How it checks against the brief

The app was built from a product build pack with 10 functional requirements (what it must do) and 10 non-functional ones (how well it must do it). The list is honest: anything not fully met says so.

<details>
<summary><b>Functional requirements: 9 met, 1 partly</b></summary>
<br>

| | Requirement | Status |
|:-:|---|---|
| FR1 | Gyms near you on a list and map, 20+ per page | ✅ Met |
| FR2 | Photos, hours, equipment, price and location | ✅ Met |
| FR3 | Sort and filter by rating and price | ✅ Met |
| FR4 | Free slots, and booking without contacting the gym | ✅ Met |
| FR5 | Sign up and log in so bookings are saved | ✅ Met |
| FR6 | Payment through an outside provider | 🟡 Flow works, payment simulated on purpose |
| FR7 | Upcoming and past bookings | ✅ Met |
| FR8 | Reschedule or cancel until 24 h before | ✅ Met |
| FR9 | Directions in your maps app | ✅ Met |
| FR10 | Add to your calendar | ✅ Met |
</details>

<details>
<summary><b>Quality requirements: 3 met, 3 partly, 4 not measured yet</b></summary>
<br>

| | Requirement | Status |
|:-:|---|---|
| NFR1 | Map and list load in 2 s on 4G | 🟡 List and pins ~1.4 s; the full street map takes 6–7 s |
| NFR2 | No sideways scrolling, 360 px to desktop | 🟡 Tested in Chrome, partly in Safari, not in Firefox |
| NFR3 | 4 of 5 first-timers book within 3 minutes | ⚪ Needs five real test users |
| NFR4 | Accessibility (WCAG 2.2 AA) | ⚪ Designed for it, not audited |
| NFR5 | Secure logins, 30-day sessions | ✅ Met |
| NFR6 | GDPR: EU hosting, location not stored, deletion | ✅ Met |
| NFR7 | Booking only after payment, no double charges | ✅ Met and tested |
| NFR8 | Accurate pins, details re-confirmed every 90 days | 🟡 Built; sample gyms can't prove the 50 m accuracy |
| NFR9 | Fast with 500 gyms and 1,000 users | ⚪ Not load-tested |
| NFR10 | 99.5% uptime | ⚪ Needs time to measure |
</details>

The full mapping of every story card to its screen is in [`userflow/journeys.md`](userflow/journeys.md).

## How it was made

This was planned and built with the **[BMad Method](https://github.com/bmad-code-org/BMAD-METHOD)**, a step-by-step way of working with an AI coding agent: brief → specs → build → review. A student directed it, and Claude Code carried out the steps.

| What | Where |
|---|---|
| The specs the app was built from | [`_bmad-output/implementation-artifacts`](_bmad-output/implementation-artifacts) |
| Every decision and failure, with dates | [`process-log.md`](_bmad-output/implementation-artifacts/process-log.md) |
| How BMad was used, from the session log | [`BMAD-usage-record.txt`](_bmad-output/BMAD-usage-record.txt) |
| The user flow map and its scripts | [`userflow/`](userflow) |

<details>
<summary><b>What it's built with</b></summary>
<br>

| Part | Tool | Why |
|---|---|---|
| App | [Next.js](https://nextjs.org) + React + TypeScript | One codebase for pages and server |
| Database | [Neon](https://neon.tech) Postgres, EU region | Real bookings, kept in the EU for GDPR |
| Hosting | [Vercel](https://vercel.com) | The live link, updated on every deploy |
| Maps | [MapLibre](https://maplibre.org) | Free, open street maps with gym pins |
| QR codes | `qrcode` to draw, `jsQR` to scan | The desk scanner works in the phone's browser |
| Face ID login | [SimpleWebAuthn](https://simplewebauthn.dev) (passkeys) | No passwords to type |
| Tests | Node's built-in test runner + Puppeteer | 55 rule tests and 40 tests that click through the real app |

</details>

<details>
<summary><b>Where things are in the code</b></summary>
<br>

```
app/            Every page: home, gyms, bookings, account, staff, owner…
  api/          The server side: bookings, payments, scans, accounts
components/     Shared pieces: the pass, sheets, the map, the scanner
lib/            Booking rules, opening hours, logins, the database
public/         Photos, icons, the hero video, the offline page
scripts/        Set up and fill the database
tests/          Automated tests
userflow/       The flow map, all screenshots and the scripts that make them
_bmad-output/   BMad specs and the process log
```
</details>

## Run it on your computer

<details>
<summary><b>Step by step, no coding experience needed</b></summary>
<br>

**You need:** [Node.js](https://nodejs.org) version 22.18 or newer, and a free [Neon](https://neon.tech) database.

1. **Download the project.** Click the green **Code** button at the top of this page, then **Download ZIP**, and unzip it.
2. **Open a terminal in that folder.** On Windows, open the folder, click the address bar, type `cmd` and press Enter. On a Mac, right-click the folder and choose *New Terminal at Folder*.
3. **Add your database link.** Create a file called `.env.local` in the folder with one line, using the connection link from your Neon dashboard:
   ```
   DATABASE_URL=postgresql://...
   ```
4. **Install, set up and start.** Paste these one at a time:
   ```
   npm install
   npm run db:setup
   npm run dev
   ```
5. **Open [http://localhost:3000](http://localhost:3000)** in your browser. It stays up while the terminal window is open.

To run the tests: `npm test` for the booking rules, `npm run test:ui` for the click-through tests.
</details>

## Credits

Gym photos from [Unsplash](https://unsplash.com/license), city photos from Wikimedia Commons, and the hero video from [Mixkit](https://mixkit.co), each under its own free licence. The full list, with photographers, is on the app's [credits page](https://daypass-six.vercel.app/credits).

<p align="center"><br>
  <a href="https://daypass-six.vercel.app"><img src="https://img.shields.io/badge/Open_Daypass-d7ff3e?style=for-the-badge&logo=vercel&logoColor=000" alt="Open Daypass"></a>
</p>
