import { createSession, destroySession, getCurrentUser, handle, hashPassword, HttpError, verifyPassword } from '@/lib/auth';
import { addSamplePastVisit } from '@/lib/bookings';
import { db } from '@/lib/db';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handle(async (req, ctx) => {
  const { action } = await ctx.params;

  if (action === 'logout') {
    await destroySession();
    return Response.json({ ok: true });
  }

  const body = await req.json().catch(() => ({}));
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
    await addSamplePastVisit(rows[0].id as string);
    await createSession(rows[0].id as string);
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

export const GET = handle(async (_req, ctx) => {
  const { action } = await ctx.params;
  if (action !== 'me') throw new HttpError(404, 'Not found.');
  const user = await getCurrentUser();
  return Response.json({ user: user ? { name: user.name, email: user.email, saved_card: user.saved_card } : null }, { headers: { 'Cache-Control': 'no-store' } });
});
