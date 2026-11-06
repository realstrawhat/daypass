// Journeys through the real screens in Chrome, for what the API tests can't see: taps, sheets, history,
// press states and offline. Run against a production build, because the offline worker only runs there:
//   npm run build && npx next start -p 3000      then, in another window:   npm run test:ui
// BASE_URL points these at another address, such as the live site. IPHONE=1 runs every journey as an iPhone, with
// the see-through tap covers in place. Run one suite at a time: at once they overload the computer and time out.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const LOCAL = BASE.includes('localhost');
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const sql = process.env.DATABASE_URL ? (await import('@neondatabase/serverless')).neon(process.env.DATABASE_URL) : null;
const needsChrome = { skip: CHROME ? false : 'needs Chrome (set CHROME_PATH)' };
const needsDb = { skip: CHROME && sql ? false : 'needs Chrome and DATABASE_URL' };
const TIMEOUT = 25000;
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1';

let browser;
const everyone = new Set();
before(async () => {
  if (CHROME) browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => {
  await browser?.close();
  // A failed test never reaches its own clean-up, so the end of the run removes everyone it saw.
  if (sql && everyone.size) await sql`DELETE FROM users WHERE email = ANY(${[...everyone]}) AND (is_demo OR email LIKE 'qa+%')`;
  // Moving a booking's time in a test leaves its old slot count behind, so the counts are redone.
  if (sql) await sql`UPDATE slots s SET booked = (SELECT count(*) FROM bookings b WHERE b.gym_id = s.gym_id AND b.starts_at = s.starts_at AND b.status IN ('hold', 'confirmed'))`;
});

// A fresh visitor with their own cookies. `replace` answers chosen addresses with a fixed response.
async function visitor({ width = 390, height = 844, mobile = true, replace = {}, intercept = LOCAL, iphone = !!process.env.IPHONE } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  if (iphone) await page.setUserAgent(IPHONE_UA);
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Everyone this visitor was logged in as, including accounts it has logged out of by the end.
  const accounts = new Set();
  page.on('response', (r) => {
    if (!r.url().endsWith('/api/auth/me')) return;
    r.json().then((d) => {
      if (d.user?.email) {
        accounts.add(d.user.email);
        everyone.add(d.user.email);
      }
    }).catch(() => {});
  });
  if (intercept || Object.keys(replace).length) {
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const path = r.url().startsWith(BASE) ? new URL(r.url()).pathname : null;
      if (path && replace[path]) return r.respond(replace[path]);
      // Vercel sets this header on the live site. Locally the test stands in for it.
      return r.continue(path && LOCAL ? { headers: { ...r.headers(), 'x-vercel-ip-city': 'Berlin' } } : undefined);
    });
  }
  return {
    page,
    errors,
    done: async () => {
      if (sql) {
        const me = await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user?.email ?? null).catch(() => null);
        if (me) accounts.add(me);
        if (accounts.size) await sql`DELETE FROM users WHERE email = ANY(${[...accounts]}) AND (is_demo OR email LIKE 'qa+%')`;
      }
      await context.close();
      assert.deepEqual(errors, [], 'the page threw no script errors');
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// On a real network a section can still be a hidden copy waiting to be swapped in, so only one on show counts.
const text = async (page, selector) => {
  const shown = await page.waitForFunction((s) => [...document.querySelectorAll(s)].find((e) => e.checkVisibility()) ?? null, {}, selector);
  return shown.evaluate((e) => e.innerText.replace(/\s+/g, ' ').trim());
};
const exists = (page, selector) => page.$(selector).then(Boolean);
const open = (page, path) => page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
const address = (page) => page.evaluate(() => location.pathname + location.search);

// A screen drawn on the server shows before its buttons work, so a tap waits until React has taken over the element.
// A person takes longer than that to aim. The wait gives up after 15 seconds and taps anyway.
const ready = (page, selector) => page.waitForFunction((s) => {
  const e = document.querySelector(s);
  return !!e && Object.keys(e).some((k) => k.startsWith('__reactProps$'));
}, { timeout: 15000 }, selector).catch(() => {});

// Taps a gym card that is on screen, at the point a finger would, leaving the scroll position alone.
async function tapCardOnScreen(page) {
  await ready(page, 'a.gym-card');
  const at = await page.evaluate(() => {
    const card = [...document.querySelectorAll('a.gym-card')].find((c) => {
      const r = c.getBoundingClientRect();
      const middle = (r.top + r.bottom) / 2;
      return middle > 90 && middle < innerHeight - 170;
    });
    const r = card.getBoundingClientRect();
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
  });
  await page.mouse.click(at.x, at.y);
}

// Only the top edge of a card behind the front one is showing in the stack, so that is where a finger lands.
async function tapStackedCard(page, selector) {
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 8);
}

