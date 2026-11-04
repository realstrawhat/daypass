// End-to-end checks for the booking rules in the build pack, run against the real API and database.
// Start the app first. BASE_URL defaults to the local dev server.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

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

async function demoClient() {
  let cookie = '';
  const call = async (path, options = {}) => {
    const res = await fetch(BASE + path, { ...options, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie }, body: options.body ? JSON.stringify(options.body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.clone().json(); } catch {}
    return { status: res.status, data };
  };
  assert.equal((await call('/api/auth/demo', { method: 'POST' })).status, 200);
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
  const early = await call('/api/staff', { method: 'POST', body: { code } });
  assert.equal(early.data.result, 'wrong_date', 'a future pass is the wrong date at the desk');
  assert.equal((await call('/api/staff', { method: 'POST', body: { code: 'DP-NOPE1' } })).data.result, 'unknown');
  const checkin = await call(`/api/bookings/${id}/checkin`, { method: 'POST', body: {} });
  assert.ok(checkin.data.checked_in_at);
  assert.equal((await call('/api/staff', { method: 'POST', body: { code } })).data.result, 'used');
  assert.equal((await call(`/api/bookings/${id}`, { method: 'DELETE' })).data.code, 'checked_in');
});

test('refused entry refunds in full and frees the spot, once', async () => {
  const call = await demoClient();
  const { data } = await call('/api/auth/me');
  const refund = await call(`/api/bookings/${data.next.id}/refused`, { method: 'POST', body: { reason: 'The gym was closed' } });
  assert.equal(refund.status, 200);
  assert.ok(refund.data.refund_cents > 0);
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
  const [x, y] = await Promise.all([
    call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: b.startsAt } }),
    call(`/api/bookings/${id}`, { method: 'PATCH', body: { startsAt: c.startsAt } }),
  ]);
  assert.equal([x, y].filter((r) => r.status === 200).length, 1);
  assert.equal([x, y].filter((r) => r.status === 409).length, 1);
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
const sql = process.env.DATABASE_URL ? (await import('@neondatabase/serverless')).neon(process.env.DATABASE_URL) : null;
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
});

test('demo ratings stay private and a real visit counts', needsDb, async () => {
  const slug = 'iron-gym-amsterdam';
  const score = async () => {
    const [g] = await sql`SELECT id FROM gyms WHERE slug = ${slug}`;
    const [r] = await sql`SELECT count(*)::int AS n FROM reviews WHERE gym_id = ${g.id}::uuid AND is_public`;
    return r.n;
  };
  const before = await score();
  const demo = await demoClient();
  const { data } = await demo('/api/auth/me');
  assert.equal((await demo('/api/reviews', { method: 'POST', body: { bookingId: data.toRate.id, stars: 5 } })).status, 200);
  assert.equal(await score(), before, 'a demo rating changes nothing');
  const call = await client();
  const a = await booked(call);
  await sql`UPDATE bookings SET gym_id = (SELECT id FROM gyms WHERE slug = ${slug}) WHERE id = ${a.id}::uuid`;
  await moveTo(a.id, -5);
  assert.equal((await call('/api/reviews', { method: 'POST', body: { bookingId: a.id, stars: 4 } })).status, 200);
  assert.equal(await score(), before + 1, 'a real rating counts');
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
  for (const path of ['/wallet', '/inbox', '/staff']) {
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
  const [msg] = await sql`SELECT title FROM messages WHERE booking_id = ${a.id}::uuid AND kind = 'reminder'`;
  assert.ok(msg, 'the reminder was written');
  assert.equal((await call('/api/messages', { method: 'POST' })).status, 200);
  assert.equal((await call('/api/auth/me')).data.unread, 0);
});

test('saved gyms use the same rating as everywhere else', needsDb, async () => {
  const call = await client();
  const search = await (await fetch(`${BASE}/api/gyms?city=Amsterdam`)).json();
  const gym = search.gyms[0];
  assert.equal((await call('/api/saved', { method: 'POST', body: { gymId: gym.id, saved: true } })).status, 200);
  const saved = (await call('/api/saved')).data.gyms.find((g) => g.id === gym.id);
  assert.equal(saved.rating, gym.rating);
  assert.equal(saved.rating_count, gym.rating_count);
  assert.equal((await call('/api/saved', { method: 'POST', body: { gymId: crypto.randomUUID(), saved: true } })).status, 200, 'a gym that no longer exists is ignored');
});
