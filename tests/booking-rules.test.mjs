// End-to-end checks for the booking rules in the build pack, run against the real API and database.
// Start the app first. BASE_URL defaults to the local dev server.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const LOCAL = BASE.includes('localhost');
const sql = process.env.DATABASE_URL ? (await import('@neondatabase/serverless')).neon(process.env.DATABASE_URL) : null;

test('login is optional: guests open on Home and can browse, but need a login to book', async () => {
  const start = await fetch(`${BASE}/`, { redirect: 'manual' });
  assert.ok([307, 308].includes(start.status));
  assert.ok(start.headers.get('location').endsWith('/home'), 'the app opens on Home, not login');
  const home = await fetch(`${BASE}/home`, { redirect: 'manual' });
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes('Where are you training'), 'guests see Home');
  for (const path of ['/gyms', '/gyms/iron-gym-amsterdam', '/partners', '/privacy']) {
    assert.equal((await fetch(BASE + path, { redirect: 'manual' })).status, 200, `${path} is open`);
  }
  const { gym, slots } = await freeSlots();
  const book = await fetch(`${BASE}/api/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId: gym.id, startsAt: later(slots)[0].startsAt, key: key() }) });
  assert.equal(book.status, 401, 'booking needs a login');
  for (const path of ['/bookings', '/account']) {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    assert.equal(res.status, 307, `${path} redirects`);
    assert.ok(res.headers.get('location').includes('/login'), `${path} goes to login`);
  }
});

async function client() {
  let cookie = '';
  const call = async (path, options = {}) => {
    const res = await fetch(BASE + path, {
      ...options,
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', cookie, ...(options.headers ?? {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.clone().json(); } catch {}
    return { status: res.status, data };
  };
  const email = `qa+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const reg = await call('/api/auth/register', { method: 'POST', body: { name: 'QA Tester', email, password: 'testing-123' } });
  assert.equal(reg.status, 200);
  return call;
}

async function freeSlots(gymSlug = 'iron-gym-amsterdam') {
  const search = await (await fetch(`${BASE}/api/gyms?city=Amsterdam&sort=nearest`)).json();
  const gym = search.gyms.find((g) => g.slug === gymSlug) ?? search.gyms[0];
  const { days } = await (await fetch(`${BASE}/api/gyms/${gym.id}/slots`)).json();
  return { gym, slots: days.flatMap((d) => d.slots) };
}

const later = (slots) => slots.filter((s) => new Date(s.startsAt).getTime() > Date.now() + 30 * 3600000);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const key = () => crypto.randomUUID();

// These tests share a database with the app, so they leave nothing behind: no accounts, no gyms, no reviews.
const demoEmails = [];
after(async () => {
  if (!sql) return;
  await sql`DELETE FROM users WHERE is_demo AND email = ANY(${demoEmails})`;
  await sql`DELETE FROM users WHERE email LIKE 'qa+%@example.com'`;
  await sql`DELETE FROM gyms WHERE slug LIKE 'qa-test-gym-%' AND is_demo = false`;
  await sql`UPDATE slots s SET booked = (SELECT count(*) FROM bookings b WHERE b.gym_id = s.gym_id AND b.starts_at = s.starts_at AND b.status IN ('hold', 'confirmed'))`;
});

async function demoClient(headers = {}) {
  let cookie = '';
  const call = async (path, options = {}) => {
    const res = await fetch(BASE + path, { ...options, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: options.body ? JSON.stringify(options.body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.clone().json(); } catch {}
    return { status: res.status, data };
  };
  assert.equal((await call('/api/auth/demo', { method: 'POST' })).status, 200);
  demoEmails.push((await call('/api/auth/me')).data.user.email);
  return call;
}

test('demo login gives a working session with an upcoming pass and messages', async () => {
  const call = await demoClient();
  const me = await call('/api/auth/me');
  assert.equal(me.data.user.is_demo, true);
  assert.ok(me.data.next?.id, 'has an upcoming pass');
  assert.ok(me.data.unread >= 2, 'has inbox messages');
  assert.ok(me.data.toRate?.id, 'has a visit to rate');
});

test('wallet, desk check-in, staff check and locked changes all work', async () => {
  const call = await demoClient();
  const { data } = await call('/api/auth/me');
  const { id, code } = data.next;
  assert.equal((await call(`/api/bookings/${id}/wallet`, { method: 'POST', body: {} })).status, 200);
  const look = await call('/api/staff', { method: 'POST', body: { code, apply: false } });
  assert.equal(look.data.result, 'valid', 'a demo pass can be tried at the door any time');
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: 'DP-NOPE1' } })).data.result, 'unknown');
  const checkin = await call(`/api/bookings/${id}/checkin`, { method: 'POST', body: {} });
  assert.ok(checkin.data.checked_in_at);
  assert.equal((await call('/api/staff', { method: 'POST', body: { code } })).data.result, 'used');
  assert.equal((await call(`/api/bookings/${id}`, { method: 'DELETE' })).data.code, 'checked_in');
});

