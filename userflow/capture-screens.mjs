// Walks the real app and saves a picture of every screen into userflow/screens. It uses a throwaway demo account and removes it at the end.
// Start the app first (npm run build, then npx next start -p 3000), then from the project folder:
//   node --env-file=.env.local userflow/capture-screens.mjs
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = join(import.meta.dirname, 'screens');
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
const sql = neon(process.env.DATABASE_URL);
mkdirSync(OUT, { recursive: true });

const PHONE = { width: 440, height: 956, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const made = [];
const missed = [];

async function person({ city = 'Berlin', view = PHONE } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(view);
  page.setDefaultTimeout(30000);
  if (city) await page.setExtraHTTPHeaders({ 'x-vercel-ip-city': city });
  return page;
}
const go = (page, path) => page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
const ready = (page, sel) => page.waitForFunction((s) => { const e = document.querySelector(s); return !!e && Object.keys(e).some((k) => k.startsWith('__reactProps$')); }, { timeout: 20000 }, sel).catch(() => {});
const snap = async (page, name, full = false) => {
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });
  made.push(name);
};
const to = async (page, sel, block = 'start', settle = 450) => {
  await page.$eval(sel, (e, b) => e.scrollIntoView({ block: b, behavior: 'instant' }), block);
  await sleep(settle);
};
const clickText = (page, sel, text) => page.evaluate((s, t) => {
  const el = [...document.querySelectorAll(s)].find((e) => e.textContent.includes(t) && e.checkVisibility());
  if (!el) throw new Error(`nothing says ${t}`);
  el.click();
}, sel, text);
const closeSheet = async (page) => {
  await page.evaluate(() => [...document.querySelectorAll('.sheet .round-sm')].pop()?.click());
  await page.waitForFunction(() => !document.querySelector('.sheet'));
};
// One missed picture must not lose the rest. Anything missed is listed at the end.
const step = async (name, run) => {
  try {
    await run();
  } catch (e) {
    missed.push(`${name}: ${e.message.slice(0, 90)}`);
    console.log('MISSED', name, e.message.slice(0, 90));
  }
};

const guest = await person();

// Browsing, with no account.
await step('home', async () => {
  await go(guest, '/home');
  await guest.waitForSelector('.feature-card');
  await sleep(2500);
  await snap(guest, 'home-01-hero');
  await to(guest, '.featured');
  await snap(guest, 'home-02-gyms');
  await to(guest, '.moves-section');
  await snap(guest, 'home-03-categories');
  await to(guest, '#cities', 'center', 700);
  await snap(guest, 'home-04-cities');
  await to(guest, '.home-partner', 'center');
  await snap(guest, 'home-05-own-a-gym');
});
await step('search', async () => {
  await guest.evaluate(() => window.scrollTo(0, 0));
  await ready(guest, '.search-pill.is-large');
  await guest.evaluate(() => document.querySelector('.search-pill.is-large').click());
  await guest.waitForSelector('.sheet-search[data-state="open"]');
  await sleep(500);
  await guest.type('.sheet-search input', 'Ber');
  await sleep(1200);
  await snap(guest, 'find-01-search-city');
});
await step('ask', async () => {
  const stranger = await person({ city: null });
  await go(stranger, '/gyms');
  await stranger.waitForSelector('.ask');
  await sleep(800);
  await snap(stranger, 'find-02-location-ask');
  await stranger.browserContext().close();
});
await step('find', async () => {
  await go(guest, '/gyms?city=Berlin');
  await guest.waitForSelector('a.gym-card');
  await ready(guest, '.filter-sort .chip');
  await sleep(1500);
  await to(guest, '.gym-grid', 'start');
  await snap(guest, 'find-04-gym-cards');
  await guest.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await guest.evaluate(() => document.querySelector('.round-solid[aria-label^="Filters"]').click());
  await guest.waitForSelector('.sheet-filters[data-state="open"]');
  await sleep(500);
  await snap(guest, 'find-05-filters');
  await closeSheet(guest);
  });
