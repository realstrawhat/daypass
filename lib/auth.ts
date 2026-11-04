import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from './db';

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, l: number) => Promise<Buffer>;
const COOKIE = 'daypass_session';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export type User = {
  id: string;
  email: string;
  name: string;
  home_city: string | null;
  default_sort: string;
  max_price_cents: number | null;
  saved_card: { brand: string; last4: string } | null;
  deletion_requested_at: string | null;
  is_demo: boolean;
  created_at: string;
};

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, salt, key] = stored.split('$');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: THIRTY_DAYS });

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await db()`INSERT INTO sessions (token_hash, user_id) VALUES (${hashToken(token)}, ${userId}::uuid)`;
  const store = await cookies();
  store.set(COOKIE, token, cookieOptions());
}

// A session ends after 30 days unused, so each app open moves the cookie's window forward too.
export async function refreshSessionCookie() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) store.set(COOKIE, token, cookieOptions());
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  store.delete(COOKIE);
}

// Cached per request so a page and its children share one database lookup.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token || !process.env.DATABASE_URL) return null;
  const rows = await db()`
    WITH s AS (
      UPDATE sessions SET last_seen_at = now()
      WHERE token_hash = ${hashToken(token)} AND last_seen_at > now() - interval '30 days'
      RETURNING user_id
    )
    SELECT u.id, u.email, u.name, u.home_city, u.default_sort, u.max_price_cents, u.saved_card, u.deletion_requested_at, u.is_demo, u.created_at
    FROM users u JOIN s ON s.user_id = u.id`;
  return (rows[0] as User) ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Log in to continue.', 'login');
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

// Bad requests get a clear 400 rather than a server error.
export async function readJson(req: Request): Promise<Record<string, any>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'That request could not be read. Try again.', 'bad_json');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'That request could not be read. Try again.', 'bad_json');
  return body as Record<string, any>;
}

export function handle(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
      console.error(e instanceof Error ? e.message : 'request failed');
      return Response.json({ error: 'Something went wrong on our side. Try again.' }, { status: 500 });
    }
  };
}