test('refused entry refunds in full and frees the spot, once', async () => {
  const call = await demoClient();
  const { data } = await call('/api/auth/me');
  const taken = () => sql`SELECT s.booked FROM slots s JOIN bookings b ON b.gym_id = s.gym_id AND b.starts_at = s.starts_at WHERE b.id = ${data.next.id}::uuid`;
  const before = sql ? (await taken())[0].booked : 0;
  const refund = await call(`/api/bookings/${data.next.id}/refused`, { method: 'POST', body: { reason: 'The gym was closed' } });
  assert.equal(refund.status, 200);
  assert.ok(refund.data.refund_cents > 0);
  if (sql) assert.equal((await taken())[0].booked, before - 1, 'the spot is free again');
  assert.equal((await call(`/api/bookings/${data.next.id}/refused`, { method: 'POST', body: { reason: 'again' } })).status, 409);
  assert.equal((await call('/api/auth/me')).data.next, null);
});

test('saving a gym needs a login and then persists', async () => {
  const search = await (await fetch(`${BASE}/api/gyms?city=Amsterdam`)).json();
  const gymId = search.gyms[0].id;
  const guest = await fetch(`${BASE}/api/saved`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId, saved: true }) });
  assert.equal(guest.status, 401);
  const call = await demoClient();
  assert.equal((await call('/api/saved', { method: 'POST', body: { gymId, saved: true } })).status, 200);
  assert.ok((await call('/api/auth/me')).data.saved.includes(gymId));
});

test('malformed requests get a clear 400, not a server error', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(res.status, 400);
});