await step('no results', async () => {
  await go(guest, '/gyms?city=Berlin&maxPrice=100');
  await guest.waitForSelector('.empty');
  await sleep(800);
  await snap(guest, 'find-08-no-results');
});
await step('gym', async () => {
  await go(guest, '/gyms/iron-gym-berlin');
  await guest.waitForSelector('.time-pill');
  await ready(guest, '.time-pill');
  await sleep(1500);
  await snap(guest, 'gym-01-photos');
  await to(guest, '.book', 'center');
  await snap(guest, 'gym-02-pick-a-time');
  await guest.evaluate(() => document.querySelector('.time-pill:not(:disabled)').click());
  await sleep(500);
  await snap(guest, 'gym-03-time-chosen');
  await to(guest, '[aria-labelledby="facts"]', 'center');
  await snap(guest, 'gym-04-what-is-included');
  await to(guest, '[aria-labelledby="hours"]', 'start');
  await snap(guest, 'gym-05-hours-and-equipment');
  await to(guest, '[aria-labelledby="reviews"]', 'start');
  await snap(guest, 'gym-07-reviews');
});
await step('no photos', async () => {
  const [gym] = await sql`SELECT slug FROM gyms WHERE cardinality(photos) = 0 LIMIT 1`;
  if (!gym) throw new Error('no gym without photos');
  await go(guest, `/gyms/${gym.slug}`);
  await guest.waitForSelector('.gym-sheet');
  await sleep(1200);
  await snap(guest, 'gym-08-no-photos');
});
await step('login screens', async () => {
  const other = await person();
  await go(other, '/login');
  await other.waitForSelector('.welcome');
  await sleep(1000);
  await snap(other, 'login-01-log-in');
  await go(other, '/login?mode=register');
  await other.waitForSelector('.welcome');
  await sleep(1000);
  await snap(other, 'login-02-create-account');
  await other.browserContext().close();
});

// Booking, which is the moment a login appears.
const member = guest;
let passId = null;
await step('book', async () => {
  await go(member, '/gyms/iron-gym-berlin');
  await member.waitForSelector('.time-pill');
  await ready(member, '.time-pill');
  await to(member, '.book', 'center');
  await member.evaluate(() => [...document.querySelectorAll('.day-pill:not(:disabled)')][3]?.click());
  await sleep(500);
  await member.evaluate(() => document.querySelector('.time-pill:not(:disabled)').click());
  await sleep(400);
  await ready(member, '.swipe-thumb');
  await member.focus('.swipe-thumb');
  await member.keyboard.press('Enter');
  await member.waitForSelector('.auth-skip');
  await sleep(600);
  await snap(member, 'book-01-login-when-booking');
  await member.evaluate(() => document.querySelector('.auth-skip').click());
  await member.waitForSelector('.sheet-wallet[data-state="open"]');
  await sleep(700);
  await snap(member, 'book-02-pay');
  await member.evaluate(() => document.querySelector('.wallet-card.is-alert').click());
  await sleep(500);
  await member.evaluate(() => document.querySelector('.wallet-pay').click());
  await member.waitForSelector('.wallet-error');
  await sleep(400);
  await snap(member, 'book-03-payment-declined');
  await member.evaluate(() => document.querySelector('.wallet-card.is-ink').click());
  await sleep(500);
  await member.evaluate(() => document.querySelector('.wallet-pay').click());
  await member.waitForSelector('.wallet-pay.is-done');
  await snap(member, 'book-04-paid');
  await member.waitForFunction(() => location.pathname.startsWith('/bookings/'));
  passId = await member.evaluate(() => location.pathname.split('/').pop());
  await member.waitForSelector('.holo');
  await sleep(3500);
  await snap(member, 'book-05-pass-ready');
});