async function tap(page, selector) {
  await page.waitForSelector(selector, { visible: true });
  await ready(page, selector);
  await page.$eval(selector, (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.click(selector);
}

// The newest open sheet first, because buttons with the same words can sit on the page behind it.
async function tapText(page, words) {
  const handle = await page.waitForFunction((w) => {
    const sheets = [...document.querySelectorAll('.sheet[data-state="open"]')];
    const scope = sheets[sheets.length - 1] ?? document;
    return [...scope.querySelectorAll('button, a')].find((b) => b.innerText.trim().startsWith(w) && !b.disabled && b.offsetParent !== null) ?? null;
  }, {}, words);
  await handle.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await handle.asElement().evaluateHandle((e) => e).then((el) => page.waitForFunction((x) => Object.keys(x).some((k) => k.startsWith('__reactProps$')), { timeout: 15000 }, el)).catch(() => {});
  // A sheet may still be sliding into place.
  await sleep(420);
  await handle.asElement().click();
}

async function demoSession(page) {
  await open(page, '/privacy');
  const res = await page.evaluate(async () => (await fetch('/api/auth/demo', { method: 'POST' })).status);
  assert.equal(res, 200);
  return page.evaluate(async () => (await fetch('/api/auth/me')).json());
}

// A real account, which doesn't get the demo's freedom with time windows.
async function realSession(page) {
  await open(page, '/privacy');
  const status = await page.evaluate(async (email) => (await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'QA Tester', email, password: 'testing-123' }) })).status, `qa+ui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  assert.equal(status, 200);
}

async function bookFromPage(page) {
  return page.evaluate(async () => {
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    const { gyms } = await (await fetch('/api/gyms?city=Berlin')).json();
    const { days } = await (await fetch(`/api/gyms/${gyms[0].id}/slots`)).json();
    const slot = days.flatMap((d) => d.slots).filter((s) => new Date(s.startsAt).getTime() > Date.now() + 30 * 3600000)[5];
    const hold = await post('/api/checkout', { gymId: gyms[0].id, startsAt: slot.startsAt, key: crypto.randomUUID() });
    await post(`/api/checkout/${hold.booking.id}/pay`, { method: 'demo-card' });
    return hold.booking.id;
  });
}

const moveBooking = (id, hours) => sql`UPDATE bookings SET starts_at = now() + make_interval(mins => ${Math.round(hours * 60)}::int) WHERE id = ${id}::uuid`;

async function pickTime(page) {
  await page.waitForSelector('.time-pill');
  await page.evaluate(() => [...document.querySelectorAll('.day-pill:not(:disabled)')][4].click());
  await sleep(350);
  await page.evaluate(() => document.querySelector('.time-pill:not(:disabled)').click());
  await page.waitForSelector('.swipe-thumb');
}

// Slides the thumb across the way a finger does.
async function swipeToBook(page) {
  await page.$eval('.swipe', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(250);
  const track = await (await page.$('.swipe')).boundingBox();
  const y = track.y + track.height / 2;
  await page.mouse.move(track.x + 30, y);
  await page.mouse.down();
  for (let x = 60; x <= track.width - 10; x += 40) await page.mouse.move(track.x + x, y);
  await page.mouse.up();
}

test('a new visitor sees gyms in their general area, with exact location offered after', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/home');
  await page.waitForSelector('.feature-card');
  const area = await page.evaluate(async () => (await (await fetch('/api/where')).json()).city);
  assert.ok(area, 'the network gave a city');
  assert.equal(await text(page, '.featured-where'), `Top picks in ${area}`);
  assert.match(await text(page, '.where-note'), new RegExp(`${area} is your general area\\. Use my exact location`));
  await tap(page, '.tabbar a[href="/gyms"]');
  await page.waitForSelector('a.gym-card');
  assert.equal(await exists(page, '.ask'), false, 'Find does not stop to ask first');
  assert.ok(page.url().includes(`city=${encodeURIComponent(area)}`), 'Find opens the same area');
  await tap(page, '.tabbar a[href="/home"]');
  await page.waitForFunction(() => location.pathname === '/home' && !!document.querySelector('.featured-where'));
  assert.equal(await exists(page, '.feature-card'), true, 'coming back shows the picks straight away');
  assert.equal(await exists(page, '.sk'), false, 'with no loading placeholders');
  await done();
});

test('with no idea where someone is, the app says so and never guesses a city', needsChrome, async () => {
  const { page, done } = await visitor({ replace: { '/api/where': { status: 200, contentType: 'application/json', body: '{"city":null}' } } });
  await open(page, '/home');
  await page.waitForSelector('.feature-card');
  assert.equal(await text(page, '.featured-where'), 'Top rated across Europe');
  assert.match(await text(page, '.where-note'), /don.t know where you are yet/);
  const shown = await page.$$eval('.feature-card .card-meta', (m) => m.map((e) => e.innerText));
  const cities = ['Berlin', 'Paris', 'Lisbon', 'Rome'].filter((c) => shown.some((s) => s.includes(c)));
  assert.ok(cities.length >= 3, `the first cards come from several cities, found ${cities}`);
  await open(page, '/gyms');
  await page.waitForSelector('.ask');
  assert.equal(page.url(), `${BASE}/gyms`);
  await done();
});

test('filters apply, show as chips and clear again', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms?city=Berlin');
  await page.waitForSelector('a.gym-card');
  const before = await text(page, '.search-title');
  await tap(page, '[aria-label^="Filters"]');
  await tapText(page, '4.5+');
  await page.waitForFunction(() => /^Show \d+ gym/.test(document.querySelector('.filter-actions .btn-volt')?.innerText ?? ''));
  await sleep(700);
  const promised = await text(page, '.filter-actions .btn-volt');
  await page.click('.filter-actions .btn-volt');
  await page.waitForSelector('.applied');
  await page.waitForFunction((b) => {
    const now = document.querySelector('.search-title')?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    return /\d/.test(now) && now !== b;
  }, {}, before);
  assert.ok((await address(page)).includes('minRating=4.5'));
  assert.match(promised, new RegExp((await text(page, '.search-title')).match(/\d+/)[0]), 'the button promised the number shown');
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  await page.click('.applied button');
  await page.waitForFunction((b) => document.querySelector('.search-title')?.innerText.replace(/\s+/g, ' ').trim() === b, {}, before);
  assert.equal(await exists(page, '.applied'), false);
  await done();
});

test('search and back: results, filters and place in the list all come back', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms?city=Berlin&minRating=4.5&sort=price_asc');
  await page.waitForSelector('a.gym-card');
  await page.waitForSelector('.applied');
  // While the page streams in, it can still be too short to scroll, so this waits for the app to have started.
  await ready(page, '.filter-sort .chip');
  await page.evaluate(() => window.scrollTo(0, 500));
  await sleep(350);
  const place = await page.evaluate(() => Math.round(window.scrollY));
  const count = await page.$$eval('a.gym-card', (c) => c.length);
  await tapCardOnScreen(page);
  await page.waitForSelector('.gym-bar a');
  await sleep(400);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.applied');
  await sleep(500);
  const back = await address(page);
  assert.ok(back.includes('minRating=4.5') && back.includes('sort=price_asc'), 'Back keeps the search');
  assert.equal(await page.$$eval('a.gym-card', (c) => c.length), count, 'same results');
  assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - place) < 80, 'Back keeps the place in the list');

  await tapCardOnScreen(page);
  await page.waitForSelector('.gym-bar a');
  await sleep(400);
  await page.click('.gym-bar a');
  await page.waitForSelector('.applied');
  await sleep(500);
  assert.ok((await address(page)).includes('minRating=4.5'), 'the on-screen arrow keeps the search too');
  assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - place) < 80, 'the arrow keeps the place in the list');
  await done();
});

test('slot chosen: the swipe button and the sticky bar agree, and picking a date leaves the page still', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms/iron-gym-berlin');
  await page.waitForSelector('.time-pill');
  const y = await page.evaluate(() => window.scrollY);
  await pickTime(page);
  assert.equal(await page.evaluate(() => window.scrollY), y, 'the page did not jump');
  const sticky = await text(page, '.book-bar strong');
  const main = await page.$eval('.swipe-thumb', (e) => e.getAttribute('aria-label'));
  assert.ok(main.includes(sticky), `"${main}" should include "${sticky}"`);
  await done();
});

test('booking as a guest: swipe, log in with the demo link, stay on the gym, decline, retry, pass', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms/iron-gym-berlin');
  await pickTime(page);
  await swipeToBook(page);
  await page.waitForSelector('.auth-skip');
  assert.equal(await text(page, '.sheet[data-state="open"] h2'), 'LOG IN TO BOOK');
  await page.click('.auth-skip');
  await page.waitForSelector('.sheet-wallet[data-state="open"]');
  assert.equal(await address(page), '/gyms/iron-gym-berlin', 'the person is still where they were');
  await sleep(350);
  await tapStackedCard(page, '.wallet-card.is-alert');
  await sleep(250);
  assert.equal(await page.$eval('.wallet-card.is-alert', (c) => c.getAttribute('aria-pressed') ?? c.getAttribute('aria-checked') ?? 'true'), 'true');
  await page.click('.wallet-pay');
  await page.waitForSelector('.wallet-error');
  assert.match(await text(page, '.wallet-error'), /not charged/);
  await tapStackedCard(page, '.wallet-card.is-ink');
  await sleep(250);
  await page.click('.wallet-pay');
  await page.waitForFunction(() => location.pathname.startsWith('/bookings/'));
  await page.waitForSelector('.reveal');
  await page.waitForSelector('.push');
  assert.equal(new URL(page.url()).search, '', 'the address is tidied after the reveal');
  assert.equal(await text(page, '.pass-title'), 'YOU ARE BOOKED');
  await done();
});

test('the keyboard can book too, and reduced motion keeps the video still', needsChrome, async () => {
  const { page, done } = await visitor();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await open(page, '/home');
  await page.waitForSelector('.feature-card');
  await sleep(500);
  assert.equal(await page.$eval('.vhero-video', (v) => v.paused), true);
  await open(page, '/gyms/iron-gym-berlin');
  await pickTime(page);
  await page.focus('.swipe-thumb');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.auth-skip');
  await done();
});

test('add to wallet: the pass stays there, says so, and leaves once it is used', needsChrome, async () => {
  const { page, done } = await visitor();
  const { next } = await demoSession(page);
  await open(page, `/bookings/${next.id}`);
  await page.waitForSelector('.pass-show');
  await tapText(page, 'Add to Wallet');
  await page.waitForSelector('.sheet[data-state="open"] .wprev');
  await sleep(450);
  await tapText(page, 'Add to Wallet');
  await page.waitForSelector('.wprev-phone.is-added');
  await tapText(page, 'View in Wallet');
  await page.waitForFunction(() => location.pathname === '/wallet');
  await page.waitForSelector('.wallet-screen a[href^="/bookings/"]');
  await sleep(500);
  assert.equal(new URL(page.url()).pathname, '/wallet', 'closing the sheet did not undo the move to Wallet');
  await open(page, `/bookings/${next.id}`);
  await page.waitForSelector('.pass-show');
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.action')].some((a) => a.innerText.includes('In Wallet'))), 'already-added state');
  await page.click('.pass-show');
  await page.waitForSelector('.desk-sim');
  await sleep(450);
  await page.click('.desk-sim');
  await page.waitForSelector('.desk-done');
  await page.waitForFunction(() => document.querySelector('.pass-title')?.innerText.toLowerCase() === 'checked in');
  await open(page, '/wallet');
  await page.waitForFunction(() => /empty/i.test(document.querySelector('.wallet-screen')?.innerText ?? ''));
  await done();
});

test('refused entry from the pass: full refund, the pass is void and the inbox says so', needsChrome, async () => {
  const { page, done } = await visitor();
  const { next } = await demoSession(page);
  await open(page, `/bookings/${next.id}`);
  await page.waitForSelector('.pass-show');
  await tapText(page, "I can't get in");
  await page.waitForSelector('.reasons');
  await sleep(450);
  await page.click('.reasons button');
  await tapText(page, 'Refund');
  await page.waitForFunction(() => document.querySelector('.pass-title')?.innerText.toLowerCase() === 'cancelled');
  assert.equal(await text(page, '.holo-code span'), 'No longer valid');
  await open(page, '/inbox');
  await page.waitForFunction(() => /Refund sent/.test(document.querySelector('main')?.innerText ?? ''));
  await done();
});

test('demo Face ID: scan, a clear demo label, then a session, with plain messages on failure', needsChrome, async () => {
  const good = await visitor();
  await open(good.page, '/login?next=/home');
  await tapText(good.page, 'Log in with Face ID');
  await good.page.waitForFunction(() => /Demo Face ID/.test(document.querySelector('.auth-scan')?.innerText ?? ''));
  await good.page.waitForFunction(() => /Signed in to a demo account/.test(document.querySelector('.auth-scan')?.innerText ?? ''));
  await good.page.waitForFunction(() => location.pathname === '/home' && /^Hi /.test(document.querySelector('.home-brand')?.innerText.trim() ?? ''));
  await good.done();

  const down = { status: 500, contentType: 'application/json', body: '{"error":"Down"}' };
  const bad = await visitor({ replace: { '/api/auth/demo': down } });
  await open(bad.page, '/login?next=/home');
  await tapText(bad.page, 'Log in with Face ID');
  await bad.page.waitForFunction(() => /Use your password instead/.test(document.querySelector('.form-error')?.innerText ?? ''));
  await tapText(bad.page, 'Skip this, use a demo account');
  await bad.page.waitForFunction(() => /Down/.test(document.querySelector('.form-error')?.innerText ?? ''));
  await bad.done();
});

test('offline at the door: a pass opened by tapping still opens, and logging out removes it', needsChrome, async () => {
  const { page, done } = await visitor({ intercept: false });
  await demoSession(page);
  await open(page, '/bookings');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await tap(page, '.ticket.is-next');
  await page.waitForSelector('.pass-show');
  const pass = new URL(page.url()).pathname;
  const savedPages = () => page.evaluate(async () => {
    const name = (await caches.keys()).find((k) => k.endsWith('-pages'));
    return (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
  });
  for (let i = 0; i < 40 && !(await savedPages()).includes(pass); i++) await sleep(150);
  assert.ok((await savedPages()).includes(pass), 'the pass opened by a tap is saved on the device');

  const worker = await page.browserContext().waitForTarget((t) => t.type() === 'service_worker');
  const client = await worker.createCDPSession();
  const cut = { latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', { offline: true, ...cut });
  await page.setOfflineMode(true);
  await page.goto(BASE + pass, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.holo-qr svg');
  assert.ok((await text(page, '.holo-code strong')).startsWith('DP-'), 'the code is readable offline');
  await page.waitForFunction(() => /offline/i.test(document.querySelector('.offline-pill')?.innerText ?? ''));
  await page.goto(`${BASE}/inbox`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /not saved on your phone/.test(document.body.innerText));
  assert.ok(await exists(page, 'a[href="/bookings"]'), 'the offline page leads to the passes');
  await page.goto(`${BASE}/bookings/00000000-0000-4000-8000-000000000000`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ticket');

  await client.send('Network.emulateNetworkConditions', { offline: false, ...cut, downloadThroughput: -1, uploadThroughput: -1 });
  await page.setOfflineMode(false);

  // After check-in the saved copy is replaced, so the pass reads as used with no signal too.
  await open(page, pass);
  await page.waitForSelector('.pass-show');
  await page.click('.pass-show');
  await page.waitForSelector('.desk-sim');
  await sleep(450);
  await page.click('.desk-sim');
  await page.waitForSelector('.desk-done');
  const copySaysUsed = () => page.evaluate(async (p) => (await (await caches.match(p))?.text() ?? '').includes('Already used'), pass);
  for (let i = 0; i < 60 && !(await copySaysUsed()); i++) await sleep(150);
  await client.send('Network.emulateNetworkConditions', { offline: true, ...cut });
  await page.setOfflineMode(true);
  await page.goto(BASE + pass, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.holo-code span');
  assert.equal(await text(page, '.holo-code span'), 'Already used');
  await client.send('Network.emulateNetworkConditions', { offline: false, ...cut, downloadThroughput: -1, uploadThroughput: -1 });
  await page.setOfflineMode(false);

  await open(page, '/account');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^Log out/.test(b.innerText.trim())));
  await tapText(page, 'Log out');
  await page.waitForFunction(() => location.pathname === '/home');
  await sleep(600);
  const left = await savedPages();
  assert.ok(!left.includes(pass) && !left.includes('/bookings') && !left.includes('/account'), `personal pages are gone, found ${left}`);
  await done();
});

test('a new gym with no ratings shows New everywhere', needsDb, async () => {
  const slug = `qa-test-gym-${Date.now()}`;
  await sql`INSERT INTO gyms (slug, name, city, country, timezone, address, lat, lng, price_cents, is_demo) VALUES (${slug}, 'QA Test Gym', 'Berlin', 'Germany', 'Europe/Berlin', '1 Test Street, Berlin', 52.52, 13.405, 1000, false)`;
  const { page, done } = await visitor();
  try {
    await demoSession(page);
    await open(page, `/gyms/${slug}`);
    await page.waitForSelector('.gym-stats');
    assert.match(await text(page, '.gym-stats'), /Rating New/);
    assert.equal(await text(page, '.gym-title .rate'), 'New');
    assert.equal(await exists(page, '.rating-bars'), false, 'no rating bars with no ratings');
    await tap(page, '.gym-bar .save');
    await page.waitForSelector('.toast-action');
    await page.click('.toast-action');
    await page.waitForFunction(() => location.pathname === '/saved');
    await page.waitForFunction(() => /New/.test(document.querySelector('a.gym-card .rate')?.innerText ?? ''));
  } finally {
    await sql`DELETE FROM gyms WHERE slug = ${slug}`;
  }
  await done();
});

test('the heart asks a guest to log in, saves with a burst, and has its own page to come back to', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms/iron-gym-berlin');
  await tap(page, '.gym-bar .save');
  await page.waitForSelector('.auth-skip');
  assert.equal(await text(page, '.sheet[data-state="open"] h2'), 'LOG IN TO SAVE GYMS');
  await page.click('.auth-skip');
  await page.waitForSelector('.gym-bar .save.is-on');
  await page.waitForSelector('.toast-action');
  assert.match(await text(page, '.toast'), /Iron Gym saved/);
  await sleep(450);
  await page.click('.toast-action');
  await page.waitForFunction(() => location.pathname === '/saved');
  await page.waitForSelector('a.gym-card');
  assert.equal(await text(page, '.saved-count'), '1 gym');
  await tap(page, 'a.gym-card .save');
  await page.waitForSelector('.saved-empty');
  await page.waitForSelector('.toast-action');
  assert.match(await text(page, '.toast'), /Iron Gym removed/);
  assert.equal(await page.$eval('.toast', (e) => getComputedStyle(e).pointerEvents), 'none', 'a message does not block taps beneath it');
  await sleep(450);
  await page.click('.toast-action');
  await page.waitForSelector('a.gym-card');
  await open(page, '/home');
  await page.waitForSelector('.home-actions a[href="/saved"]');
  await done();
});

test('every sideways row has working arrows', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/home');
  await page.waitForSelector('.city-card');
  await page.waitForFunction(() => document.querySelectorAll('.rail-arrows').length >= 2);
  await page.$eval('#cities', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(500);
  const moved = await page.evaluate(async () => {
    const section = document.querySelector('#cities').closest('section');
    const row = section.querySelector('.h-rail');
    const prev = section.querySelector('[aria-label="Previous"]');
    const startDisabled = prev.getAttribute('aria-disabled') === 'true';
    section.querySelector('[aria-label="Next"]').click();
    await new Promise((r) => setTimeout(r, 900));
    return { startDisabled, left: row.scrollLeft, prevEnabled: prev.getAttribute('aria-disabled') === 'false' };
  });
  assert.equal(moved.startDisabled, true);
  assert.ok(moved.left > 100 && moved.prevEnabled, JSON.stringify(moved));
  await open(page, '/gyms/iron-gym-berlin');
  await page.waitForSelector('.day-head .rail-arrows');
  assert.ok(await exists(page, '.gallery-arrows'), 'the photo gallery has arrows');
  await done();
});

test('the opening screen: words on the right, search in the middle, air between them', needsChrome, async () => {
  for (const [width, height, mobile] of [[390, 844, true], [1440, 900, false]]) {
    const { page, done } = await visitor({ width, height, mobile });
    await open(page, '/home');
    await page.waitForSelector('.home-login');
    await sleep(1000);
    const m = await page.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      const hero = box('.vhero');
      const title = box('.home-title');
      const search = box('.home-search');
      return { heroCentre: (hero.left + hero.right) / 2, searchCentre: (search.left + search.right) / 2, gap: search.top - title.bottom, align: getComputedStyle(document.querySelector('.vhero-copy')).textAlign, frost: getComputedStyle(document.querySelector('.home-login')).backdropFilter, pause: !!document.querySelector('.vhero-pause') };
    });
    assert.equal(m.align, 'right');
    assert.match(m.frost, /blur/, 'the frosted glass really renders in Chrome');
    assert.equal(m.pause, false, 'the hero has no pause button');
    assert.ok(Math.abs(m.heroCentre - m.searchCentre) <= 2, `${width}px: search centre ${m.searchCentre}, hero centre ${m.heroCentre}`);
    assert.ok(m.gap >= 22, `${width}px: gap ${m.gap}`);
    await done();
  }
});

test('a finished tap makes a sound, starting to scroll does not, and pressing turns the arrows', needsChrome, async () => {
  const { page, done } = await visitor();
  await page.evaluateOnNewDocument(() => {
    window.notes = 0;
    window.buzzes = [];
    Navigator.prototype.vibrate = function (p) {
      window.buzzes.push(p);
      return true;
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) {
      window.notes += 1;
      return start.apply(this, a);
    };
  });
  await open(page, '/home');
  await page.waitForSelector('.move');
  // The tiles move down when the gym list arrives, so the finger waits for it.
  await page.waitForSelector('.feature-card');
  await page.$eval('.move', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(500);
  const card = await (await page.$('.move')).boundingBox();
  const x = card.x + card.width / 2;
  const y = card.y + card.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(550);
  const turn = await page.$eval('.move-foot i', (e) => new DOMMatrix(getComputedStyle(e).transform).b);
  assert.ok(turn > 0.4, `the arrow turns while pressed (${turn})`);
  // Dragging away is a scroll, not a tap.
  await page.mouse.move(x, y - 220, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.notes), 0, 'no sound for a scroll');
  await tap(page, '.tabbar a[href="/gyms"]');
  await page.waitForFunction(() => window.notes > 0);
  await page.waitForSelector('a.gym-card');
  await page.evaluate(() => { window.buzzes = []; });
  await tap(page, '.chip');
  await sleep(150);
  const buzzes = await page.evaluate(() => window.buzzes);
  assert.equal(buzzes.length, 1, `one tap, one buzz, got ${JSON.stringify(buzzes)}`);
  assert.ok(buzzes[0] >= 16, 'strong enough to feel');

  // Swiping as a guest only opens the login sheet, so it earns a tick, not the success chime.
  await open(page, '/gyms/iron-gym-berlin');
  await pickTime(page);
  await page.evaluate(() => { window.notes = 0; });
  await page.click('.swipe-thumb');
  await page.waitForSelector('.auth-skip');
  assert.ok((await page.evaluate(() => window.notes)) <= 2, 'no success chime before anything succeeded');
  await done();
});

test('no screen scrolls sideways at the smallest phone size', needsChrome, async () => {
  const { page, done } = await visitor({ width: 360, height: 740 });
  const { next } = await demoSession(page);
  for (const path of ['/home', '/gyms?city=Berlin', '/gyms/iron-gym-berlin', '/bookings', `/bookings/${next.id}`, '/wallet', '/inbox', '/account', '/saved', '/partners', '/privacy', '/credits']) {
    await open(page, path);
    await page.waitForFunction(() => document.querySelector('main'));
    await sleep(700);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(over, 0, `${path} overflows by ${over}px`);
  }
  await done();
});

test('View saved shows a gym saved a moment ago, even when the list comes from memory', needsChrome, async () => {
  const { page, done } = await visitor();
  await demoSession(page);
  await open(page, '/saved');
  await page.waitForSelector('.saved-empty');
  await tapText(page, 'Find a gym');
  await page.waitForSelector('a.gym-card');
  await tap(page, 'a.gym-card .save');
  await page.waitForSelector('.toast-action');
  await page.click('.toast-action');
  await page.waitForFunction(() => location.pathname === '/saved');
  await page.waitForSelector('a.gym-card');
  await done();
});

test('the general-area note applies only to that city', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms');
  await page.waitForSelector('.where-note');
  await tap(page, '.search-head .search-pill');
  await page.waitForSelector('.sheet-search[data-state="open"]');
  await tapText(page, 'Paris');
  await page.waitForFunction(() => /Paris/.test(document.querySelector('.search-title')?.innerText ?? ''));
  assert.equal(await exists(page, '.where-note'), false);
  await done();
});

test('a Train your way tile keeps its filter, even when the place has to be asked for', needsChrome, async () => {
  const { page, done } = await visitor({ replace: { '/api/where': { status: 200, contentType: 'application/json', body: '{"city":null}' } } });
  await open(page, '/home');
  await page.waitForSelector('.move');
  await tap(page, '.move');
  await page.waitForSelector('.ask');
  await tapText(page, 'Search a city');
  await tapText(page, 'Berlin');
  await page.waitForSelector('.applied');
  assert.match(await text(page, '.applied'), /Squat racks/);
  assert.match(await address(page), /city=Berlin/);
  await done();
});

test('a saved home city beats the network, and exact location beats both', needsChrome, async () => {
  const { page, done } = await visitor();
  await demoSession(page);
  await page.evaluate(() => fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ home_city: 'Lisbon' }) }));
  await open(page, '/home');
  await page.waitForFunction(() => document.querySelector('.featured-where')?.innerText === 'Top picks in Lisbon');
  assert.equal(await exists(page, '.where-note'), false, 'someone who told us their city is not asked again');
  await open(page, '/gyms');
  await page.waitForFunction(() => /Lisbon/.test(document.querySelector('.search-title')?.innerText ?? ''));

  await page.browserContext().overridePermissions(BASE, ['geolocation']);
  await page.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  await open(page, '/home');
  await page.waitForFunction(() => document.querySelector('.featured-where')?.innerText === 'Top picks near you');
  assert.equal(await exists(page, '.where-note'), false);
  await done();
});

test('a saved price limit can be cleared for a search', needsChrome, async () => {
  const { page, done } = await visitor();
  await demoSession(page);
  await page.evaluate(() => fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ max_price_cents: 1500 }) }));
  await open(page, '/gyms?city=Berlin');
  await page.waitForSelector('.applied');
  assert.match(await text(page, '.applied'), /Up to/);
  await page.click('.applied button');
  await page.waitForFunction(() => location.search.includes('maxPrice=any'));
  await page.waitForFunction(() => !document.querySelector('.applied'));
  await done();
});

test('change booking: closing payment keeps the change open, and the new time is confirmed', needsChrome, async () => {
  const { page, done } = await visitor();
  const { next } = await demoSession(page);
  await open(page, `/bookings/${next.id}`);
  await page.waitForSelector('.pass-show');
  await tapText(page, 'Change date or gym');
  await page.waitForSelector('.sheet-change[data-state="open"]');
  await tapText(page, 'Move to another gym');
  await page.waitForSelector('.gym-pick button');
  await page.evaluate(() => {
    const price = (b) => Number(b.innerText.match(/\u20ac(\d+)/)?.[1] ?? 0);
    [...document.querySelectorAll('.gym-pick button')].sort((a, b) => price(b) - price(a))[0].click();
  });
  await page.waitForSelector('.sheet-change .time-pill:not(:disabled)');
  await sleep(300);
  await page.evaluate(() => document.querySelector('.sheet-change .time-pill:not(:disabled)').click());
  await tapText(page, 'Review change');
  await tapText(page, 'Pay ');
  await page.waitForSelector('.sheet-wallet[data-state="open"]');
  await sleep(450);
  await page.click('.sheet-wallet [aria-label="Close"]');
  await sleep(700);
  assert.equal(await exists(page, '.sheet-wallet'), false);
  assert.ok(await exists(page, '.sheet-change[data-state="open"]'), 'the change is still open');
  await tapText(page, 'Pay ');
  await page.waitForSelector('.sheet-wallet[data-state="open"]');
  await sleep(450);
  await page.click('.wallet-pay');
  await page.waitForFunction(() => location.search.includes('updated=1'));
  await page.waitForFunction(() => /Booking updated/.test(document.querySelector('.banner-volt')?.innerText ?? ''));

  // Both sheets closed together, and the Back button still works the way it should.
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  assert.equal(await page.evaluate(() => !!history.state?.daypassSheet), false, 'no step left behind for Back');
  await tapText(page, "I can't get in");
  await page.waitForSelector('.reasons');
  await sleep(400);
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  assert.match(await address(page), /\/bookings\//, 'Back closed the sheet and stayed on the pass');
  await done();
});

test('a real account: no made-up history, and the door buttons follow the session time', needsDb, async () => {
  const { page, done } = await visitor();
  await realSession(page);
  await open(page, '/account');
  await page.waitForSelector('.rings');
  assert.match(await text(page, '.stat-grid'), /Visits 0 Cities 0 Spent \u20ac0/);
  assert.match(await text(page, '.rings-list'), /Visits this month 0 of 4/);

  const id = await bookFromPage(page);
  await page.evaluate((b) => fetch(`/api/bookings/${b}/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), id);
  await open(page, `/bookings/${id}`);
  await page.waitForSelector('.pass-show');
  await tapText(page, "I can't get in");
  await page.waitForFunction(() => /opens on the day of your session/.test(document.querySelector('.pass-actions')?.innerText ?? ''));
  assert.equal(await exists(page, '.reasons'), false);
  await page.click('.pass-show');
  await page.waitForSelector('.desk');
  assert.equal(await exists(page, '.desk-sim'), false, 'no check-in days ahead');

  await moveBooking(id, 0.5);
  await open(page, `/bookings/${id}`);
  await page.waitForSelector('.pass-show');
  await page.click('.pass-show');
  await page.waitForSelector('.desk-sim');
  await open(page, '/bookings');
  await page.waitForSelector('.title-dot');

  await moveBooking(id, -4);
  await open(page, `/bookings/${id}`);
  await page.waitForSelector('.pass-title');
  assert.equal(await text(page, '.holo-kind'), 'Expired');
  assert.equal(await text(page, '.holo-code span'), 'No longer valid');
  assert.equal(await exists(page, '.pass-show'), false);
  await open(page, '/wallet');
  await page.waitForFunction(() => /empty/i.test(document.querySelector('.wallet-screen')?.innerText ?? ''));
  await open(page, '/bookings');
  await page.waitForSelector('.page-title');
  assert.equal(await exists(page, '.title-dot'), false, 'Passes agrees with Wallet');

  // The visit now counts, on the stats and the rings.
  await open(page, '/account');
  await page.waitForSelector('.rings');
  assert.match(await text(page, '.stat-grid'), /Visits 1 Cities 1 /);
  assert.match(await text(page, '.rings-list'), /Visits this month 1 of 4/);

  // Turned away and claiming later: the refund works, and it doesn't claim the spot is free for a past session.
  await open(page, `/bookings/${id}`);
  await tapText(page, "I couldn't get in");
  await page.waitForSelector('.reasons');
  await sleep(450);
  await page.click('.reasons button');
  await tapText(page, 'Refund');
  await page.waitForFunction(() => document.querySelector('.pass-title')?.innerText.toLowerCase() === 'cancelled');
  assert.ok(!/free again/.test(await text(page, 'main')), 'a past session has no spot to free');
  await done();
});

