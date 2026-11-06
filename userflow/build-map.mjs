// Turns the journeys below into index.html and journeys.md. Run from the project folder: node userflow/build-map.mjs
// Everything in the map is written here, so a change only has to be made once.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const shots = new Set(readdirSync(join(HERE, 'screens')).map((f) => f.replace('.jpg', '')));

// source: 'pack' is a step in the build pack's story maps. 'later' is below its MVP line. 'added' came from the owner's feedback.
const JOURNEYS = [
  {
    id: 'j1', code: 'J1', title: 'Find, book and visit a gym', who: 'Member', source: 'Build pack, Journey 1',
    summary: 'A traveler finds a gym nearby, books and pays for a visit, and gets there. Stories 1, 2, 3 and 5.',
    steps: [
      { name: 'Search or select location', tag: 'pack', task: 'Give location permission and choose my location', route: '/home, /gyms', trace: 'Story 1, FR1, NFR6', screens: ['home-01-hero', 'find-02-location-ask', 'find-01-search-city'], branches: [{ when: 'Location denied', then: 'Type a city instead (Story 1, AC2)', screen: 'find-01-search-city' }] },
      { name: 'See gyms on the list and map', tag: 'pack', task: 'View gyms on the list and map, 20 per page', route: '/gyms?city=', trace: 'Story 1, FR1, NFR1', screens: ['find-03-list-and-map', 'find-04-gym-cards', 'find-06-full-map', 'find-07-map-pin'], branches: [{ when: 'Sort or filter (later)', then: 'Results change and the page returns to the top', screen: 'find-05-filters', trace: 'FR3' }, { when: 'Nothing matches', then: 'Told so, and offered Clear filters', screen: 'find-08-no-results' }] },
      { name: 'View gym details', tag: 'pack', task: 'Open a gym and view its details', route: '/gyms/[gym]', trace: 'Story 2, FR2, NFR8', screens: ['gym-01-photos', 'gym-04-what-is-included', 'gym-05-hours-and-equipment', 'gym-06-location', 'gym-07-reviews'], branches: [{ when: 'Gym has no photos', then: 'All details still show, with a placeholder (Story 2, AC2)', screen: 'gym-08-no-photos' }] },
      { name: 'Book an appointment', tag: 'pack', task: 'Choose date and time', route: '/gyms/[gym]', trace: 'Story 3, FR4', screens: ['gym-02-pick-a-time', 'gym-03-time-chosen'], branches: [] },
      { name: 'Sign up or log in', tag: 'pack', task: 'Enter user details. Only appears when booking', route: 'Sheet, or /login', trace: 'Story 3, FR5, NFR5', screens: ['book-01-login-when-booking', 'login-01-log-in', 'login-02-create-account'], branches: [] },
      { name: 'Make payment', tag: 'pack', task: 'Choose payment type and pay', route: 'Sheet', trace: 'Story 3, FR6, NFR7', screens: ['book-02-pay', 'book-04-paid'], branches: [{ when: 'Payment fails', then: 'No booking is made and nothing is charged (Story 3, AC2)', screen: 'book-03-payment-declined' }] },
      { name: 'Get the pass', tag: 'pack', task: 'Booking is confirmed and shows in My bookings', route: '/bookings/[id]', trace: 'Story 3 AC1, FR7', screens: ['book-05-pass-ready', 'pass-01-front', 'pass-02-what-is-included', 'pass-03-actions'], branches: [] },
      { name: 'Get directions', tag: 'pack', task: 'Navigate to the gym', route: 'Sheet on the pass', trace: 'Story 5, FR9', screens: ['pass-05-directions'], branches: [{ when: 'No maps app', then: 'The route opens in the browser (Story 5, AC2)', screen: 'pass-05-directions' }] },
      { name: 'Keep it handy', tag: 'added', task: 'Calendar from the build pack, Wallet preview added', route: 'Sheets, /wallet', trace: 'FR10', screens: ['pass-06-add-to-calendar', 'pass-07-add-to-wallet', 'pass-08-wallet'], branches: [] },
      { name: 'Rate the gym', tag: 'pack', task: 'Rate my experience out of 5, with an optional review', route: '/bookings/[id]', trace: 'Journey 1, last column', screens: ['door-12-rate-the-gym', 'door-13-rated'], branches: [] },
    ],
  },
  {
    id: 'j2', code: 'J2', title: 'Return to the app and reschedule', who: 'Member', source: 'Build pack, Journey 2',
    summary: 'A traveler with a booking comes back and moves it to a new time. Story 4.',
    steps: [
      { name: 'Return to the app', tag: 'pack', task: 'Open the app and stay logged in', route: '/home', trace: 'NFR5: session lasts 30 days unused', screens: ['door-06-time-left-on-home', 'other-01-inbox'], branches: [{ when: 'Day before (later)', then: 'A reminder lands in the Inbox', screen: 'other-01-inbox' }] },
      { name: 'Find my booking', tag: 'pack', task: 'Open My bookings', route: '/bookings', trace: 'Story 4, FR7', screens: ['passes-01-list', 'passes-02-past-visit', 'pass-03-actions'], branches: [] },
      { name: 'Reschedule', tag: 'pack', task: 'Pick a new date and time', route: 'Sheet on the pass', trace: 'Story 4, FR8', screens: ['change-01-new-time'], branches: [{ when: 'Another gym (later)', then: 'Move the booking, paying or getting back the difference', screen: 'change-02-another-gym' }, { when: 'Plans fell through', then: 'Cancel and get refunded', screen: 'change-05-cancel' }] },
      { name: 'Confirm the change', tag: 'pack', task: 'See the old and new slot, and confirm', route: 'Sheet on the pass', trace: 'Story 4 AC1, FR8', screens: ['change-03-old-and-new'], branches: [{ when: 'Less than 24 hours away', then: 'Told changes are no longer possible (Story 4, AC2)', screen: 'change-06-too-late' }] },
      { name: 'Get updated details', tag: 'pack', task: 'Receive confirmation, directions and calendar', route: '/bookings/[id]', trace: 'Story 4 AC1, FR9, FR10', screens: ['change-04-updated', 'pass-05-directions', 'pass-06-add-to-calendar'], branches: [] },
    ],
  },
  {
    id: 'j3', code: 'J3', title: 'At the door: scan in, train, scan out', who: 'Member and front desk', source: 'Added: owner feedback, not in the build pack',
    summary: 'One scan confirms on both devices within about 2 seconds, then a 1-hour countdown runs, with a 15-minute grace period before and after. A later scan checks the person out.',
    steps: [
      { name: 'Show the pass', tag: 'added', task: 'Member opens the QR code at the desk', route: 'Full screen on the pass', trace: 'Member', screens: ['door-01-show-at-desk'], branches: [] },
      { name: 'Desk scans', tag: 'added', task: 'Front desk scans, or types the code', route: '/staff', trace: 'Front desk', screens: ['door-02-scanner'], branches: [{ when: 'Unknown code', then: 'Not found', screen: 'door-15-scan-not-found' }, { when: 'More than 15 minutes early', then: 'Says too early. The door opens 15 minutes before the start' }, { when: 'Old or used pass', then: 'Refused, and says which day', screen: 'door-14-scan-already-used' }] },
      { name: 'Both devices confirm', tag: 'added', task: 'Desk says Checked in, and the phone says it by itself', route: '/staff and the pass', trace: 'Both devices', screens: ['door-03-desk-says-checked-in', 'door-04-phone-says-checked-in'], branches: [{ when: 'Scanned twice within 60 seconds', then: 'Says Already in, and the visit carries on' }] },
      { name: 'Time left runs', tag: 'added', task: 'Counts down the booked hour, on the pass and on Home', route: '/bookings/[id], /home', trace: 'Member', screens: ['door-05-time-left', 'door-06-time-left-on-home'], branches: [{ when: 'The hour ends', then: 'A labelled 15-minute grace period counts down', screen: 'door-16-grace-period' }, { when: 'Grace runs out', then: 'Timer goes negative and red', screen: 'door-07-over-time' }, { when: 'Gym refuses entry', then: 'Claim a full refund', screen: 'door-09-cant-get-in' }] },
      { name: 'Scan out', tag: 'added', task: 'A later scan, a slide on the pass, or Out on the panel', route: '/staff and the pass', trace: 'Both devices', screens: ['door-08-desk-says-checked-out', 'door-10-phone-says-checked-out'], branches: [{ when: 'Never scanned out', then: 'After 6 hours the timer stops, and the exit shows as not recorded', screen: 'passes-02-past-visit' }] },
      { name: 'Visit done', tag: 'added', task: 'Entry, exit and time inside are kept, then rate the gym', route: '/bookings/[id]', trace: 'Leads to Rate the gym in J1', screens: ['door-11-visit-done', 'door-12-rate-the-gym'], branches: [] },
    ],
  },
  {
    id: 'j4', code: 'J4', title: 'Run the front desk', who: 'Admin: anyone with the password', source: 'Added: owner feedback, not in the build pack',
    summary: 'Real bookings and real scans only, so it shows zero until someone is scanned. Works across all gyms.',
    steps: [
      { name: 'Enter the password', tag: 'added', task: 'No account needed', route: '/owner', trace: 'Admin', screens: ['desk-01-password'], branches: [] },
      { name: 'See the day', tag: 'added', task: 'All zero until someone is scanned', route: '/owner', trace: 'Real data only', screens: ['desk-02-panel-zero'], branches: [{ when: 'Choose one gym', then: 'Filters the panel to that gym', screen: 'desk-04-one-gym' }] },
      { name: 'Scan people in and out', tag: 'added', task: 'Links to the door journey, J3', route: '/staff', trace: 'See J3', screens: ['door-02-scanner', 'door-03-desk-says-checked-in'], branches: [] },
      { name: 'Watch who is in', tag: 'added', task: 'Time left for each person, updating every 4 seconds', route: '/owner', trace: 'Live', screens: ['desk-03-panel-someone-in', 'desk-05-panel-over-time'], branches: [] },
      { name: 'Read the log', tag: 'added', task: 'Who came in and left today, and for how long', route: '/owner', trace: 'Live', screens: ['desk-06-todays-log'], branches: [] },
    ],
  },
  {
    id: 'j5', code: 'J5', title: 'List a gym', who: 'Gym owner', source: 'Build pack: "Gyms list themselves and set their own day pass price", NFR8',
    summary: 'A gym lists itself for free, sets its price, pays 15% per booking and confirms its details every 90 days.',
    steps: [
      { name: 'Find the offer', tag: 'pack', task: 'Tap Own a gym on Home', route: '/home', trace: 'Assumptions, section 1', screens: ['home-05-own-a-gym'], branches: [] },
      { name: 'Read the deal', tag: 'pack', task: 'Your own price, 15% only when booked', route: '/partners', trace: 'Assumptions, section 1', screens: ['gymowner-01-sell-quiet-hours'], branches: [] },
      { name: 'List the gym', tag: 'pack', task: 'Log in and fill in the details', route: '/partners', trace: 'NFR8: confirm details every 90 days', screens: ['gymowner-02-list-a-gym'], branches: [] },
    ],
  },
  {
    id: 'j6', code: 'J6', title: 'Track my training', who: 'Member', source: 'Added: owner feedback, not in the build pack',
    summary: 'A calendar of real visits, with rings, history and notes.',
    steps: [
      { name: 'Open my profile', tag: 'added', task: 'Visits, cities and spend', route: '/account', trace: 'Reuses FR7 data', screens: ['account-01-profile'], branches: [] },
      { name: 'Read rings and calendar', tag: 'added', task: 'Swipe between months', route: '/account', trace: '', screens: ['account-02-rings-and-calendar'], branches: [] },
      { name: 'Open a day', tag: 'added', task: 'Times, time inside and a note that saves', route: 'Sheet', trace: '', screens: ['account-03-day-and-note'], branches: [] },
      { name: 'Open a ring', tag: 'added', task: 'History for that goal, and each row opens its day', route: 'Sheet', trace: '', screens: ['account-04-ring-history'], branches: [] },
    ],
  },
  {
    id: 'j7', code: 'J7', title: 'Manage my account', who: 'Member', source: 'Build pack stories below the MVP line, NFR5, NFR6',
    summary: 'Preferences, saved payment, Face ID, reminders, saved gyms, privacy and deletion.',
    steps: [
      { name: 'Open settings', tag: 'pack', task: 'Every setting in one list', route: '/account', trace: '', screens: ['settings-06-menu'], branches: [] },
      { name: 'Search preferences', tag: 'later', task: 'Save my preferences', route: 'Sheet', trace: 'J1, below the MVP line', screens: ['settings-01-search-preferences'], branches: [] },
      { name: 'Saved payment', tag: 'later', task: 'Save my card for next time', route: 'Sheet', trace: 'J1, below the MVP line', screens: ['settings-02-saved-payment'], branches: [] },
      { name: 'Face ID', tag: 'later', task: 'Log in with Face ID', route: 'Sheet', trace: 'J2, below the MVP line', screens: ['settings-03-face-id'], branches: [] },
      { name: 'Reminders', tag: 'later', task: 'Get a reminder the day before', route: 'Sheet, /inbox', trace: 'J2, below the MVP line', screens: ['settings-04-reminders', 'other-01-inbox'], branches: [] },
      { name: 'Saved gyms', tag: 'added', task: 'Gyms I tapped the heart on', route: '/saved', trace: '', screens: ['other-02-saved'], branches: [] },
      { name: 'Privacy and deletion', tag: 'pack', task: 'Read the notice and erase my account', route: '/privacy, sheet', trace: 'NFR6: GDPR', screens: ['other-03-privacy', 'settings-05-delete-account'], branches: [] },
    ],
  },
];