await step('passes', async () => {
  await go(member, '/bookings');
  await member.waitForSelector('.ticket');
  await sleep(1200);
  await snap(member, 'passes-01-list');
});
const openPass = async () => {
  await go(member, `/bookings/${passId}`);
  await member.waitForSelector('.pass-actions');
  await ready(member, '.action');
  await sleep(700);
};
await step('pass', async () => {
  await openPass();
  await snap(member, 'pass-01-front');
  await member.evaluate(() => document.querySelector('.holo-flip').click());
  await sleep(900);
  await snap(member, 'pass-02-what-is-included');
  await member.evaluate(() => document.querySelector('.holo-flip').click());
  await sleep(700);
  await to(member, '.pass-actions', 'start');
  await snap(member, 'pass-03-actions');
  await to(member, '.pass-title', 'start');
  await snap(member, 'pass-04-details');
});
await step('pass sheets', async () => {
  for (const [label, name] of [['Directions', 'pass-05-directions'], ['Calendar', 'pass-06-add-to-calendar'], ['Add to Wallet', 'pass-07-add-to-wallet']]) {
    await clickText(member, '.action', label);
    await member.waitForSelector('.sheet[data-state="open"]');
    await sleep(500);
    await snap(member, name);
    if (label !== 'Add to Wallet') await closeSheet(member);
  }
  await member.evaluate(() => document.querySelector('.wprev + p + button, .sheet .btn-volt').click());
  await member.waitForFunction(() => document.querySelector('.sheet .wprev-phone.is-added'));
  await sleep(600);
  await closeSheet(member);
  await go(member, '/wallet');
  await sleep(1500);
  await snap(member, 'pass-08-wallet');
});
await step('change', async () => {
  await openPass();
  await clickText(member, '.rows button', 'Change date or gym');
  await member.waitForSelector('.sheet-change .time-pill:not(:disabled)');
  await sleep(600);
  await snap(member, 'change-01-new-time');
  await clickText(member, '.sheet-change button', 'Move to another gym');
  await member.waitForSelector('.gym-pick button');
  await sleep(500);
  await snap(member, 'change-02-another-gym');
  await clickText(member, '.sheet-change button', 'Back to times');
  await member.waitForSelector('.sheet-change .time-pill:not(:disabled)');
  await sleep(400);
  await member.evaluate(() => document.querySelector('.sheet-change .time-pill:not(:disabled)').click());
  await sleep(300);
  await clickText(member, '.sheet-change button', 'Review change');
  await member.waitForSelector('.compare');
  await sleep(500);
  await snap(member, 'change-03-old-and-new');
  await clickText(member, '.sheet-change button', 'Confirm change');
  await member.waitForFunction(() => /Booking updated/.test(document.querySelector('.banner-volt')?.innerText ?? ''));
  await member.waitForFunction(() => !document.querySelector('.sheet'));
  await to(member, '.banner-volt', 'center');
  await snap(member, 'change-04-updated');
});
await step('cancel and help', async () => {
  // The change above may have landed inside 24 hours, so this puts the pass back to days away.
  await sql`UPDATE bookings SET starts_at = now() + interval '3 days' WHERE id = ${passId}::uuid`;
  await openPass();
  await clickText(member, '.rows button', 'Cancel booking');
  await member.waitForSelector('.sheet[data-state="open"]');
  await sleep(500);
  await snap(member, 'change-05-cancel');
  await closeSheet(member);
  await clickText(member, '.rows button', "I can't get in");
  await member.waitForSelector('.reasons');
  await sleep(500);
  await snap(member, 'door-09-cant-get-in');
  await closeSheet(member);
});
await step('too late', async () => {
  // Inside 24 hours, so the rule from the build pack shows.
  await sql`UPDATE bookings SET starts_at = now() + interval '2 hours' WHERE id = ${passId}::uuid`;
  await openPass();
  await clickText(member, '.rows button', 'Change date or gym');
  await member.waitForSelector('.pass-actions .form-error');
  await to(member, '.pass-actions .form-error', 'center');
  await snap(member, 'change-06-too-late');
});

