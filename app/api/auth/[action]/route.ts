import { dateLabel, timeLabel } from '@/lib/format';
import { networkArea } from '@/lib/where';
import { createSession, destroySession, getCurrentUser, handle, hashPassword, HttpError, readJson, refreshSessionCookie, verifyPassword } from '@/lib/auth';
import { addMessage, addSamplePastVisit, createDemoUser } from '@/lib/bookings';
import { db } from '@/lib/db';
import { MAX_STAY_HOURS } from '@/lib/hours';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handle(async (req, ctx) => {
  const { action } = await ctx.params;

  if (action === 'logout') {
    await destroySession();
    return Response.json({ ok: true });
  }

  if (action === 'demo') {
    const userId = await createDemoUser(networkArea(req.headers).city);
    await createSession(userId);
    return Response.json({ ok: true });
  }

  const body = await readJson(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (action === 'register') {
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(400, 'Enter your name.', 'name');
    if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.', 'email');
    if (password.length < 8) throw new HttpError(400, 'Use at least 8 characters for your password.', 'password');
    const hash = await hashPassword(password);
    const rows = await db()`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name.slice(0, 80)}, ${hash}) ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!rows[0]) throw new HttpError(409, 'That email already has an account. Log in instead.', 'email');
    const userId = rows[0].id as string;
    // A real account's example visit is always in the same city, so nothing about where its owner is gets stored.
    await addSamplePastVisit(userId).catch(() => {});
    await addMessage(userId, 'welcome', `Welcome, ${name.split(' ')[0]}`, 'Your account is ready. Book a session and your pass will appear in Passes.');
    await createSession(userId);
    return Response.json({ ok: true });
  }

  if (action === 'login') {
    const rows = await db()`SELECT id, password_hash, deletion_requested_at FROM users WHERE email = ${email}`;
    const valid = rows[0] ? await verifyPassword(password, rows[0].password_hash as string) : false;
    if (!valid) throw new HttpError(401, 'Email or password is not right. Try again.', 'credentials');
    if (rows[0].deletion_requested_at) throw new HttpError(403, 'This account is waiting to be deleted, so it can no longer log in.', 'deleting');
    await createSession(rows[0].id as string);
    return Response.json({ ok: true });
  }

  throw new HttpError(404, 'Not found.');
});

// One call that gives the app everything personal it needs when it opens.
export const GET = handle(async (_req, ctx) => {
  const { action } = await ctx.params;
  if (action !== 'me') throw new HttpError(404, 'Not found.');
  const noStore = { headers: { 'Cache-Control': 'private, no-store' } };
  const user = await getCurrentUser();
  if (!user) return Response.json({ user: null }, noStore);
  await refreshSessionCookie();

  const [nextRows, rateRows, unread, saved, insideRows] = await Promise.all([
    db()`
      SELECT b.id, b.code, b.starts_at, g.name AS gym_name, g.slug AS gym_slug, g.city AS gym_city, g.timezone AS gym_timezone, g.photos AS gym_photos
      FROM bookings b JOIN gyms g ON g.id = b.gym_id
      WHERE b.user_id = ${user.id}::uuid AND b.status = 'confirmed' AND b.checked_in_at IS NULL AND b.starts_at > now() - interval '3 hours'
      ORDER BY b.starts_at ASC LIMIT 1`,
    db()`
      SELECT b.id, g.name AS gym_name
      FROM bookings b JOIN gyms g ON g.id = b.gym_id LEFT JOIN reviews r ON r.booking_id = b.id
      WHERE b.user_id = ${user.id}::uuid AND b.status = 'confirmed' AND r.id IS NULL
        AND (b.checked_in_at IS NOT NULL OR b.starts_at < now() - interval '3 hours')
      ORDER BY b.starts_at DESC LIMIT 1`,
    db()`SELECT count(*)::int AS n FROM messages WHERE user_id = ${user.id}::uuid AND read_at IS NULL`,
    db()`SELECT gym_id FROM saved_gyms WHERE user_id = ${user.id}::uuid`,
    db()`
      SELECT b.id, b.checked_in_at, g.name AS gym_name
      FROM bookings b JOIN gyms g ON g.id = b.gym_id
      WHERE b.user_id = ${user.id}::uuid AND b.status = 'confirmed' AND b.checked_out_at IS NULL
        AND b.checked_in_at > now() - make_interval(hours => ${MAX_STAY_HOURS}::int)
      ORDER BY b.checked_in_at DESC LIMIT 1`,
  ]);

  // The day-before reminder lands in the inbox the next time the app opens.
  const next = nextRows[0];
  let unreadCount = unread[0].n as number;
  if (next && new Date(next.starts_at as string).getTime() - Date.now() < 24 * 3600 * 1000 && new Date(next.starts_at as string).getTime() > Date.now()) {
    // A stored message can be read on a later day, so it gives the date, not "today" or "tomorrow".
    const when = `${dateLabel(next.starts_at as string, next.gym_timezone as string)} at ${timeLabel(next.starts_at as string, next.gym_timezone as string)}`;
    const added = await db()`
      INSERT INTO messages (user_id, booking_id, kind, title, body)
      VALUES (${user.id}::uuid, ${next.id as string}::uuid, 'reminder', ${`Coming up: ${next.gym_name as string}`}, ${`Your session is ${when}. Your pass is ready in Passes.`})
      ON CONFLICT DO NOTHING RETURNING id`;
    unreadCount += added.length;
  }

  return Response.json(
    {
      user: { name: user.name, email: user.email, saved_card: user.saved_card, home_city: user.home_city, default_sort: user.default_sort, max_price_cents: user.max_price_cents, is_demo: user.is_demo },
      unread: unreadCount,
      next: next ?? null,
      inGym: insideRows[0] ?? null,
      toRate: rateRows[0] ?? null,
      saved: saved.map((s) => s.gym_id as string),
    },
    noStore,
  );
});