test('a server error does not look like being logged out', needsChrome, async () => {
  const replace = {};
  const { page, done } = await visitor({ replace, intercept: true });
  await demoSession(page);
  await open(page, '/home');
  await page.waitForFunction(() => /^Hi /.test(document.querySelector('.home-brand')?.innerText.trim() ?? ''));
  replace['/api/auth/me'] = { status: 500, contentType: 'application/json', body: '{"error":"Down"}' };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  assert.match(await text(page, '.home-brand'), /^Hi /);
  delete replace['/api/auth/me'];
  await done();
});

test('your next session shows on the opening screen', needsChrome, async () => {
  const { page, done } = await visitor();
  const { next } = await demoSession(page);
  await open(page, '/home');
  await page.waitForSelector('.vhero-next');
  assert.ok((await text(page, '.vhero-next')).includes(next.gym_name));
  await done();
});

test('the door scanner checks a pass once while it stays in view', needsChrome, async () => {
  const { page, done } = await visitor();
  await page.evaluateOnNewDocument(() => {
    window.inView = '';
    window.BarcodeDetector = class {
      async detect() {
        return window.inView ? [{ rawValue: window.inView }] : [];
      }
    };
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    setInterval(() => canvas.getContext('2d').fillRect(0, 0, 16, 16), 100);
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(10);
  });
  const { next } = await demoSession(page);
  let checks = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/staff')) checks += 1;
  });
  await open(page, '/staff');
  await tapText(page, 'Start scanning');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.evaluate(() => { window.inView = 'https://example.com/not-a-pass'; });
  await sleep(1000);
  assert.equal(checks, 0, 'other QR codes are ignored');
  await page.evaluate((code) => { window.inView = `DAYPASS:${code}`; }, next.code);
  await page.waitForFunction(() => /let them in/i.test(document.querySelector('.staff-result')?.innerText ?? ''));
  await sleep(2500);
  assert.match(await text(page, '.staff-result'), /let them in/i, 'the green result stays');
  assert.equal(checks, 1, 'one check while the pass stays in view');
  await page.evaluate(() => { window.inView = ''; });
  await sleep(3200);
  await page.evaluate((code) => { window.inView = `DAYPASS:${code}`; }, next.code);
  // Seconds later is still the same person at the door, so it doesn't count as them leaving.
  await page.waitForFunction(() => /already in/i.test(document.querySelector('.staff-result')?.innerText ?? ''));
  assert.equal(checks, 2, 'shown again after leaving the camera, it is checked again');
  if (sql) {
    // A minute on, the same scan checks them out.
    await page.evaluate(() => { window.inView = ''; });
    await sql`UPDATE bookings SET checked_in_at = now() - interval '40 minutes' WHERE id = ${next.id}::uuid`;
    await sleep(3200);
    await page.evaluate((code) => { window.inView = `DAYPASS:${code}`; }, next.code);
    await page.waitForFunction(() => /checked out/i.test(document.querySelector('.staff-result')?.innerText ?? ''));
    assert.match(await text(page, '.staff-result'), /left after 40 min/);
  }
  await done();
});