test('search filters, coordinates and pages work', async () => {
  const cheap = await (await fetch(`${BASE}/api/gyms?city=Amsterdam&maxPrice=1200`)).json();
  assert.ok(cheap.gyms.every((g) => g.price_cents <= 1200));
  const kit = await (await fetch(`${BASE}/api/gyms?city=Amsterdam&equipment=Sauna`)).json();
  assert.ok(kit.gyms.every((g) => g.equipment.includes('Sauna')));
  const near = await fetch(`${BASE}/api/gyms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: 52.3676, lng: 4.9041, sort: 'nearest' }) });
  const body = await near.json();
  assert.ok(body.gyms.length >= 20);
  const page2 = await (await fetch(`${BASE}/api/gyms?city=Amsterdam&page=2`)).json();
  const page1 = await (await fetch(`${BASE}/api/gyms?city=Amsterdam`)).json();
  const firstIds = new Set(page1.gyms.map((g) => g.id));
  assert.ok(page2.gyms.length > 0 && !page2.gyms.some((g) => firstIds.has(g.id)), 'page 2 shows different gyms');
  assert.equal(page2.page, 2);
});

test('search returns at least 20 gyms per page with distance and price', async () => {
  const r = await (await fetch(`${BASE}/api/gyms?city=Amsterdam`)).json();
  assert.ok(r.gyms.length >= 20);
  assert.ok(r.gyms.every((g) => g.price_cents > 0 && g.distance_km != null));
});

test('a declined payment makes no booking and frees the spot', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const slot = pick(later(slots));
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: key() } });
  assert.equal(hold.status, 200);
  const pay = await call(`/api/checkout/${hold.data.booking.id}/pay`, { method: 'POST', body: { method: 'demo-decline' } });
  assert.equal(pay.status, 402);
  assert.equal(pay.data.code, 'declined');
  const after = (await (await fetch(`${BASE}/api/gyms/${gym.id}/slots`)).json()).days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt);
  assert.equal(after.spots, slot.spots);
});

test('paying twice charges once and returns the same booking', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const slot = pick(later(slots));
  const k = key();
  const [h1, h2] = await Promise.all([
    call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: k } }),
    call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: k } }),
  ]);
  assert.equal(h1.status, 200);
  assert.equal(h2.status, 200);
  assert.equal(h1.data.booking.id, h2.data.booking.id);
  const id = h1.data.booking.id;
  const [p1, p2] = await Promise.all([
    call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } }),
    call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } }),
  ]);
  assert.equal(p1.status, 200);
  assert.equal(p2.status, 200);
  const after = (await (await fetch(`${BASE}/api/gyms/${gym.id}/slots`)).json()).days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt);
  assert.equal(after?.spots ?? 0, slot.spots - 1, 'exactly one spot taken');
});

test('many users racing for one slot never overbook it', async () => {
  const { gym, slots } = await freeSlots();
  const slot = pick(later(slots));
  const users = await Promise.all(Array.from({ length: slot.spots + 3 }, () => client()));
  const results = await Promise.all(users.map((call) => call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: key() } })));
  const won = results.filter((r) => r.status === 200).length;
  assert.equal(won, slot.spots, 'winners equal the free spots');
  assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409));
});

test('rescheduling frees the old slot and takes the new one', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const free = later(slots);
  const from = pick(free);
  const to = pick(free.filter((s) => s.startsAt !== from.startsAt));
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: from.startsAt, key: key() } });
  const id = hold.data.booking.id;
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  const moved = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: to.startsAt } });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.booking.confirmation_version, 2);
  const now = (await (await fetch(`${BASE}/api/gyms/${gym.id}/slots`)).json()).days.flatMap((d) => d.slots);
  assert.equal(now.find((s) => s.startsAt === from.startsAt)?.spots, from.spots, 'old slot freed');
  assert.equal(now.find((s) => s.startsAt === to.startsAt)?.spots ?? 0, to.spots - 1, 'new slot taken');
});

test('two changes at once: only one wins', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const free = later(slots);
  const [a, b, c] = [...free].sort(() => Math.random() - 0.5);
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: a.startsAt, key: key() } });
  const id = hold.data.booking.id;
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  // Both say which version they were looking at, so the order they happen to arrive in cannot matter.
  const [x, y] = await Promise.all([
    call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: b.startsAt, version: 1 } }),
    call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: c.startsAt, version: 1 } }),
  ]);
  assert.equal([x, y].filter((r) => r.status === 200).length, 1);
  assert.equal([x, y].find((r) => r.status === 409)?.data.code, 'stale');
});

test('a change from an out-of-date screen cannot replace a newer one', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const [a, b, c] = [...later(slots)].sort(() => Math.random() - 0.5);
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: a.startsAt, key: key() } });
  const id = hold.data.booking.id;
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  const first = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: b.startsAt, version: 1 } });
  assert.equal(first.data.booking.confirmation_version, 2);
  // A second device still shows the booking as it was, however much later this arrives.
  const stale = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: c.startsAt, version: 1 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, 'stale');
  const fresh = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: c.startsAt, version: 2 } });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.booking.confirmation_version, 3);
});

test('a reused checkout key cannot pay for a different slot', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const [a, b] = [...later(slots)].sort(() => Math.random() - 0.5);
  const k = key();
  assert.equal((await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: a.startsAt, key: k } })).status, 200);
  const second = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: b.startsAt, key: k } });
  assert.equal(second.status, 409);
  assert.equal(second.data.code, 'hold_ended');
});

test('invalid times are refused', async () => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const halfPast = new Date(new Date(later(slots)[0].startsAt).getTime() + 30 * 60000).toISOString();
  const past = new Date(Date.now() - 3600000).toISOString();
  for (const startsAt of [halfPast, past]) {
    const r = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt, key: key() } });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'slot_invalid');
  }
});

test('login checks the password and logout ends the session', async () => {
  const email = `qa+${Date.now()}-login@example.com`;
  const post = (path, body, cookie = '') => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  assert.equal((await post('/api/auth/register', { name: 'QA', email, password: 'testing-123' })).status, 200);
  assert.equal((await post('/api/auth/register', { name: 'QA', email, password: 'testing-123' })).status, 409);
  assert.equal((await post('/api/auth/login', { email, password: 'wrong-password' })).status, 401);
  const ok = await post('/api/auth/login', { email, password: 'testing-123' });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie').split(';')[0];
  const me = () => fetch(`${BASE}/api/auth/me`, { headers: { cookie } }).then((r) => r.json());
  assert.equal((await me()).user.email, email);
  await post('/api/auth/logout', {}, cookie);
  assert.equal((await me()).user, null);
});

test('a stranger cannot read a pass, and an unpaid hold has no pass', async () => {
  const call = await client();
  const stranger = await client();
  const { gym, slots } = await freeSlots();
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: pick(later(slots)).startsAt, key: key() } });
  const id = hold.data.booking.id;
  assert.equal((await call(`/api/bookings/${id}/calendar`)).status, 404, 'unpaid hold');
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  assert.equal((await call(`/api/bookings/${id}/calendar`)).status, 200, 'owner');
  assert.equal((await stranger(`/api/bookings/${id}/calendar`)).status, 404, 'stranger');
});

test('changes and cancelling are refused under 24 hours', async (t) => {
  const call = await client();
  const { gym, slots } = await freeSlots();
  const soon = slots.filter((s) => new Date(s.startsAt).getTime() < Date.now() + 23 * 3600000);
  if (!soon.length) return t.skip('no slot under 23 hours at this time of day');
  const slot = soon[soon.length - 1];
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: key() } });
  assert.equal(hold.status, 200);
  const id = hold.data.booking.id;
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  const cancel = await call(`/api/bookings/${id}`, { method: 'DELETE' });
  assert.equal(cancel.status, 409);
  assert.equal(cancel.data.code, 'too_late');
  const move = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: later(slots)[0].startsAt } });
  assert.equal(move.status, 409);
  assert.equal(move.data.code, 'too_late');
});

test('cancelling refunds and frees the spot; only the owner can see a booking', async () => {
  const call = await client();
  const stranger = await client();
  const { gym, slots } = await freeSlots();
  const slot = pick(later(slots));
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: key() } });
  const id = hold.data.booking.id;
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  assert.equal((await stranger(`/api/bookings/${id}`, { method: 'DELETE' })).status, 404);
  const done = await call(`/api/bookings/${id}`, { method: 'DELETE' });
  assert.equal(done.status, 200);
  assert.equal(done.data.booking.refund_cents, gym.price_cents);
  const after = (await (await fetch(`${BASE}/api/gyms/${gym.id}/slots`)).json()).days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt);
  assert.equal(after.spots, slot.spots);
});

test('moving to a pricier gym charges the difference, a cheaper gym refunds it', async () => {
  const call = await client();
  const search = await (await fetch(`${BASE}/api/gyms?city=Amsterdam&sort=price_asc`)).json();
  const cheap = search.gyms[0];
  const dear = search.gyms.findLast((g) => g.price_cents > cheap.price_cents);
  const slotsOf = async (g) => later((await (await fetch(`${BASE}/api/gyms/${g.id}/slots`)).json()).days.flatMap((d) => d.slots));
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: cheap.id, startsAt: pick(await slotsOf(cheap)).startsAt, key: key() } });
  const id = hold.data.booking.id;
  await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  const up = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { gymId: dear.id, startsAt: pick(await slotsOf(dear)).startsAt, method: 'demo-card' } });
  assert.equal(up.status, 200);
  assert.equal(up.data.difference, dear.price_cents - cheap.price_cents);
  const down = await call(`/api/bookings/${id}`, { method: 'PATCH', body: { gymId: cheap.id, startsAt: pick(await slotsOf(cheap)).startsAt } });
  assert.equal(down.status, 200);
  assert.equal(down.data.refund, dear.price_cents - cheap.price_cents);
});

// Door, refund and privacy rules for real accounts. These move a booking's time in the database,
// because the rules depend on how close the session is.
const needsDb = { skip: sql ? false : 'needs DATABASE_URL (npm test loads it from .env.local)' };

async function booked(call) {
  const { gym, slots } = await freeSlots();
  const slot = pick(later(slots));
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: key() } });
  assert.equal(hold.status, 200);
  const id = hold.data.booking.id;
  assert.equal((await call(`/api/checkout/${id}/pay`, { method: 'POST', body: { method: 'demo-card' } })).status, 200);
  const [row] = await sql`SELECT code, price_cents FROM bookings WHERE id = ${id}::uuid`;
  return { id, code: row.code, price: row.price_cents, gym, slot };
}
const moveTo = (id, hours) => sql`UPDATE bookings SET starts_at = now() + make_interval(mins => ${Math.round(hours * 60)}::int) WHERE id = ${id}::uuid`;

test('the door: valid once, then used, with the QR prefix, and expired or cancelled passes refused', needsDb, async () => {
  const call = await client();
  const a = await booked(call);
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, 'wrong_date', 'a real pass days away');
  await moveTo(a.id, 1.5);
  const [{ same_day: sameDay }] = await sql`SELECT (b.starts_at AT TIME ZONE g.timezone)::date = (now() AT TIME ZONE g.timezone)::date AS same_day FROM bookings b JOIN gyms g ON g.id = b.gym_id WHERE b.id = ${a.id}::uuid`;
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, sameDay ? 'too_early' : 'wrong_date', 'later today is too early, not the wrong date');
  await moveTo(a.id, 0.5);
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: `DAYPASS:${a.code}` } })).data.result, 'valid');
  const [row] = await sql`SELECT checked_in_at FROM bookings WHERE id = ${a.id}::uuid`;
  assert.ok(row.checked_in_at, 'a valid scan checks the pass in');
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, 'used');
  assert.equal((await call(`/api/bookings/${a.id}`, { method: 'PATCH', body: { startsAt: pick(later((await freeSlots()).slots)).startsAt } })).data.code, 'checked_in');

  const old = await booked(call);
  await moveTo(old.id, -4);
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: old.code } })).data.result, 'expired');

  const gone = await booked(call);
  assert.equal((await call(`/api/bookings/${gone.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: gone.code } })).data.result, 'cancelled');
});

