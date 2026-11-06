import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { HttpError, verifyPassword } from './auth';
import { deskCheck, markCheckedOut } from './bookings';
import { db } from './db';
import { isUuid, shortName } from './format';
import { getGymBySlug } from './gyms';
import { DOOR_CLOSES_HOURS, MAX_STAY_HOURS, visitState } from './hours';

// The admin password for the front desk panel, as a hash like every other password here.
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

const ms = (v: unknown) => (v ? new Date(v as string).getTime() : null);
const HOUR = 3600000;
const SHOW_LOG = 40;
const SHOW_ARRIVING = 8;

// Real bookings and real scans only, for one gym or all of them. Nothing is made up, so a gym with no scans shows
// zero. "Today" follows each gym's own clock, and someone still inside after midnight still counts as inside.
export async function ownerSnapshot(slug: string | null) {
  const gym = slug ? await getGymBySlug(slug) : null;
  if (slug && !gym) throw new HttpError(404, 'That gym was not found.');
  const rows = await db()`
    SELECT b.id, b.code, b.starts_at, b.checked_in_at, b.checked_out_at, b.price_cents, b.commission_cents, u.name AS holder,
      g.name AS gym_name, g.city AS gym_city, g.timezone,
      (b.checked_in_at AT TIME ZONE g.timezone)::date = (now() AT TIME ZONE g.timezone)::date AS in_today,
      (b.starts_at AT TIME ZONE g.timezone)::date = (now() AT TIME ZONE g.timezone)::date AS starts_today,
      extract(hour FROM b.checked_in_at AT TIME ZONE g.timezone)::int AS in_hour
    FROM bookings b JOIN users u ON u.id = b.user_id JOIN gyms g ON g.id = b.gym_id
    WHERE b.status = 'confirmed' AND NOT b.is_sample AND (${gym?.id ?? null}::uuid IS NULL OR b.gym_id = ${gym?.id ?? null}::uuid)
      AND ((b.checked_in_at AT TIME ZONE g.timezone)::date = (now() AT TIME ZONE g.timezone)::date
        OR (b.starts_at AT TIME ZONE g.timezone)::date = (now() AT TIME ZONE g.timezone)::date
        OR (b.checked_in_at > now() - make_interval(hours => ${MAX_STAY_HOURS}::int) AND b.checked_out_at IS NULL))`;

  const now = Date.now();
  const visits = rows.map((b) => ({
    id: b.id as string,
    name: shortName(b.holder as string),
    code: b.code as string,
    gym: `${b.gym_name as string}, ${b.gym_city as string}`,
    tz: b.timezone as string,
    planned: ms(b.starts_at) as number,
    in: ms(b.checked_in_at),
    out: ms(b.checked_out_at),
    price: b.price_cents as number,
    commission: b.commission_cents as number,
    inToday: !!b.in_today,
    startsToday: !!b.starts_today,
    inHour: b.in_hour as number | null,
  }));

  const entered = visits.filter((v) => v.in !== null && v.inToday);
  const left = entered.filter((v) => v.out !== null);
  const inside = visits.filter((v) => visitState(v.in, v.out, now) === 'inside').sort((a, b) => (b.in as number) - (a.in as number));
  const arriving = visits
    .filter((v) => v.in === null && v.startsToday && v.planned + DOOR_CLOSES_HOURS * HOUR >= now)
    .sort((a, b) => a.planned - b.planned)
    .slice(0, SHOW_ARRIVING);

  const gross = entered.reduce((sum, v) => sum + v.price, 0);
  const hours = Array.from({ length: 24 }, () => 0);
  for (const v of entered) if (v.inHour !== null) hours[v.inHour] += 1;
  const latest = entered.reduce<(typeof entered)[number] | null>((a, v) => (!a || (v.in as number) > (a.in as number) ? v : a), null);

  const log = [
    ...entered.map((v) => ({ key: `${v.id}-in`, type: 'in' as const, at: v.in as number, name: v.name, code: v.code, gym: v.gym, tz: v.tz, stay: null as number | null })),
    ...left.map((v) => ({ key: `${v.id}-out`, type: 'out' as const, at: v.out as number, name: v.name, code: v.code, gym: v.gym, tz: v.tz, stay: (v.out as number) - (v.in as number) })),
  ].sort((a, b) => b.at - a.at);

  return {
    now,
    gym: gym ? { slug: gym.slug, name: gym.name, city: gym.city, timezone: gym.timezone } : null,
    stats: {
      inside: inside.length,
      entries: entered.length,
      exits: left.length,
      averageStay: left.length ? left.reduce((sum, v) => sum + ((v.out as number) - (v.in as number)), 0) / left.length : null,
      gross,
      keep: gross - entered.reduce((sum, v) => sum + v.commission, 0),
    },
    hours,
    latestHour: latest?.inHour ?? null,
    inside,
    arriving,
    log: log.slice(0, SHOW_LOG),
    logTotal: log.length,
  };
}

export type OwnerSnapshot = Awaited<ReturnType<typeof ownerSnapshot>>;

// What an admin can do at the door: scan or type any pass, or check someone in or out by name.
// The door rules still apply, so an old or cancelled pass is refused.
export async function ownerAct(slug: string | null, body: Record<string, unknown>) {
  const gym = slug ? await getGymBySlug(slug) : null;
  if (slug && !gym) throw new HttpError(404, 'That gym was not found.');
  const scanner = { id: null, admin: true };

  if (typeof body.code === 'string') {
    if (!body.code.trim()) throw new HttpError(400, 'Type a pass code.');
    // With one gym chosen, the desk is at that gym. With all gyms chosen, any pass can be checked.
    const look = await deskCheck(scanner, body.code, false);
    if (gym && 'gymId' in look && look.gymId !== gym.id) return { desk: { result: 'other_gym' as const, gym: look.gym } };
    return { desk: await deskCheck(scanner, body.code, true) };
  }

  const { action } = body;
  if (action !== 'in' && action !== 'out') throw new HttpError(400, 'That action is not available.');
  const id = String(body.id);
  if (!isUuid(id)) throw new HttpError(404, 'That pass was not found.');
  const [b] = await db()`SELECT code FROM bookings WHERE id = ${id}::uuid AND status = 'confirmed'`;
  if (!b) throw new HttpError(404, 'That pass was not found.');
  if (action === 'in') return { desk: await deskCheck(scanner, b.code as string, true) };
  if (!(await markCheckedOut(id))) throw new HttpError(409, 'That person is not in the gym.');
  return {};
}