test('deleting an account removes its saved pages too', needsChrome, async () => {
  const { page, done } = await visitor({ intercept: false });
  await demoSession(page);
  await open(page, '/bookings');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await open(page, '/account');
  await tapText(page, 'Delete account');
  await page.waitForSelector('#del-confirm');
  await sleep(450);
  await page.type('#del-confirm', 'DELETE');
  await tapText(page, 'Delete my account');
  await page.waitForFunction(() => location.pathname === '/home');
  const left = await page.evaluate(async () => (await (await caches.open('daypass-pages')).keys()).map((r) => new URL(r.url).pathname));
  assert.ok(!left.some((p) => /^\/(bookings|account)/.test(p)), `found ${left}`);
  await done();
});

// What a finger lands on at the middle of an element, and where that middle is.
const under = (page, selector) => page.$eval(selector, (e) => {
  e.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = e.getBoundingClientRect();
  const x = (r.left + r.right) / 2;
  const y = (r.top + r.bottom) / 2;
  const hit = document.elementFromPoint(x, y);
  return { x, y, cover: !!hit?.closest('[data-tick]'), parent: hit?.closest('[data-tick]')?.parentElement.className ?? '' };
});

test('iPhone: a tap reaches a hidden switch first, then the control, exactly once', needsChrome, async () => {
  const { page, done } = await visitor({ iphone: true });
  await page.evaluateOnNewDocument(() => {
    window.trail = [];
    window.addEventListener('click', (e) => window.trail.push(e.target.tagName), { capture: true });
    window.buzzes = [];
    Navigator.prototype.vibrate = function (p) {
      window.buzzes.push(p);
      return true;
    };
  });
  await open(page, '/home');
  await page.waitForSelector('.feature-card > [data-tick]');
  await page.waitForSelector('.tabbar a[href="/gyms"] > [data-tick]');
  assert.equal(await exists(page, 'a.skip > [data-tick]'), false, 'the skip link is left to the browser');
  assert.equal(await exists(page, '.home-fine a > [data-tick]'), false, 'a link inside a sentence gets no cover');

  // The card's own link: the tap goes label, switch, then link.
  const card = await page.$eval('.feature-card', (e) => {
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await sleep(300);
  await page.evaluate(() => { window.trail = []; });
  await page.mouse.click(card.x, card.y);
  await page.waitForFunction(() => location.pathname.startsWith('/gyms/'));
  assert.deepEqual((await page.evaluate(() => window.trail)).slice(0, 3), ['LABEL', 'INPUT', 'A']);

  // The heart stays above its card's cover, and a tap on it never opens the gym.
  await open(page, '/home');
  await page.waitForSelector('.feature-card .save > [data-tick]');
  await sleep(300);
  const heart = await under(page, '.feature-card .save');
  assert.ok(heart.parent.includes('save'), `the heart's own cover is on top, found ${heart.parent}`);
  await page.mouse.click(heart.x, heart.y);
  await page.waitForSelector('.auth-skip');
  assert.equal(await address(page), '/home', 'still on Home');

  // A sort of button that needs its form sent.
  await open(page, '/login');
  await page.waitForSelector('#auth-email');
  await page.type('#auth-email', 'nobody@example.com');
  await page.type('#auth-password', 'not-the-password');
  await page.waitForSelector('button[type="submit"] > [data-tick]');
  const asked = page.waitForResponse((r) => r.url().includes('/api/auth/'));
  await tap(page, 'button[type="submit"]');
  assert.equal((await asked).request().method(), 'POST', 'the login form was really sent');

  // One tap, one buzz, and the switch really changed.
  await open(page, '/gyms?city=Berlin');
  await page.waitForSelector('.chip > [data-tick]');
  await sleep(300);
  await page.evaluate(() => { window.buzzes = []; });
  await tap(page, '.chip');
  await sleep(150);
  assert.equal((await page.evaluate(() => window.buzzes)).length, 1, 'one tap, one buzz');
  assert.equal(await page.$eval('.chip > [data-tick] input', (i) => i.checked), true, 'the tap reached the switch');
  await done();
});

test('iPhone: a touch that starts on a cover still scrolls, and Haptics off removes the covers', needsChrome, async () => {
  const { page, done } = await visitor({ iphone: true });
  await open(page, '/home');
  await page.waitForSelector('.move > [data-tick]');
  await page.$eval('.move', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(400);
  const before = await page.evaluate(() => scrollY);
  const box = await (await page.$('.move')).boundingBox();
  const cdp = await page.createCDPSession();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  assert.ok((await under(page, '.move')).cover, 'the touch starts on the cover');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - (240 * i) / 12 }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
  assert.ok((await page.evaluate(() => scrollY)) > before + 100, 'the page scrolled');
  assert.equal(await address(page), '/home', 'and nothing opened');

  await page.evaluate(() => localStorage.setItem('daypass-haptics', '0'));
  await open(page, '/home');
  await page.waitForSelector('.tabbar a[href="/gyms"] > [data-tick]');
  assert.equal(await page.$eval('.tabbar a[href="/gyms"] > [data-tick]', (e) => getComputedStyle(e).display), 'none');
  await tap(page, '.tabbar a[href="/gyms"]');
  await page.waitForFunction(() => location.pathname === '/gyms');
  await done();
});

test('other phones get no covers, and the sideways rows reach the screen edge', needsChrome, async () => {
  const { page, done } = await visitor({ iphone: false });
  await open(page, '/home');
  await page.waitForSelector('.rail-section .h-rail');
  await sleep(1200);
  assert.equal(await exists(page, '[data-tick]'), false);
  const m = await page.$eval('.rail-section', (s) => ({ left: s.getBoundingClientRect().left, right: s.getBoundingClientRect().right, width: innerWidth }));
  assert.equal(m.left, 0, 'the row can run off the left edge');
  assert.equal(m.right, m.width, 'and off the right edge');
  await done();
});

test('the floating navigation sits in the exact middle, with four equal circles, on phones of every size', needsChrome, async () => {
  for (const width of [320, 390, 440]) {
    const { page, done } = await visitor({ width, height: 900 });
    // A tab can be current or, on a page like Privacy, none of them.
    for (const path of ['/home', '/gyms?city=Berlin', '/privacy']) {
      await open(page, path);
      await page.waitForSelector('.tabbar a');
      await sleep(500);
      // The current circle lands with a small bounce, so it is measured once that has finished.
      const m = await page.evaluate(async () => {
        await Promise.all(document.querySelector('.tabbar').getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
        const items = [...document.querySelectorAll('.tabbar a')].map((a) => a.getBoundingClientRect());
        return { offCentre: (Math.min(...items.map((r) => r.left)) + Math.max(...items.map((r) => r.right))) / 2 - innerWidth / 2, sizes: items.map((r) => r.width), heights: items.map((r) => r.height) };
      });
      assert.ok(Math.abs(m.offCentre) <= 0.5, `${width}px ${path}: ${m.offCentre}px off centre`);
      assert.equal(new Set(m.sizes).size, 1, `${width}px ${path}: equal widths, got ${m.sizes}`);
      assert.deepEqual(m.sizes, m.heights, 'and round');
      assert.ok(m.sizes[0] >= 48, 'big enough to tap');
    }
    await done();
  }
});

test('the upcoming reminder stays calm: a small chip and a card that does not take over Home', needsDb, async () => {
  const { page, done } = await visitor({ width: 440, height: 956 });
  await demoSession(page);
  await open(page, '/home');
  await page.waitForSelector('.next-photo');
  await page.waitForSelector('.vhero-next');
  await sleep(600);
  const m = await page.evaluate(() => {
    const words = document.querySelector('.next-number small');
    const number = document.querySelector('.next-number strong');
    const shade = getComputedStyle(document.querySelector('.next-photo-shade')).backgroundImage;
    return { height: document.querySelector('.next-photo').getBoundingClientRect().height, number: parseFloat(getComputedStyle(number).fontSize), words: words.innerText, shade };
  });
  assert.ok(m.height <= 190, `the card is ${m.height}px tall`);
  assert.ok(m.number <= 70, `the number is ${m.number}px`);
  assert.match(m.words, /to go/);
  await done();
});

test('pressing a card moves it, and a swipe from that press still scrolls the row without opening it', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/home');
  await page.waitForSelector('.featured-item .feature-card');
  await ready(page, '.home-search button');
  await sleep(800);
  await page.$eval('.featured-track', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(500);
  const rest = await (await page.$('.featured-item .feature-card')).boundingBox();
  const x = rest.x + rest.width / 2;
  const y = rest.y + rest.height / 2;
  const cdp = await page.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(300);
  const pressed = await page.$eval('.featured-item .feature-card', (e) => ({ on: e.classList.contains('is-pressed'), width: e.getBoundingClientRect().width }));
  assert.ok(pressed.on, 'the card knows it is pressed');
  assert.ok(pressed.width < rest.width * 0.98, `the card moved: ${rest.width} to ${pressed.width}`);
  for (let i = 1; i <= 14; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - (240 * i) / 14, y }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(800);
  assert.ok((await page.$eval('.featured-track', (e) => e.scrollLeft)) > 100, 'the row swiped');
  assert.equal(await exists(page, '.is-pressed'), false, 'the card let go');
  assert.equal(await address(page), '/home', 'and nothing opened');
  await done();
});

test('choosing a sort goes back to the top of the list', needsChrome, async () => {
  const { page, done } = await visitor();
  await open(page, '/gyms?city=Berlin');
  await page.waitForSelector('a.gym-card');
  await ready(page, '.filter-sort .chip');
  await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'instant' }));
  await sleep(300);
  assert.ok((await page.evaluate(() => scrollY)) > 1000);
  await page.evaluate(() => [...document.querySelectorAll('.filter-sort .chip')].find((c) => c.textContent.includes('Lowest')).click());
  await page.waitForFunction(() => scrollY === 0);
  assert.match(await address(page), /sort=price_asc/);
  await done();
});