test('two scans at once let one person in', needsDb, async () => {
  const call = await client();
  const a = await booked(call);
  await moveTo(a.id, 0.5);
  const scans = await Promise.all([1, 2].map(() => call('/api/staff', { method: 'POST', body: { code: a.code } })));
  assert.deepEqual(scans.map((s) => s.data.result).sort(), ['used', 'valid']);
});

test('a demo pass can be scanned from another phone, so the door can be acted out', async () => {
  const demo = await demoClient();
  const { data } = await demo('/api/auth/me');
  const other = await client();
  const seen = await other('/api/staff', { method: 'POST', body: { code: data.next.code, apply: false } });
  assert.equal(seen.data.result, 'valid');
  assert.ok(seen.data.holder, 'reception sees the name');
});

test('another account cannot read, use or change a real person\'s pass', needsDb, async () => {
  const owner = await client();
  const stranger = await client();
  const demo = await demoClient();
  const a = await booked(owner);
  await moveTo(a.id, 0.5);
  for (const other of [stranger, demo]) {
    const seen = await other('/api/staff', { method: 'POST', body: { code: a.code } });
    assert.equal(seen.data.result, 'unknown');
    assert.equal(seen.data.holder, undefined, 'the holder name stays private');
  }
  const [row] = await sql`SELECT checked_in_at FROM bookings WHERE id = ${a.id}::uuid`;
  assert.equal(row.checked_in_at, null, 'the pass is still unused');
  for (const action of ['wallet', 'checkin', 'refused']) {
    assert.equal((await stranger(`/api/bookings/${a.id}/${action}`, { method: 'POST', body: {} })).status, 404, action);
  }
});

