import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getCurrentUser, HttpError, verifyPassword } from './auth';
import { deskCheck, markCheckedOut } from './bookings';
import { db } from './db';
import { sampleGuests } from './door-guests';
import { isUuid } from './format';
import { getGymBySlug } from './gyms';
import { localParts, localToUtc, visitState } from './hours';

// The admin password for the demo owner panel, as a hash like every other password here.
// To change it, make a new hash with hashPassword in lib/auth.ts and paste it in.
const PASSWORD_HASH = 'scrypt$17652f42a5931f9c2655f57b28d0048c$0b5448a8569bddeb652925889fe9accd42b002267421c2a65c777e50e42fd7499b561550520d43fa465e7c192e79c8a32c3e5830ff85b374bbd6fa49eba1d2dc';
const COOKIE = 'daypass_owner';
const TWELVE_HOURS = 60 * 60 * 12;

// Nobody can make this without the server's own database address, and changing the password ends every sign-in.
const ownerToken = () => createHash('sha256').update(`owner-panel:${PASSWORD_HASH}:${process.env.DATABASE_URL ?? ''}`).digest('hex');

export async function ownerSignedIn() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const given = Buffer.from(value);
  const expected = Buffer.from(ownerToken());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function requireOwner() {
  if (!(await ownerSignedIn())) throw new HttpError(401, 'Enter the admin password to continue.', 'owner_login');
}

export async function ownerLogin(password: string) {
  if (!(await verifyPassword(password, PASSWORD_HASH))) throw new HttpError(401, 'That password is not right. Try again.', 'password');
  (await cookies()).set(COOKIE, ownerToken(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TWELVE_HOURS });
}

export async function ownerLogout() {
  (await cookies()).delete(COOKIE);
}

type Visit = { key: string; kind: 'guest' | 'pass'; id: string; name: string; code: string; planned: number; in: number | null; out: number | null; price: number; live: boolean };

const ms = (v: unknown) => (v ? new Date(v as string).getTime() : null);