// The door: two devices, a real scan.
const code = (await sql`SELECT code FROM bookings WHERE id = ${passId}::uuid`)[0]?.code;
const desk = await person();
const scan = async (value, name) => {
  await go(desk, '/staff');
  await desk.waitForSelector('#staff-code');
  await ready(desk, '#staff-code');
  await desk.type('#staff-code', value);
  await desk.keyboard.press('Enter');
  await desk.waitForSelector('.staff-result');
  await sleep(500);
  await snap(desk, name);
};
await step('gate', async () => {
  await go(desk, '/owner');
  await desk.waitForSelector('#owner-password');
  await ready(desk, '.owner-gate button');
  await sleep(600);
  await snap(desk, 'desk-01-password');
  await desk.type('#owner-password', 'uxdd');
  await desk.keyboard.press('Enter');
  await desk.waitForSelector('.owner-stats');
  await go(desk, '/owner?gym=iron-gym-rome');
  await desk.waitForFunction(() => document.querySelector('#owner-gym')?.value === 'iron-gym-rome');
  await sleep(900);
  await snap(desk, 'desk-02-panel-zero', true);
});
await step('show at desk', async () => {
  await openPass();
  await member.evaluate(() => document.querySelector('.pass-show').click());
  await member.waitForSelector('.desk-qr');
  await sleep(700);
  await snap(member, 'door-01-show-at-desk');
});
await step('scanner', async () => {
  await go(desk, '/staff');
  await desk.waitForSelector('.staff-camera');
  await sleep(700);
  await snap(desk, 'door-02-scanner');
});
await step('scan in', async () => {
  await scan(code, 'door-03-desk-says-checked-in');
  await member.waitForSelector('.desk-done');
  await sleep(400);
  await snap(member, 'door-04-phone-says-checked-in');
  await member.waitForFunction(() => !document.querySelector('.desk-done'), { timeout: 9000 });
  await to(member, '.visit-clock', 'center');
  await snap(member, 'door-05-time-left');
});
await step('home timer', async () => {
  await go(member, '/home');
  await member.waitForSelector('.vhero-next.is-live');
  await sleep(1500);
  await snap(member, 'door-06-time-left-on-home');
});
await step('panel live', async () => {
  await go(desk, '/owner');
  await desk.waitForSelector('.owner-stats');
  await sleep(1500);
  await snap(desk, 'desk-03-panel-someone-in', true);
  await go(desk, '/owner?gym=iron-gym-berlin');
  await desk.waitForFunction(() => document.querySelector('#owner-gym')?.value === 'iron-gym-berlin');
  await sleep(1000);
  await snap(desk, 'desk-04-one-gym');
});
await step('over time', async () => {
  await sql`UPDATE bookings SET checked_in_at = now() - interval '65 minutes' WHERE id = ${passId}::uuid`;
  await openPass();
  await to(member, '.visit-clock', 'center');
  await snap(member, 'door-16-grace-period');
  await sql`UPDATE bookings SET checked_in_at = now() - interval '85 minutes' WHERE id = ${passId}::uuid`;
  await openPass();
  await to(member, '.visit-clock', 'center');
  await snap(member, 'door-07-over-time');
  await go(desk, '/owner');
  await desk.waitForSelector('[aria-labelledby="owner-in"] .owner-row');
  await to(desk, '[aria-labelledby="owner-in"]', 'center', 900);
  await snap(desk, 'desk-05-panel-over-time');
});
await step('scan again', async () => {
  await scan(code, 'door-08-desk-says-checked-out');
  await member.waitForSelector('.desk-done');
  await sleep(400);
  await snap(member, 'door-10-phone-says-checked-out');
  await member.waitForFunction(() => !document.querySelector('.desk-done'), { timeout: 9000 });
  await sleep(800);
  await to(member, '.visit-clock', 'center');
  await snap(member, 'door-11-visit-done');
  await to(member, '.rate-form', 'center');
  await snap(member, 'door-12-rate-the-gym');
  await member.evaluate(() => document.querySelectorAll('.rate-stars button')[3].click());
  await sleep(200);
  await member.evaluate(() => document.querySelector('.rate-form button[type="submit"]').click());
  await member.waitForSelector('.rate-done');
  await sleep(500);
  await snap(member, 'door-13-rated');
  await scan(code, 'door-14-scan-already-used');
  await scan('DP-NOPE1', 'door-15-scan-not-found');
  await go(desk, '/owner');
  await desk.waitForSelector('.owner-event');
  await to(desk, '[aria-labelledby="owner-log"]', 'start', 900);
  await snap(desk, 'desk-06-todays-log');
});