test('a real account can only check in and claim refused entry around its session', needsDb, async () => {
  const call = await client();
  const a = await booked(call);
  assert.equal((await call(`/api/bookings/${a.id}/checkin`, { method: 'POST', body: {} })).data.code, 'too_early');
  assert.equal((await call(`/api/bookings/${a.id}/refused`, { method: 'POST', body: { reason: 'closed' } })).data.code, 'too_early');
  await moveTo(a.id, 2);
  const refund = await call(`/api/bookings/${a.id}/refused`, { method: 'POST', body: { reason: 'closed' } });
  assert.equal(refund.status, 200);
  assert.equal(refund.data.refund_cents, a.price, 'the full price comes back');
  const b = await booked(call);
  await moveTo(b.id, 0.5);
  assert.ok((await call(`/api/bookings/${b.id}/checkin`, { method: 'POST', body: {} })).data.checked_in_at);

  const late = await booked(call);
  await moveTo(late.id, -4);
  assert.equal((await call(`/api/bookings/${late.id}/checkin`, { method: 'POST', body: {} })).data.code, 'too_late', 'a finished session says so');
  const [row] = await sql`SELECT checked_in_at FROM bookings WHERE id = ${late.id}::uuid`;
  assert.equal(row.checked_in_at, null);
  const lateClaim = await call(`/api/bookings/${late.id}/refused`, { method: 'POST', body: { reason: 'closed' } });
  assert.equal(lateClaim.data.refund_cents, late.price, 'turned away and claiming four hours later still works');
  const gone = await booked(call);
  await moveTo(gone.id, -7);
  assert.equal((await call(`/api/bookings/${gone.id}/refused`, { method: 'POST', body: { reason: 'closed' } })).data.code, 'too_late');
});

async function qaGym() {
  const slug = `qa-test-gym-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [gym] = await sql`INSERT INTO gyms (slug, name, city, country, timezone, address, lat, lng, price_cents, is_demo) VALUES (${slug}, 'QA Test Gym', 'Testville', 'Testland', 'Europe/Berlin', '1 Test Street', 10.5, 10.5, 1000, false) RETURNING id`;
  return gym;
}

test('demo ratings stay private, and a real visit counts on saved gyms too', needsDb, async () => {
  const publicCount = async () => (await sql`SELECT count(*)::int AS n FROM reviews WHERE is_public`)[0].n;
  const before = await publicCount();
  const demo = await demoClient();
  const { data } = await demo('/api/auth/me');
  assert.equal((await demo('/api/reviews', { method: 'POST', body: { bookingId: data.toRate.id, stars: 5 } })).status, 200);
  assert.equal(await publicCount(), before, 'a demo rating changes nothing');

  const gym = await qaGym();
  const call = await client();
  const a = await booked(call);
  await sql`UPDATE bookings SET gym_id = ${gym.id}::uuid WHERE id = ${a.id}::uuid`;
  await moveTo(a.id, -5);
  assert.equal((await call('/api/reviews', { method: 'POST', body: { bookingId: a.id, stars: 4 } })).status, 200);
  assert.equal((await call('/api/saved', { method: 'POST', body: { gymId: gym.id, saved: true } })).status, 200);
  const saved = (await call('/api/saved')).data.gyms.find((g) => g.id === gym.id);
  assert.equal(saved.rating, 4, 'the saved list counts the real review');
  assert.equal(saved.rating_count, 1);
});

test('filters really narrow the results', async () => {
  const all = await (await fetch(`${BASE}/api/gyms?city=Berlin`)).json();
  const rated = await (await fetch(`${BASE}/api/gyms?city=Berlin&minRating=4.5`)).json();
  assert.ok(rated.total > 0 && rated.total < all.total);
  assert.ok(rated.gyms.every((g) => g.rating >= 4.5));
  const cheap = await (await fetch(`${BASE}/api/gyms?city=Berlin&maxPrice=1200`)).json();
  assert.ok(cheap.total > 0 && cheap.total < all.total);
  const kit = await (await fetch(`${BASE}/api/gyms?city=Berlin&equipment=Sauna`)).json();
  assert.ok(kit.total > 0 && kit.total < all.total);
  const nearest = await (await fetch(`${BASE}/api/gyms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: 52.52, lng: 13.405, sort: 'nearest' }) })).json();
  const distances = nearest.gyms.map((g) => Number(g.distance_km));
  assert.deepEqual(distances, [...distances].sort((x, y) => x - y), 'nearest is in distance order');
});

test('open now matches each gym\'s own hours', async () => {
  const { gymStatus } = await import('../lib/hours.ts');
  const open = await (await fetch(`${BASE}/api/gyms?city=Berlin&openNow=1`)).json();
  assert.ok(open.gyms.every((g) => gymStatus(g).open));
  const all = await (await fetch(`${BASE}/api/gyms?city=Berlin`)).json();
  assert.ok(open.total <= all.total);
  if (all.total === all.gyms.length) assert.equal(open.total, all.gyms.filter((g) => gymStatus(g).open).length);
});

test('private screens send guests to login, and bad booking input is refused', async () => {
  for (const path of ['/wallet', '/inbox', '/staff', '/saved']) {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    assert.equal(res.status, 307, path);
    assert.ok(res.headers.get('location').includes('/login'), path);
  }
  const call = await client();
  const { gym, slots } = await freeSlots();
  const slot = later(slots)[0];
  const at = new Date(new Date(slot.startsAt).getTime() + 30000).toISOString();
  assert.equal((await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: at, key: key() } })).data.code, 'slot_invalid');
  assert.equal((await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt } })).status, 400);
});

test('a reminder arrives once, and opening the inbox clears the count', needsDb, async () => {
  const call = await client();
  const a = await booked(call);
  await moveTo(a.id, 2);
  const first = (await call('/api/auth/me')).data.unread;
  const second = (await call('/api/auth/me')).data.unread;
  assert.equal(second, first, 'no duplicate reminder');
  const [msg] = await sql`SELECT title, body FROM messages WHERE booking_id = ${a.id}::uuid AND kind = 'reminder'`;
  assert.equal(msg.title, `Coming up: ${a.gym.name}`, 'the title stays true on any day it is read');
  assert.match(msg.body, /\d{2}:\d{2}/, 'the message gives the time');
  assert.equal((await call('/api/messages', { method: 'POST' })).status, 200);
  assert.equal((await call('/api/auth/me')).data.unread, 0);
});