test('the calendar: a dot opens its day, a note is kept, and a ring opens its history', needsDb, async () => {
  const { page, done } = await visitor();
  await open(page, '/home');
  await page.evaluate(() => fetch('/api/auth/demo', { method: 'POST' }));
  await open(page, '/account');
  await page.waitForSelector('.dot');
  await ready(page, '.dot');
  // While a page streams in, a hidden copy of the calendar can sit beside it, so only marks on show count.
  const marks = () => page.$$eval('.dot.has-note', (d) => d.filter((e) => e.checkVisibility()).length);
  const notesBefore = await marks();
  // A day with a visit shows its times.
  await page.evaluate(() => document.querySelector('.dot.on').click());
  await page.waitForSelector('.log-day .log-visit');
  assert.match(await text(page, '.log-visit'), /In \d\d:\d\d, exit not recorded/);
  await page.evaluate(() => document.querySelector('.sheet .round-sm').click());
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  // A day with nothing on it can still hold a note, and closing the sheet saves it.
  await page.evaluate(() => document.querySelector('.dot:not(.on):not(.is-booked):not(.has-note)').click());
  await page.waitForSelector('#day-note');
  assert.match(await text(page, '.log-day .sheet-sub'), /No visit/);
  await page.type('#day-note', 'Rest day');
  await page.evaluate(() => document.querySelector('.sheet .round-sm').click());
  await page.waitForFunction((n) => [...document.querySelectorAll('.dot.has-note')].filter((e) => e.checkVisibility()).length === n + 1, {}, notesBefore);
  await open(page, '/account');
  await page.waitForSelector('.dot');
  await ready(page, '.rings-list button');
  assert.equal(await marks(), notesBefore + 1, 'the note is still there after a reload');
  // Ring, to a visit in its history, to that day, and back.
  await ready(page, '.rings-list button');
  await page.evaluate(() => document.querySelectorAll('.rings-list button')[1].click());
  await page.waitForSelector('.log-ring .log-visit');
  assert.match(await text(page, '#sheet-title'), /GYMS THIS YEAR/i);
  await page.evaluate(() => document.querySelector('.log-ring .log-visit').click());
  await page.waitForSelector('.log-day');
  await page.evaluate(() => document.querySelector('.log-day .back-link').click());
  await page.waitForSelector('.log-ring');
  await done();
});