// Every card in the build pack's two story maps, and where it is in the app.
const STORY_MAP = [
  ['J1', 'MVP', 'Ask for location permission', 'find-02-location-ask', 'Built'],
  ['J1', 'MVP', 'Show nearby gyms from my current location', 'find-03-list-and-map', 'Built'],
  ['J1', 'MVP', 'Show gym pins on the map and in a list', 'find-06-full-map', 'Built'],
  ['J1', 'MVP', 'See photos, details, location and a Book button', 'gym-01-photos', 'Built'],
  ['J1', 'MVP', 'View and select free dates and slots', 'gym-02-pick-a-time', 'Built'],
  ['J1', 'MVP', 'Confirm my selection', 'gym-03-time-chosen', 'Built'],
  ['J1', 'MVP', 'Log in with my existing account', 'login-01-log-in', 'Built'],
  ['J1', 'MVP', 'Register a new account', 'login-02-create-account', 'Built'],
  ['J1', 'MVP', 'Choose payment type and pay', 'book-02-pay', 'Simulated: no outside provider'],
  ['J1', 'MVP', 'View booked and previous appointments', 'passes-01-list', 'Built'],
  ['J1', 'MVP', 'Cancel an appointment', 'change-05-cancel', 'Built'],
  ['J1', 'MVP', 'Open directions in my maps app', 'pass-05-directions', 'Built'],
  ['J1', 'Later', 'Type a city instead', 'find-01-search-city', 'Built'],
  ['J1', 'Later', 'Recommend top gyms by rating, location and price', 'find-04-gym-cards', 'Built'],
  ['J1', 'Later', 'Filter gyms by map zoom level', 'find-06-full-map', 'Built: search this area'],
  ['J1', 'Later', 'Sort gyms by price and rating', 'find-05-filters', 'Built'],
  ['J1', 'Later', 'Read reviews', 'gym-07-reviews', 'Built, with sample reviews'],
  ['J1', 'Later', 'Save my preferences', 'settings-01-search-preferences', 'Built'],
  ['J1', 'Later', 'Save my card for next time', 'settings-02-saved-payment', 'Built, simulated'],
  ['J1', 'Later', 'Get a prompt to rate the gym', 'door-12-rate-the-gym', 'Built'],
  ['J1', 'Later', 'Add a text review', 'door-12-rate-the-gym', 'Built'],
  ['J2', 'MVP', 'Stay logged in when I return', 'door-06-time-left-on-home', 'Built'],
  ['J2', 'MVP', 'See my upcoming bookings', 'passes-01-list', 'Built'],
  ['J2', 'MVP', 'Open the booking I want to change', 'pass-03-actions', 'Built'],
  ['J2', 'MVP', 'See free slots at the same gym', 'change-01-new-time', 'Built'],
  ['J2', 'MVP', 'Select a new slot', 'change-01-new-time', 'Built'],
  ['J2', 'MVP', 'See old vs new slot and confirm', 'change-03-old-and-new', 'Built'],
  ['J2', 'MVP', 'Get blocked if less than 24 h before', 'change-06-too-late', 'Built'],
  ['J2', 'MVP', 'Get an updated confirmation', 'change-04-updated', 'Built'],
  ['J2', 'MVP', 'Open directions to the gym', 'pass-05-directions', 'Built'],
  ['J2', 'Later', 'Log in with Face ID', 'settings-03-face-id', 'Built, not proven on a real device'],
  ['J2', 'Later', 'Get a reminder the day before', 'other-01-inbox', 'In-app only: no email or push'],
  ['J2', 'Later', 'Move the booking to another gym', 'change-02-another-gym', 'Built'],
  ['J2', 'Later', 'Pay a price difference or get a refund', 'change-02-another-gym', 'Built, simulated'],
  ['J2', 'Later', 'Add the new time to my calendar', 'pass-06-add-to-calendar', 'Built'],
];