test('a gym that is no longer listed cannot be saved, and a malformed id is refused plainly', async () => {
  const call = await client();
  assert.equal((await call('/api/saved', { method: 'POST', body: { gymId: crypto.randomUUID(), saved: true } })).status, 404);
  const dashes = '-'.repeat(36);
  assert.equal((await call('/api/saved', { method: 'POST', body: { gymId: dashes, saved: true } })).status, 400);
  assert.equal((await call(`/api/bookings/${dashes}/checkin`, { method: 'POST', body: {} })).status, 404);
});

test('general area: decoded, safe with bad input, and absent when unknown', { skip: LOCAL ? false : 'Vercel sets these headers itself on the live site' }, async () => {
  const where = async (headers) => (await fetch(`${BASE}/api/where`, { headers })).json();
  assert.deepEqual(await where({ 'x-vercel-ip-city': 'M%C3%BCnchen', 'x-vercel-ip-country': 'DE' }), { city: 'M\u00fcnchen', country: 'DE' });
  assert.equal((await where({ 'x-vercel-ip-city': '%E0%A4%A' })).city, null);
  assert.equal((await where({})).city, null);
});

test('a demo pass is placed in the visitor\'s area when it has gyms', { skip: LOCAL ? false : 'Vercel sets this header itself on the live site' }, async () => {
  const here = await demoClient({ 'x-vercel-ip-city': 'Berlin' });
  assert.equal((await here('/api/auth/me')).data.next.gym_city, 'Berlin');
  const elsewhere = await demoClient({ 'x-vercel-ip-city': 'Nowhereville' });
  assert.equal((await elsewhere('/api/auth/me')).data.next.gym_city, 'Amsterdam');
});

test('the country settles which city a name means', async () => {
  const paris = await (await fetch(`${BASE}/api/gyms?city=Paris&country=FR`)).json();
  assert.equal(paris.place.country, 'France');
  assert.equal((await fetch(`${BASE}/api/gyms?city=Paris&country=ZZ`)).status, 404);
});

test('city suggestions can be cached when the lookup worked', async () => {
  const res = await fetch(`${BASE}/api/places?q=Berlin`);
  assert.match(res.headers.get('cache-control') ?? '', /public/);
  assert.ok((await res.json()).places.length > 0);
});

test('deleting an account erases it at once, frees its spot and ends its login', async () => {
  const call = await client();
  const email = (await call('/api/auth/me')).data.user.email;
  const { gym, slots } = await freeSlots();
  const slot = pick(later(slots));
  const hold = await call('/api/checkout', { method: 'POST', body: { gymId: gym.id, startsAt: slot.startsAt, key: key() } });
  await call(`/api/checkout/${hold.data.booking.id}/pay`, { method: 'POST', body: { method: 'demo-card' } });
  const spots = async () => (await (await fetch(`${BASE}/api/gyms/${gym.id}/slots`)).json()).days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt)?.spots;
  const before = await spots();
  assert.equal((await call('/api/account', { method: 'DELETE', body: { confirm: 'delete it' } })).status, 400, 'needs the word DELETE');
  assert.equal((await call('/api/account', { method: 'DELETE', body: { confirm: 'DELETE' } })).status, 200);
  assert.equal((await call('/api/auth/me')).data.user, null, 'logged out');
  assert.equal(await spots(), before + 1, 'the spot is free again');
  const again = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'testing-123' }) });
  assert.equal(again.status, 401, 'the account is gone, so it cannot log in');
  if (sql) assert.equal((await sql`SELECT count(*)::int AS n FROM users WHERE email = ${email}`)[0].n, 0, 'erased from the database');
});

test('a city search arrives with its first gyms and their map pins already in the page', async () => {
  const html = await (await fetch(`${BASE}/gyms?city=Berlin`)).text();
  const cards = html.match(/class="gym-card/g)?.length ?? 0;
  assert.ok(cards >= 20, `found ${cards} gyms in the page`);
  assert.ok((html.match(/class="pin"/g)?.length ?? 0) >= 2, 'pins drawn before the map loads');
});

test('entry and exit: a double scan stays in, a later scan lets them out, and the times are kept', needsDb, async () => {
  const call = await client();
  const a = await booked(call);
  await moveTo(a.id, 0.5);
  const scan = () => call('/api/staff', { method: 'POST', body: { code: a.code } }).then((r) => r.data);
  assert.equal((await scan()).result, 'valid');
  assert.equal((await call('/api/auth/me')).data.inGym.id, a.id, 'Home knows they are in the gym');
  const double = await scan();
  assert.equal(double.result, 'used', 'a scan straight after is a double scan');
  assert.equal(double.inside, true);
  const [{ checked_out_at: still }] = await sql`SELECT checked_out_at FROM bookings WHERE id = ${a.id}::uuid`;
  assert.equal(still, null, 'and does not end the visit');
  await sql`UPDATE bookings SET checked_in_at = now() - interval '5 minutes' WHERE id = ${a.id}::uuid`;
  const out = await scan();
  assert.equal(out.result, 'out');
  assert.equal(out.stay, '5 min');
  assert.equal((await call('/api/auth/me')).data.inGym, null);
  const again = await scan();
  assert.equal(again.result, 'used');
  assert.ok(again.leftAt, 'a third scan shows both times');
  await sql`UPDATE bookings SET checked_in_at = checked_in_at - interval '9 days', checked_out_at = checked_out_at - interval '9 days' WHERE id = ${a.id}::uuid`;
  assert.match((await scan()).usedAt, /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]+, \d\d:\d\d$/, 'a pass from another day says which day');
});