test('a pass runs a timer from check-in, Home shows it, and slide to check out stops it, with undo', needsDb, async () => {
  const { page, done } = await visitor();
  await open(page, '/home');
  await page.evaluate(() => fetch('/api/auth/demo', { method: 'POST' }));
  const next = await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).next);
  await open(page, `/bookings/${next.id}`);
  await ready(page, '.pass-show');
  await page.evaluate(() => document.querySelector('.pass-show').click());
  await page.waitForSelector('.desk-sim');
  await page.evaluate(() => document.querySelector('.desk-sim').click());
  await page.waitForSelector('.visit-clock.is-live');
  const first = await text(page, '.visit-clock .stay-timer');
  await sleep(2200);
  assert.notEqual(await text(page, '.visit-clock .stay-timer'), first, 'the timer runs');
  await open(page, '/home');
  await page.waitForSelector('.vhero-next.is-live .stay-timer');
  await open(page, `/bookings/${next.id}`);
  await page.waitForSelector('.visit-clock .swipe-thumb');
  await ready(page, '.visit-clock .swipe-thumb');
  await page.focus('.visit-clock .swipe-thumb');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.visit-times');
  assert.match(await text(page, '.visit-times'), /Time inside/);
  await page.waitForSelector('.toast .toast-action');
  await page.evaluate(() => document.querySelector('.toast .toast-action').click());
  await page.waitForSelector('.visit-clock.is-live');
  await done();
});