// Training history and settings.
await step('account', async () => {
  await go(member, '/account');
  await member.waitForSelector('.dots');
  await ready(member, '.dot');
  await sleep(1000);
  await snap(member, 'account-01-profile');
  await to(member, '.rings', 'start');
  await snap(member, 'account-02-rings-and-calendar');
  await member.evaluate(() => [...document.querySelectorAll('.dot.on')].pop().click());
  await member.waitForSelector('.log-day');
  await sleep(500);
  await member.type('#day-note', 'Good session. Add weight on squats next time.');
  await sleep(200);
  await snap(member, 'account-03-day-and-note');
  await member.evaluate(() => [...document.querySelectorAll('.log-day .btn-volt')].pop().click());
  await member.waitForFunction(() => !document.querySelector('.sheet'));
  await member.evaluate(() => document.querySelectorAll('.rings-list button')[1].click());
  await member.waitForSelector('.log-ring');
  await sleep(500);
  await snap(member, 'account-04-ring-history');
  await closeSheet(member);
  for (const [text, name] of [['Search preferences', 'settings-01-search-preferences'], ['Saved payment', 'settings-02-saved-payment'], ['Face ID', 'settings-03-face-id'], ['Reminders', 'settings-04-reminders'], ['Delete account', 'settings-05-delete-account']]) {
    await clickText(member, '.rows button', text);
    await member.waitForSelector('.sheet[data-state="open"]');
    await sleep(500);
    await snap(member, name);
    await closeSheet(member);
  }
  await to(member, '#s-gym', 'start');
  await snap(member, 'settings-06-menu');
});
await step('other pages', async () => {
  for (const [path, wait, name] of [['/inbox', '.inbox', 'other-01-inbox'], ['/saved', 'main', 'other-02-saved'], ['/privacy', '.prose', 'other-03-privacy'], ['/credits', 'main', 'other-04-credits'], ['/no-such-page', 'main', 'other-05-not-found']]) {
    await go(member, path);
    await member.waitForSelector(wait);
    await sleep(900);
    await snap(member, name);
  }
  await go(member, '/offline.html');
  await sleep(500);
  await snap(member, 'other-06-offline');
});
await step('past visit', async () => {
  const [old] = await sql`SELECT b.id FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.is_sample AND b.user_id = (SELECT user_id FROM bookings WHERE id = ${passId}::uuid) ORDER BY b.starts_at DESC LIMIT 1`;
  await go(member, `/bookings/${old.id}`);
  await member.waitForSelector('.holo');
  await sleep(1000);
  await snap(member, 'passes-02-past-visit');
});
await step('partners', async () => {
  await go(member, '/partners');
  await member.waitForSelector('.owner-try');
  await sleep(1000);
  await snap(member, 'gymowner-01-sell-quiet-hours');
  await to(member, '.owner-try', 'center');
  await snap(member, 'gymowner-02-list-a-gym');
});
await step('desktop', async () => {
  const wide = await person({ view: { width: 1280, height: 860 } });
  for (const [path, wait, name] of [['/home', '.feature-card', 'desktop-01-home'], ['/gyms?city=Berlin', 'a.gym-card', 'desktop-02-find'], ['/gyms/iron-gym-berlin', '.time-pill', 'desktop-03-gym']]) {
    await go(wide, path);
    await wide.waitForSelector(wait);
    await sleep(2500);
    await snap(wide, name);
  }
  await wide.browserContext().close();
});

// The street map needs graphics, which a test browser only has in a slow software mode, so only these screens use it.
await step('maps', async () => {
  const slow = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 240000, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await slow.newPage();
  await page.setViewport(PHONE);
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-city': 'Berlin' });
  await go(page, '/gyms?city=Berlin');
  await page.waitForSelector('a.gym-card');
  await ready(page, '.map-expand');
  await page.waitForSelector('.maplibregl-canvas');
  await sleep(14000);
  await snap(page, 'find-03-list-and-map');
  await page.evaluate(() => document.querySelector('.map-expand').click());
  await sleep(9000);
  await snap(page, 'find-06-full-map');
  await page.evaluate(() => [...document.querySelectorAll('.pin')].find((p) => { const r = p.getBoundingClientRect(); return r.top > 120 && r.top < 600 && r.left > 20 && r.right < 420; })?.click());
  await page.waitForSelector('.pin-preview');
  await sleep(2500);
  await snap(page, 'find-07-map-pin');
  await go(page, '/gyms/iron-gym-berlin');
  await page.waitForSelector('[aria-labelledby="where"]');
  await to(page, '[aria-labelledby="where"]', 'center', 14000);
  await snap(page, 'gym-06-location');
  await slow.close();
});

// Leaves nothing behind.
await member.evaluate(() => fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }) })).catch(() => {});
await sql`UPDATE slots s SET booked = (SELECT count(*) FROM bookings b WHERE b.gym_id = s.gym_id AND b.starts_at = s.starts_at AND b.status IN ('hold', 'confirmed'))`;
await browser.close();
console.log(`saved ${made.length} screens, missed ${missed.length}`);
for (const m of missed) console.log('  ', m);