test('checking out from the pass: only once inside, only your own, can be undone, and not days later', needsDb, async () => {
  const call = await client();
  const stranger = await client();
  const a = await booked(call);
  const exit = (c = call) => c(`/api/bookings/${a.id}/exit`, { method: 'POST', body: {} });
  assert.equal((await exit()).data.code, 'not_in', 'nobody can leave before they arrive');
  await moveTo(a.id, 0.5);
  await call(`/api/bookings/${a.id}/checkin`, { method: 'POST', body: {} });
  assert.equal((await exit(stranger)).status, 404, "someone else's pass");
  const first = await exit();
  assert.equal(first.status, 200);
  assert.ok(first.data.checked_out_at);
  assert.equal(new Date((await exit()).data.checked_out_at).getTime(), new Date(first.data.checked_out_at).getTime(), 'leaving twice keeps the first time');
  assert.equal((await stranger(`/api/bookings/${a.id}/exit-undo`, { method: 'POST', body: {} })).status, 409, "a stranger can't undo it");
  assert.equal((await call(`/api/bookings/${a.id}/exit-undo`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await call('/api/auth/me')).data.inGym.id, a.id, 'back in the gym');
  await sql`UPDATE bookings SET checked_out_at = now() - interval '10 minutes' WHERE id = ${a.id}::uuid`;
  assert.equal((await call(`/api/bookings/${a.id}/exit-undo`, { method: 'POST', body: {} })).data.code, 'too_late');
  await sql`UPDATE bookings SET checked_out_at = NULL, checked_in_at = now() - interval '7 hours' WHERE id = ${a.id}::uuid`;
  assert.equal((await exit()).data.code, 'too_late', 'a forgotten visit stays unrecorded, not seven hours long');
  assert.equal((await call('/api/auth/me')).data.inGym, null, 'and no timer keeps running');
});

test('calendar notes save, replace and delete, and stay private', needsDb, async () => {
  const call = await client();
  const other = await client();
  const put = (c, day, body) => c('/api/notes', { method: 'PUT', body: { day, body } });
  assert.equal((await fetch(`${BASE}/api/notes`, { method: 'PUT', body: '{}' })).status, 401, 'needs a login');
  assert.equal((await put(call, '2026-02-31', 'x')).status, 400, 'a day that does not exist');
  assert.equal((await put(call, 'soon', 'x')).status, 400);
  assert.equal((await put(call, '2026-11-01', 'x'.repeat(501))).status, 400, 'too long');
  assert.equal((await put(call, '2026-11-01', '  Rest day  ')).data.body, 'Rest day');
  assert.equal((await put(call, '2026-11-01', 'Rest day, sore knees')).status, 200);
  await put(other, '2026-11-01', 'Not yours');
  const { data: me } = await call('/api/auth/me');
  const rows = await sql`SELECT n.body FROM day_notes n JOIN users u ON u.id = n.user_id WHERE u.email = ${me.user.email}`;
  assert.deepEqual(rows.map((r) => r.body), ['Rest day, sore knees'], 'one note a day, and only your own');
  assert.equal((await put(call, '2026-11-01', '   ')).data.body, '');
  assert.equal((await sql`SELECT count(*)::int AS n FROM day_notes n JOIN users u ON u.id = n.user_id WHERE u.email = ${me.user.email}`)[0].n, 0, 'an empty note is removed');
});

async function ownerClient() {
  let cookie = '';
  return async (path, options = {}) => {
    const res = await fetch(BASE + path, { ...options, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie }, body: options.body ? JSON.stringify(options.body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: await res.clone().json().catch(() => null) };
  };
}

test('the owner panel is locked without the admin password', async () => {
  const owner = await ownerClient();
  assert.equal((await owner('/api/owner?gym=iron-gym-amsterdam')).status, 401);
  assert.equal((await owner('/api/owner', { method: 'POST', body: { gym: 'iron-gym-amsterdam', kind: 'guest', id: '1', action: 'out' } })).status, 401);
  assert.equal((await owner('/api/owner/session', { method: 'POST', body: { password: 'wrong' } })).status, 401);
  assert.equal((await owner('/api/owner/session', { method: 'POST', body: {} })).status, 401);
  assert.equal((await owner('/api/owner?gym=iron-gym-amsterdam')).status, 401);
  // A made-up cookie gets nowhere.
  const forged = await fetch(`${BASE}/api/owner?gym=iron-gym-amsterdam`, { headers: { cookie: 'daypass_owner=abc' } });
  assert.equal(forged.status, 401);
  assert.equal((await owner('/api/owner/session', { method: 'POST', body: { password: 'uxdd' } })).status, 200);
  assert.equal((await owner('/api/owner?gym=iron-gym-amsterdam')).status, 200);
  assert.equal((await owner('/api/owner?gym=no-such-gym')).status, 404);
  assert.equal((await owner('/api/owner/session', { method: 'DELETE' })).status, 200);
  assert.equal((await owner('/api/owner?gym=iron-gym-amsterdam')).status, 401, 'locking the panel locks it');
});

test('the panel is real: a gym nobody scanned at is all zeros, and a scan makes the entry', needsDb, async () => {
  const owner = await ownerClient();
  await owner('/api/owner/session', { method: 'POST', body: { password: 'uxdd' } });

  // Usually a gym shows nothing at all, because nothing is made up.
  const [quiet] = await sql`SELECT g.slug FROM gyms g WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.gym_id = g.id AND (b.starts_at > now() - interval '3 days' OR b.checked_in_at > now() - interval '3 days')) LIMIT 1`;
  const empty = (await owner(`/api/owner?gym=${quiet.slug}`)).data;
  assert.deepEqual([empty.stats.inside, empty.stats.entries, empty.stats.exits, empty.stats.gross], [0, 0, 0, 0]);
  assert.deepEqual([empty.inside.length, empty.arriving.length, empty.log.length], [0, 0, 0]);
  assert.equal(empty.hours.reduce((a, b) => a + b, 0), 0);
  assert.equal(empty.latestHour, null);

  // Everything shown anywhere is a real booking.
  const all = (await owner('/api/owner')).data;
  const shown = [...new Set([...all.inside, ...all.arriving, ...all.log].map((v) => v.code))];
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM bookings WHERE code = ANY(${shown}) AND NOT is_sample`;
  assert.equal(n, shown.length, 'every code on the panel is a real booking');

  // A real person's pass, booked for soon. The admin can scan it, with no account of their own.
  const call = await client();
  const a = await booked(call);
  await moveTo(a.id, 0.1);
  const before = (await owner(`/api/owner?gym=${a.gym.slug}`)).data;
  assert.ok(before.arriving.some((v) => v.id === a.id), 'booked for today');
  const scan = await owner('/api/owner', { method: 'POST', body: { gym: a.gym.slug, code: a.code } });
  assert.equal(scan.data.desk.result, 'valid');
  assert.equal(scan.data.desk.holder, 'QA T.', 'first name and last initial at the desk');
  const inside = scan.data.snapshot.inside.find((v) => v.id === a.id);
  assert.equal(inside.name, 'QA T.');
  assert.equal(scan.data.snapshot.stats.inside, before.stats.inside + 1);
  assert.equal(scan.data.snapshot.stats.entries, before.stats.entries + 1);
  const text = JSON.stringify(scan.data.snapshot);
  assert.ok(!text.includes('QA Tester'), 'never the full name');
  assert.ok(!text.includes('@example.com'), 'never the email');
  assert.equal((await call('/api/auth/me')).data.inGym.id, a.id, 'and the person sees the timer');

  // The all-gyms view has it too, with its gym.
  assert.ok((await owner('/api/owner')).data.inside.some((v) => v.id === a.id && v.gym.includes(a.gym.name)));

  // A desk at one gym refuses a pass for another. A double scan does not end the visit.
  const elsewhere = a.gym.slug === 'iron-gym-berlin' ? 'iron-gym-amsterdam' : 'iron-gym-berlin';
  assert.equal((await owner('/api/owner', { method: 'POST', body: { gym: elsewhere, code: a.code } })).data.desk.result, 'other_gym');
  assert.equal((await owner('/api/owner', { method: 'POST', body: { code: a.code } })).data.desk.inside, true);

  // Checking out from the panel reaches the person, and goes in the log.
  const out = await owner('/api/owner', { method: 'POST', body: { id: a.id, action: 'out' } });
  assert.equal(out.status, 200);
  assert.ok(out.data.snapshot.log.some((e) => e.key === `${a.id}-out`));
  assert.equal((await call('/api/auth/me')).data.inGym, null);
  assert.equal((await owner('/api/owner', { method: 'POST', body: { id: a.id, action: 'out' } })).status, 409, 'not in the gym any more');
  assert.equal((await owner('/api/owner', { method: 'POST', body: { id: a.id, action: 'wave' } })).status, 400);
});

test('the door scanner works for anyone with the admin password, and the door rules still apply', needsDb, async () => {
  const owner = await ownerClient();
  const call = await client();
  const a = await booked(call);
  const stranger = await client();
  assert.equal((await owner('/api/staff', { method: 'POST', body: { code: a.code } })).status, 401, 'nobody without the password or an account');
  assert.equal((await stranger('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, 'unknown', 'an account alone cannot look up a real pass');
  await owner('/api/owner/session', { method: 'POST', body: { password: 'uxdd' } });
  assert.equal((await owner('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, 'wrong_date', 'too soon, even for an admin');
  await moveTo(a.id, -4);
  assert.equal((await owner('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, 'expired', 'an old pass is refused');
  await moveTo(a.id, 0.1);
  assert.equal((await owner('/api/staff', { method: 'POST', body: { code: a.code } })).data.result, 'valid');
  const page = await fetch(`${BASE}/staff`, { redirect: 'manual' });
  assert.equal(page.status, 307, 'the scanner page still needs one or the other');
});