// Status wording follows "Limits to state honestly" in the process log.
const REQUIREMENTS = [
  ['FR1', 'Show gyms near the user on a list and a map, at least 20 per page', 'find-03-list-and-map', 'Met'],
  ['FR2', 'Show photos, opening hours, equipment, price and location', 'gym-01-photos', 'Met'],
  ['FR3', 'Sort and filter gyms by rating and price', 'find-05-filters', 'Met'],
  ['FR4', 'Show free dates and slots, and book without contacting the gym', 'gym-02-pick-a-time', 'Met'],
  ['FR5', 'Sign up and log in so bookings are saved', 'login-01-log-in', 'Met'],
  ['FR6', 'Take payment through an external provider', 'book-02-pay', 'Partly: the flow works, but payment is simulated at the owner\'s request'],
  ['FR7', 'Show upcoming and past bookings', 'passes-01-list', 'Met'],
  ['FR8', 'Reschedule or cancel until 24 hours before', 'change-03-old-and-new', 'Met'],
  ['FR9', 'Open directions in the user\'s maps app', 'pass-05-directions', 'Met'],
  ['FR10', 'Add a session to the personal calendar', 'pass-06-add-to-calendar', 'Met'],
  ['NFR1', 'Map and list load within 2 s on a mid-range phone on 4G', 'find-03-list-and-map', 'Partly: list and pins about 1.4 s in simulation, full street map about 6 to 7 s'],
  ['NFR2', 'No sideways scrolling from 360 px to desktop', 'desktop-02-find', 'Partly: tested in Chrome, only partly in the Safari engine, not in Firefox'],
  ['NFR3', '4 of 5 first-time users book within 3 minutes unaided', 'gym-02-pick-a-time', 'Not measured: needs five real test users'],
  ['NFR4', 'WCAG 2.2 AA, text resizable to 200%', 'home-01-hero', 'Not audited: designed for it. Removing the Home pause button goes against 2.2.2'],
  ['NFR5', 'HTTPS, hashed passwords, session ends after 30 days unused', 'login-01-log-in', 'Met'],
  ['NFR6', 'GDPR, EU hosting, location not stored, deletion within 30 days', 'settings-05-delete-account', 'Met, with one thing to note: the front desk shows first name and last initial to anyone with the password'],
  ['NFR7', 'Booking only after payment succeeds, no double charges', 'book-03-payment-declined', 'Met, tested'],
  ['NFR8', 'Pin within 50 m of the entrance, details confirmed every 90 days', 'gym-06-location', 'Partly: gyms are sample data, so the 50 m cannot be shown'],
  ['NFR9', 'Results within 2 s with 500 gyms and 1,000 users', 'find-04-gym-cards', 'Not measured under load'],
  ['NFR10', 'At least 99.5% uptime', 'home-01-hero', 'Not measurable yet: needs time'],
];