function today(tz: string, now: number) {
  const p = localParts(new Date(now), tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { key: `${p.y}-${pad(p.m)}-${pad(p.d)}`, start: localToUtc(p.y, p.m, p.d, 0, tz).getTime(), end: localToUtc(p.y, p.m, p.d + 1, 0, tz).getTime() };
}

// Everything that happened at this gym today: sample guests, plus demo passes and the viewer's own pass.
// A real person's visit is never shown to anyone else, which is the door scanner's rule too.
async function visitsToday(gym: { id: string; timezone: string; price_cents: number }, viewerId: string | null, now: number) {
  const day = today(gym.timezone, now);
  const [actions, passes] = await Promise.all([
    db()`SELECT guest_no, in_at, out_at FROM door_guest_actions WHERE gym_id = ${gym.id}::uuid AND day = ${day.key}::date`,
    db()`
      SELECT b.id, b.code, b.starts_at, b.checked_in_at, b.checked_out_at, b.price_cents, b.user_id, u.name, u.is_demo
      FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE b.gym_id = ${gym.id}::uuid AND b.status = 'confirmed' AND (u.is_demo OR b.user_id = ${viewerId}::uuid)
        AND ((b.checked_in_at >= ${new Date(day.start).toISOString()}::timestamptz AND b.checked_in_at < ${new Date(day.end).toISOString()}::timestamptz)
          OR (b.starts_at >= ${new Date(day.start).toISOString()}::timestamptz AND b.starts_at < ${new Date(day.end).toISOString()}::timestamptz))`,
  ]);
  const acted = new Map(actions.map((a) => [a.guest_no as number, a]));
  const visits: Visit[] = sampleGuests(gym.id, day.key, day.start, day.end).map((g) => {
    const a = acted.get(g.no);
    const entered = ms(a?.in_at) ?? (g.plannedIn <= now ? g.plannedIn : null);
    const left = ms(a?.out_at) ?? (entered !== null && g.plannedOut <= now ? g.plannedOut : null);
    return { key: `g${g.no}`, kind: 'guest', id: String(g.no), name: g.name, code: g.code, planned: g.plannedIn, in: entered, out: left, price: gym.price_cents, live: false };
  });
  for (const b of passes) {
    visits.push({
      key: `p${b.id}`, kind: 'pass', id: b.id as string, name: b.user_id === viewerId ? 'You' : (b.name as string), code: b.code as string,
      planned: ms(b.starts_at) as number, in: ms(b.checked_in_at), out: ms(b.checked_out_at), price: b.price_cents as number, live: true,
    });
  }
  return { day, visits };
}

const SHOW_LOG = 40;
const SHOW_ARRIVING = 4;

export async function ownerSnapshot(slug: string, viewerId: string | null) {
  const gym = await getGymBySlug(slug);
  if (!gym || !gym.is_demo) throw new HttpError(404, 'That gym is not part of the demo.');
  const now = Date.now();
  const { day, visits } = await visitsToday(gym, viewerId, now);

  const entered = visits.filter((v) => v.in !== null);
  const left = entered.filter((v) => v.out !== null);
  const inside = entered.filter((v) => visitState(v.in, v.out, now) === 'inside').sort((a, b) => (b.in as number) - (a.in as number));
  const waiting = visits.filter((v) => v.in === null && v.planned >= (v.live ? day.start : now));
  // A demo pass someone is trying out comes first, because that's what the person watching is looking for.
  const arriving = [...waiting.filter((v) => v.live), ...waiting.filter((v) => !v.live).sort((a, b) => a.planned - b.planned).slice(0, SHOW_ARRIVING)];

  const gross = entered.reduce((sum, v) => sum + v.price, 0);
  const hours = Array.from({ length: 24 }, () => 0);
  for (const v of entered) {
    const h = Math.floor(((v.in as number) - day.start) / 3600000);
    if (h >= 0 && h < 24) hours[h] += 1;
  }

  const log = [
    ...entered.map((v) => ({ key: `${v.key}-in`, type: 'in' as const, at: v.in as number, name: v.name, code: v.code, live: v.live, stay: null as number | null })),
    ...left.map((v) => ({ key: `${v.key}-out`, type: 'out' as const, at: v.out as number, name: v.name, code: v.code, live: v.live, stay: (v.out as number) - (v.in as number) })),
  ].sort((a, b) => b.at - a.at);

  return {
    now,
    gym: { slug: gym.slug, name: gym.name, city: gym.city, timezone: gym.timezone },
    stats: {
      inside: inside.length,
      entries: entered.length,
      exits: left.length,
      averageStay: left.length ? left.reduce((sum, v) => sum + ((v.out as number) - (v.in as number)), 0) / left.length : null,
      gross,
      keep: gross - Math.round((gross * gym.commission_bps) / 10000),
    },
    hours,
    hourNow: Math.min(23, Math.floor((now - day.start) / 3600000)),
    inside,
    arriving,
    log: log.slice(0, SHOW_LOG),
    logTotal: log.length,
  };
}

export type OwnerSnapshot = Awaited<ReturnType<typeof ownerSnapshot>>;

// What the owner can do at the door. Only sample guests, demo passes and the viewer's own pass can be touched.
export async function ownerAct(slug: string, body: Record<string, unknown>) {
  const gym = await getGymBySlug(slug);
  if (!gym || !gym.is_demo) throw new HttpError(404, 'That gym is not part of the demo.');
  const viewer = await getCurrentUser().catch(() => null);
  const scanner = { id: viewer?.id ?? null };

  if (typeof body.code === 'string') {
    if (!body.code.trim()) throw new HttpError(400, 'Type a pass code.');
    const look = await deskCheck(scanner, body.code, false);
    if ('gymId' in look && look.gymId !== gym.id) return { desk: { result: 'other_gym' as const, gym: look.gym } };
    return { desk: await deskCheck(scanner, body.code, true) };
  }

  const action = body.action;
  if (action !== 'in' && action !== 'out') throw new HttpError(400, 'That action is not available.');

  if (body.kind === 'guest') {
    const now = Date.now();
    const { day, visits } = await visitsToday(gym, null, now);
    const guest = visits.find((v) => v.kind === 'guest' && v.id === String(body.id));
    if (!guest) throw new HttpError(404, 'That guest is not on today\'s list.');
    if (action === 'in' && guest.in !== null) throw new HttpError(409, `${guest.name} is already checked in.`);
    if (action === 'out' && visitState(guest.in, guest.out, now) !== 'inside') throw new HttpError(409, `${guest.name} is not in the gym.`);
    const stamp = new Date(now).toISOString();
    await db()`
      INSERT INTO door_guest_actions (gym_id, day, guest_no, in_at, out_at)
      VALUES (${gym.id}::uuid, ${day.key}::date, ${Number(guest.id)}::int, ${action === 'in' ? stamp : null}::timestamptz, ${action === 'out' ? stamp : null}::timestamptz)
      ON CONFLICT (gym_id, day, guest_no) DO UPDATE SET
        in_at = coalesce(EXCLUDED.in_at, door_guest_actions.in_at), out_at = coalesce(EXCLUDED.out_at, door_guest_actions.out_at)`;
    // Saved actions are only for today's demo, so older ones are tidied away.
    await db()`DELETE FROM door_guest_actions WHERE day < current_date - 2`;
    return {};
  }

  if (body.kind === 'pass') {
    const id = String(body.id);
    if (!isUuid(id)) throw new HttpError(404, 'That pass was not found.');
    const [b] = await db()`
      SELECT b.code, b.user_id, u.is_demo FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE b.id = ${id}::uuid AND b.gym_id = ${gym.id}::uuid AND b.status = 'confirmed'`;
    if (!b || (!b.is_demo && b.user_id !== viewer?.id)) throw new HttpError(404, 'That pass was not found.');
    if (action === 'in') return { desk: await deskCheck(scanner, b.code as string, true) };
    if (!(await markCheckedOut(id))) throw new HttpError(409, 'That person is not in the gym.');
    return {};
  }

  throw new HttpError(400, 'That action is not available.');
}