test('the panel asks for the password, opens on all gyms, and a real check-in appears by itself', needsDb, async () => {
  const { page, done } = await visitor();
  const { next } = await demoSession(page);
  await open(page, '/owner');
  await page.waitForSelector('#owner-password');
  assert.equal(await exists(page, '.owner-stats'), false, 'nothing shows before the password');
  assert.equal(await exists(page, '.tabbar a'), false, 'it is its own screen');
  await ready(page, '.owner-gate button');
  await page.type('#owner-password', 'wrong');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.owner-gate .form-error');
  await page.$eval('#owner-password', (e) => e.select());
  await page.type('#owner-password', 'uxdd');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.owner-stats');
  await ready(page, '#owner-gym');
  assert.equal(await page.$eval('#owner-gym', (s) => s.value), '', 'all gyms');
  const clock = await text(page, '.owner-clock');
  // Checked in somewhere else. Nobody touches the panel, and it shows up.
  await page.evaluate((id) => fetch(`/api/bookings/${id}/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), next.id);
  await page.waitForFunction((code) => [...document.querySelectorAll('[aria-labelledby="owner-in"] .owner-row')].some((r) => r.textContent.includes(code)), {}, next.code);
  assert.notEqual(await text(page, '.owner-clock'), clock, 'the clock runs');
  await page.evaluate((code) => [...document.querySelectorAll('[aria-labelledby="owner-in"] .owner-row')].find((r) => r.textContent.includes(code)).querySelector('.owner-btn').click(), next.code);
  await page.waitForFunction((code) => [...document.querySelectorAll('.owner-event')].some((r) => r.textContent.includes(code) && r.textContent.includes('left after')), {}, next.code);
  // The scanner opens from here, and comes back here.
  await open(page, '/staff');
  await page.waitForSelector('.staff-camera');
  assert.equal(await page.$eval('.staff-top a', (a) => a.getAttribute('href')), '/owner');
  await done();
});

test('the camera scanner reads a real QR code on a browser with no QR reader of its own, like an iPhone', needsChrome, async () => {
  const { page, done } = await visitor();
  await page.evaluateOnNewDocument(() => {
    window.BarcodeDetector = undefined;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const paint = canvas.getContext('2d');
    setInterval(() => {
      paint.fillStyle = '#fff';
      paint.fillRect(0, 0, 480, 480);
      const code = window.shownCode;
      if (!code) return;
      const cell = Math.floor(360 / code.size);
      paint.fillStyle = '#000';
      code.bits.forEach((on, i) => {
        if (on) paint.fillRect(60 + (i % code.size) * cell, 60 + Math.floor(i / code.size) * cell, cell, cell);
      });
    }, 100);
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(10);
  });
  const { next } = await demoSession(page);
  await open(page, '/staff');
  await tapText(page, 'Start scanning');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  const QRCode = (await import('qrcode')).default;
  const { modules } = QRCode.create(`DAYPASS:${next.code}`, { errorCorrectionLevel: 'M' });
  await page.evaluate((code) => { window.shownCode = code; }, { size: modules.size, bits: Array.from(modules.data) });
  await page.waitForFunction(() => /let them in/i.test(document.querySelector('.staff-result')?.innerText ?? ''));
  await done();
});