const GROUPS = [
  ['home', 'Home'], ['find', 'Find'], ['gym', 'Gym page'], ['login', 'Log in'], ['book', 'Book and pay'], ['passes', 'Passes'], ['pass', 'A pass'],
  ['change', 'Change or cancel'], ['door', 'At the door'], ['desk', 'Front desk panel'], ['gymowner', 'Gym owners'], ['account', 'Profile and calendar'],
  ['settings', 'Settings'], ['other', 'Other screens'], ['desktop', 'Desktop'],
];

const TAGS = { pack: ['In the build pack', 'is-pack'], later: ['Build pack, below the MVP line', 'is-later'], added: ['Added from owner feedback', 'is-added'] };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const nice = (name) => name.replace(/^[a-z]+-\d+-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

const used = new Set();
const need = (name) => {
  used.add(name);
  if (!shots.has(name)) throw new Error(`No screenshot called ${name}`);
  return name;
};
const thumb = (name, cls = '') => `<button type="button" class="thumb ${cls}" data-full="screens/${need(name)}.jpg" data-name="${esc(nice(name))}"><img src="screens/${name}.jpg" alt="${esc(nice(name))} screen" loading="lazy"><span>${esc(nice(name))}</span></button>`;

function lane(j) {
  return `<section class="journey" id="${j.id}">
  <header class="journey-head">
    <p class="journey-code">${j.code}</p>
    <div><h2>${esc(j.title)}</h2><p>${esc(j.summary)}</p><p class="journey-meta"><b>Who:</b> ${esc(j.who)} &nbsp; <b>From:</b> ${esc(j.source)}</p></div>
  </header>
  <div class="lane" tabindex="0" role="group" aria-label="${esc(j.title)}, steps from left to right">
    ${j.steps.map((s, i) => `<article class="step">
      <header class="step-head">
        <p class="step-no">${i + 1}</p>
        <h3>${esc(s.name)}</h3>
        <span class="tag ${TAGS[s.tag][1]}">${TAGS[s.tag][0]}</span>
        <p class="step-task">${esc(s.task)}</p>
        <p class="step-route"><code>${esc(s.route)}</code></p>
        ${s.trace ? `<p class="step-trace">${esc(s.trace)}</p>` : ''}
      </header>
      <div class="step-shots">${s.screens.map((n) => thumb(n)).join('')}</div>
      ${s.branches.length ? `<div class="branches">${s.branches.map((b) => `<div class="branch"><p class="branch-when">If: ${esc(b.when)}</p><p>${esc(b.then)}</p>${b.screen ? thumb(b.screen, 'is-small') : ''}</div>`).join('')}</div>` : ''}
    </article>`).join('')}
  </div>
</section>`;
}

// The whole app on one picture.
function overview() {
  const W = 1500;
  const box = (x, y, w, label, href, kind = '', h = 54) => `<a href="#${href}"><rect class="node ${kind}" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>${label.split('|').map((l, i, all) => `<text class="node-text" x="${x + w / 2}" y="${y + h / 2 + 5 + (i - (all.length - 1) / 2) * 17}">${esc(l)}</text>`).join('')}</a>`;
  const line = (d, kind = '') => `<path class="edge ${kind}" d="${d}" marker-end="url(#${kind.includes('is-live') ? 'head-live' : 'head'})"/>`;
  const member = ['Home', 'Find|list and map', 'Gym page', 'Pick a time', 'Log in|only now', 'Pay', 'Your pass'];
  const mx = (i) => 170 + i * 142;
  const rows = { member: 70, door: 210, desk: 370, side: 530 };
  return `<svg class="overview" viewBox="0 0 ${W} 640" role="img" aria-label="Map of the whole app. A member goes from Home through Find, a gym page, picking a time, logging in and paying to a pass. They show it at the door, where a scan confirms on both devices, a one hour countdown runs, and a later scan checks them out. Anyone with the admin password runs the front desk.">
  <defs>
    <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#8d9089"/></marker>
    <marker id="head-live" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#d7ff3e"/></marker>
  </defs>
  <text class="row-label" x="20" y="${rows.member + 32}">Member</text>
  <text class="row-label" x="20" y="${rows.door + 32}">At the door</text>
  <text class="row-label" x="20" y="${rows.desk + 32}">Front desk</text>
  <text class="row-label" x="20" y="${rows.side + 32}">Also</text>
  ${member.map((m, i) => box(mx(i), rows.member, 120, m, 'j1', i === 4 ? 'is-soft' : '')).join('')}
  ${member.slice(1).map((_, i) => line(`M${mx(i) + 120} ${rows.member + 27}H${mx(i + 1) - 2}`)).join('')}
  ${box(mx(7), rows.member, 150, 'Directions, calendar|Wallet', 'j1')}
  ${line(`M${mx(6) + 120} ${rows.member + 27}H${mx(7) - 2}`)}
  ${box(mx(8) + 30, rows.member, 150, 'Change or cancel|24-hour rule', 'j2', 'is-pack2')}
  ${line(`M${mx(7) + 150} ${rows.member + 27}H${mx(8) + 28}`)}
  ${line(`M${mx(6) + 60} ${rows.member + 54}V${rows.door - 2}`)}
  ${box(mx(6), rows.door, 120, 'Show at|the desk', 'j3', 'is-added')}
  ${box(mx(4) - 60, rows.door, 200, 'CHECKED IN|on both devices', 'j3', 'is-live')}
  ${line(`M${mx(6)} ${rows.door + 27}H${mx(4) + 142}`)}
  ${box(mx(2) - 40, rows.door, 170, 'Time left|1:00:00 counting down', 'j3', 'is-added')}
  ${line(`M${mx(4) - 60} ${rows.door + 27}H${mx(2) + 132}`)}
  ${box(mx(0) + 20, rows.door, 150, 'CHECKED OUT|time inside saved', 'j3', 'is-live')}
  ${line(`M${mx(2) - 40} ${rows.door + 27}H${mx(0) + 172}`)}
  <a href="#j1"><rect class="node" x="${mx(8) + 30}" y="${rows.door}" width="150" height="54" rx="14"/><text class="node-text" x="${mx(8) + 105}" y="${rows.door + 32}">Rate the gym</text></a>
  ${line(`M${mx(0) + 95} ${rows.door + 54}V${rows.door + 92}H${mx(8) + 105}V${rows.door + 56}`)}
  ${box(mx(0), rows.desk, 150, 'Admin password|anyone', 'j4', 'is-added')}
  ${box(mx(1) + 40, rows.desk, 170, 'Panel: all gyms|zero until a scan', 'j4', 'is-added')}
  ${line(`M${mx(0) + 150} ${rows.desk + 27}H${mx(1) + 38}`)}
  ${box(mx(4) - 40, rows.desk, 160, 'Door scanner|camera or typed code', 'j3', 'is-added')}
  ${line(`M${mx(1) + 210} ${rows.desk + 27}H${mx(4) - 42}`)}
  ${line(`M${mx(4) + 40} ${rows.desk}V${rows.door + 56}`, 'is-live')}
  ${box(mx(6) - 10, rows.desk, 200, 'Who is in, time left|today\'s log, updates live', 'j4', 'is-added')}
  ${line(`M${mx(4) + 120} ${rows.desk + 27}H${mx(6) - 12}`, 'is-live')}
  ${box(mx(0), rows.side, 180, 'Calendar, rings, notes', 'j6', 'is-added')}
  ${box(mx(1) + 70, rows.side, 170, 'Settings, saved gyms', 'j7')}
  ${box(mx(3) + 30, rows.side, 160, 'Inbox, reminders', 'j7')}
  ${box(mx(4) + 70, rows.side, 200, 'List a gym, 15% per booking', 'j5')}
  </svg>`;
}

const counts = { total: shots.size };
const body = `
${JOURNEYS.map(lane).join('\n')}

<section class="doc" id="story-map">
  <h2>Build pack story map coverage</h2>
  <p>Every card from the PDF's two story maps (section 4), and the screen where it lives. The originals are in <a href="pdf/journey-1-story-map.png">journey-1-story-map.png</a> and <a href="pdf/journey-2-story-map.png">journey-2-story-map.png</a>.</p>
  <div class="table-wrap"><table><thead><tr><th>Map</th><th>Line</th><th>Story card</th><th>Screen</th><th>Status</th></tr></thead><tbody>
  ${STORY_MAP.map(([m, l, card, s, status]) => `<tr><td>${m}</td><td>${l}</td><td>${esc(card)}</td><td><button type="button" class="link-thumb" data-full="screens/${need(s)}.jpg" data-name="${esc(nice(s))}">${esc(nice(s))}</button></td><td>${esc(status)}</td></tr>`).join('')}
  </tbody></table></div>
</section>

<section class="doc" id="requirements">
  <h2>Requirements from the build pack</h2>
  <p>Sections 2 and 3 of the PDF. The status comes from "Limits to state honestly" in <code>process-log.md</code>, so anything not met is stated, not hidden.</p>
  <div class="table-wrap"><table><thead><tr><th>ID</th><th>What it asks</th><th>Where to see it</th><th>Status</th></tr></thead><tbody>
  ${REQUIREMENTS.map(([id, what, s, status]) => `<tr><td><b>${id}</b></td><td>${esc(what)}</td><td><button type="button" class="link-thumb" data-full="screens/${need(s)}.jpg" data-name="${esc(nice(s))}">${esc(nice(s))}</button></td><td class="${status.startsWith('Met') ? 'is-met' : 'is-open'}">${esc(status)}</td></tr>`).join('')}
  </tbody></table></div>
</section>

<section class="doc" id="screens">
  <h2>All ${counts.total} screens</h2>
  <p>Taken from the real app at iPhone 16 Pro Max width, with a throwaway demo account. Tap any screen to enlarge it.</p>
  ${GROUPS.map(([prefix, label]) => {
    const list = [...shots].filter((n) => n.startsWith(`${prefix}-`)).sort();
    return `<h3 class="group-title">${label} <small>${list.length}</small></h3><div class="grid ${prefix === 'desktop' ? 'is-wide' : ''}">${list.map((n) => thumb(n)).join('')}</div>`;
  }).join('')}
</section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daypass user flow map</title>
<style>
:root { --bg:#000; --s1:#121314; --s2:#1b1c1e; --line:#34373b; --text:#fff; --text2:#cfd0cb; --mute:#a0a29c; --volt:#d7ff3e; --blue:#9fd8ff; --pink:#ffc4e6; }
*,*::before,*::after { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; background:var(--bg); color:var(--text); font:500 15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
h1,h2,.group-title { font-family:Impact,'Arial Narrow Bold','Haettenschweiler',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.01em; }
h1 { font-size:clamp(2.6rem,7vw,4.6rem); line-height:1.02; margin:0; } h1 em { color:var(--volt); font-style:normal; }
h2 { font-size:clamp(1.7rem,3.4vw,2.4rem); line-height:1.08; margin:0; }
a { color:var(--volt); } code { font:600 .8rem ui-monospace,Consolas,monospace; color:var(--text2); overflow-wrap:anywhere; }
.top { padding:32px clamp(16px,3vw,40px) 12px; max-width:1500px; }
.top > p { max-width:760px; color:var(--text2); margin:12px 0 0; }
nav { position:sticky; top:0; z-index:5; display:flex; gap:6px; overflow-x:auto; padding:10px clamp(16px,3vw,40px); background:rgba(0,0,0,.92); border-bottom:1px solid var(--line); scrollbar-width:none; }
nav a { flex:none; padding:7px 13px; border-radius:99px; background:var(--s2); color:#fff; text-decoration:none; font-size:.86rem; font-weight:700; white-space:nowrap; }
nav a:hover,nav a:focus-visible { background:var(--volt); color:#000; }
.legend { display:flex; flex-wrap:wrap; gap:8px 14px; margin:16px 0 0; padding:0; list-style:none; color:var(--text2); font-size:.86rem; }
.tag { display:inline-block; padding:1px 9px; border-radius:99px; font-size:.72rem; font-weight:800; line-height:1.6; color:#000; }
.is-pack { background:var(--volt); } .is-later { background:var(--blue); } .is-added { background:var(--pink); }
.overview-wrap { padding:8px clamp(16px,3vw,40px) 24px; overflow-x:auto; }
.overview { display:block; width:100%; min-width:1100px; max-width:1500px; background:var(--s1); border-radius:24px; }
.node { fill:var(--s2); stroke:var(--line); stroke-width:1.5; } a:hover .node, a:focus .node { stroke:var(--volt); }
.node.is-added { fill:#2a1f28; stroke:#a9799a; } .node.is-soft { stroke-dasharray:5 4; } .node.is-pack2 { fill:#1c2a2e; stroke:#6f9bb0; }
.node.is-live { fill:var(--volt); stroke:var(--volt); }
.node-text { fill:#fff; font:700 13.5px system-ui,sans-serif; text-anchor:middle; pointer-events:none; }
.node.is-live ~ .node-text { fill:#000; }
.edge { fill:none; stroke:#8d9089; stroke-width:1.8; } .edge.is-live { stroke:var(--volt); stroke-width:2.5; }
.row-label { fill:var(--mute); font:800 13px system-ui,sans-serif; text-transform:uppercase; letter-spacing:.06em; }
.journey,.doc { padding:30px clamp(16px,3vw,40px); border-top:1px solid var(--line); scroll-margin-top:50px; }
.journey-head { display:flex; gap:14px; align-items:flex-start; max-width:900px; }
.journey-head p { margin:4px 0 0; color:var(--text2); } .journey-meta { font-size:.84rem; color:var(--mute) !important; } .journey-meta b { color:var(--text2); }
.journey-code { flex:none; margin:0 !important; width:58px; height:58px; display:grid; place-items:center; border-radius:50%; background:var(--volt); color:#000 !important; font:400 1.5rem Impact,sans-serif; }
.lane { display:flex; gap:26px; overflow-x:auto; padding:18px 2px 14px; align-items:stretch; scrollbar-color:#555 transparent; }
.lane:focus-visible { outline:2px solid var(--volt); outline-offset:2px; }
.step { position:relative; flex:none; width:max-content; min-width:232px; max-width:760px; display:flex; flex-direction:column; gap:10px; padding:14px; border-radius:22px; background:var(--s1); }
.step:not(:last-child)::after { content:'\\2192'; position:absolute; right:-23px; top:26px; color:var(--volt); font:800 20px system-ui,sans-serif; }
.step-head { width:0; min-width:100%; }
.step-no { margin:0; color:var(--volt); font:400 1.3rem Impact,sans-serif; } .step h3 { margin:0 0 5px; font-size:1.02rem; line-height:1.25; }
.step-task { margin:7px 0 2px; color:var(--text2); font-size:.86rem; line-height:1.35; } .step-route { margin:0; } .step-trace { margin:3px 0 0; color:var(--mute); font-size:.78rem; }
.step-shots { display:flex; gap:8px; }
.thumb { display:block; width:204px; flex:none; padding:0; border:0; background:none; color:var(--text2); font:600 .76rem/1.25 system-ui,sans-serif; text-align:left; cursor:zoom-in; }
.thumb img { display:block; width:100%; height:auto; aspect-ratio:440/956; object-fit:cover; object-position:top; border-radius:16px; background:var(--s2); box-shadow:inset 0 0 0 1px var(--line); margin-bottom:5px; }
.thumb:hover img,.thumb:focus-visible img { outline:2px solid var(--volt); outline-offset:1px; }
.branches { display:flex; gap:8px; width:0; min-width:100%; flex-wrap:wrap; }
.branch { flex:1 1 200px; display:flex; flex-direction:column; gap:3px; padding:9px; border-radius:15px; border:1.5px dashed #6d7068; font-size:.82rem; line-height:1.3; color:var(--text2); }
.branch p { margin:0; } .branch-when { color:var(--volt); font-weight:800; }
.thumb.is-small { width:104px; margin-top:6px; font-size:0; } .thumb.is-small img { border-radius:10px; margin:0; }
.doc > p { max-width:780px; color:var(--text2); }
.table-wrap { overflow-x:auto; border-radius:18px; background:var(--s1); }
table { width:100%; min-width:760px; border-collapse:collapse; font-size:.88rem; }
th,td { padding:9px 13px; text-align:left; vertical-align:top; border-bottom:1px solid #26282a; } th { color:var(--mute); font-size:.76rem; text-transform:uppercase; letter-spacing:.05em; }
.is-met { color:var(--volt); } .is-open { color:#ffc9a8; }
.link-thumb { padding:0; border:0; background:none; color:#fff; font:inherit; text-decoration:underline; text-underline-offset:2px; cursor:zoom-in; text-align:left; }
.group-title { font-size:1.5rem; margin:26px 0 10px; } .group-title small { color:var(--mute); font:600 .9rem system-ui,sans-serif; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px 10px; } .grid .thumb { width:auto; }
.grid.is-wide { grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); } .grid.is-wide .thumb img { aspect-ratio:1280/860; }
dialog { padding:0; border:0; background:transparent; max-width:96vw; max-height:96vh; color:#fff; } dialog::backdrop { background:rgba(0,0,0,.9); }
dialog img { display:block; max-width:96vw; max-height:88vh; border-radius:18px; } dialog p { margin:8px 0 0; text-align:center; font-weight:700; }
dialog button { position:fixed; top:14px; right:14px; width:44px; height:44px; border:0; border-radius:50%; background:var(--volt); color:#000; font:800 20px system-ui,sans-serif; cursor:pointer; }
footer { padding:24px clamp(16px,3vw,40px) 48px; border-top:1px solid var(--line); color:var(--mute); font-size:.84rem; max-width:900px; }
@media print { nav,dialog { display:none; } }
</style></head><body>
<header class="top">
  <h1>Daypass <em>user flow map</em></h1>
  <p>Every journey and every screen in the app, tied back to the Gym App Product Build Pack. Read each journey left to right, like the story maps in the PDF. Dashed boxes are the "what if" paths. Tap a screen to enlarge it.</p>
  <ul class="legend">
    <li><span class="tag is-pack">In the build pack</span></li>
    <li><span class="tag is-later">Build pack, below the MVP line</span></li>
    <li><span class="tag is-added">Added from owner feedback</span></li>
  </ul>
</header>
<nav aria-label="Jump to">
  <a href="#overview">Whole app</a>
  ${JOURNEYS.map((j) => `<a href="#${j.id}">${j.code} ${esc(j.title)}</a>`).join('')}
  <a href="#story-map">Story map coverage</a><a href="#requirements">Requirements</a><a href="#screens">All screens</a>
</nav>
<div class="overview-wrap" id="overview">${overview()}</div>
${body}
<footer>Student project. Gyms are sample listings and payments are simulated, while bookings, scans and times are real records. Rebuild this page with <code>node userflow/build-map.mjs</code>.</footer>
<dialog id="big"><button type="button" aria-label="Close" id="big-close">&times;</button><img id="big-img" alt=""><p id="big-name"></p></dialog>
<script>
const big = document.getElementById('big');
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-full]');
  if (t) {
    document.getElementById('big-img').src = t.dataset.full;
    document.getElementById('big-img').alt = t.dataset.name + ' screen';
    document.getElementById('big-name').textContent = t.dataset.name;
    big.showModal();
  } else if (e.target === big || e.target.id === 'big-close') big.close();
});
</script>
</body></html>`;
writeFileSync(join(HERE, 'index.html'), html);

// The same content as plain text, for reading or pasting into a report.
const md = `# Daypass user journeys

Every journey in the app, tied back to the Gym App Product Build Pack. The visual version is \`index.html\`.

Source key: **Pack** is in the build pack's story maps. **Later** is below its MVP line. **Added** came from the owner's feedback.

${JOURNEYS.map((j) => `## ${j.code}: ${j.title}

${j.summary}

- **Who:** ${j.who}
- **From:** ${j.source}

| # | Step | What happens | Where | Source | Links to | Screens |
|---|------|--------------|-------|--------|----------|---------|
${j.steps.map((s, i) => `| ${i + 1} | ${s.name} | ${s.task} | \`${s.route}\` | ${s.tag === 'pack' ? 'Pack' : s.tag === 'later' ? 'Later' : 'Added'} | ${s.trace} | ${s.screens.map((n) => `[${nice(n)}](screens/${n}.jpg)`).join(', ')} |`).join('\n')}
${j.steps.some((s) => s.branches.length) ? `
**What if:**

${j.steps.flatMap((s) => s.branches.map((b) => `- **${b.when}** (step ${j.steps.indexOf(s) + 1}): ${b.then}.${b.screen ? ` [Screen](screens/${b.screen}.jpg)` : ''}`)).join('\n')}
` : ''}`).join('\n')}
## Build pack story map coverage

| Map | Line | Story card | Screen | Status |
|-----|------|------------|--------|--------|
${STORY_MAP.map(([m, l, c, s, st]) => `| ${m} | ${l} | ${c} | [${nice(s)}](screens/${s}.jpg) | ${st} |`).join('\n')}

## Requirements from the build pack

The status comes from "Limits to state honestly" in \`process-log.md\`.

| ID | What it asks | Where to see it | Status |
|----|--------------|-----------------|--------|
${REQUIREMENTS.map(([id, w, s, st]) => `| ${id} | ${w} | [${nice(s)}](screens/${s}.jpg) | ${st} |`).join('\n')}

## Screens

${GROUPS.map(([p, label]) => `### ${label}\n\n${[...shots].filter((n) => n.startsWith(`${p}-`)).sort().map((n) => `- [${nice(n)}](screens/${n}.jpg)`).join('\n')}`).join('\n\n')}
`;
writeFileSync(join(HERE, 'journeys.md'), md);

const orphans = [...shots].filter((n) => !GROUPS.some(([p]) => n.startsWith(`${p}-`)));
console.log(`index.html and journeys.md written. ${shots.size} screens, ${used.size} used in journeys and tables, ${orphans.length} not in any group.`);
if (orphans.length) console.log(orphans.join(', '));
