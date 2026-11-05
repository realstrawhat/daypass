import { randomBytes, randomUUID } from 'node:crypto';
import { db } from './db';
import { hashPassword, HttpError, type User } from './auth';
import { getAvailability, getGymById, getGymBySlug, isValidSlot, releaseExpiredHolds, type Gym, type GymFacts } from './gyms';
import { dateLabel, isUuid, money, timeLabel } from './format';
import { hoursUntil, refusalIsOpen, sameLocalDay } from './hours';
import { charge, methodLabel, type PayMethod } from './payments';

const HOLD_MINUTES = 10;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const newCode = () => {
  const b = randomBytes(5);
  return 'DP-' + Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
};

export type Booking = {
  id: string;
  code: string;
  user_id: string;
  gym_id: string;
  starts_at: string;
  price_cents: number;
  commission_cents: number;
  status: 'hold' | 'confirmed' | 'cancelled' | 'failed' | 'expired';
  hold_expires_at: string | null;
  previous_starts_at: string | null;
  previous_gym_id: string | null;
  confirmation_version: number;
  refund_cents: number;
  refund_reason: string | null;
  is_sample: boolean;
  checked_in_at: string | null;
  wallet_added_at: string | null;
  updated_at: string;
  created_at: string;
};

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';

// The inbox stands in for email and push. A failed message never breaks the booking it follows.
export async function addMessage(userId: string, kind: string, title: string, body: string, bookingId?: string) {
  try {
    await db()`
      INSERT INTO messages (user_id, booking_id, kind, title, body)
      VALUES (${userId}::uuid, ${bookingId ?? null}::uuid, ${kind}, ${title}, ${body})
      ON CONFLICT DO NOTHING`;
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'message failed');
  }
}

const commission = (gym: Gym, price: number) => Math.round((price * gym.commission_bps) / 10000);

// Step one of checkout: hold a spot for ten minutes. A hold is never shown as a booking.
export async function createHold(userId: string, gymId: string, startsAtIso: string, key: string) {
  if (!key || key === 'undefined' || key.length > 80) throw new HttpError(400, 'Missing request key. Reload and try again.');
  const gym = await getGymById(gymId);
  if (!gym) throw new HttpError(404, 'This gym is no longer listed.');
  const startsAt = new Date(startsAtIso);
  if (!isValidSlot(gym, startsAt)) throw new HttpError(409, 'That time is not available. Pick another slot.', 'slot_invalid');

  await releaseExpiredHolds();

  const iso = startsAt.toISOString();
  const prior = await db()`SELECT * FROM bookings WHERE user_id = ${userId}::uuid AND idempotency_key = ${key}`;
  if (prior[0]) {
    const sameSlot = prior[0].gym_id === gymId && new Date(prior[0].starts_at as string).toISOString() === iso;
    if (sameSlot && (prior[0].status === 'hold' || prior[0].status === 'confirmed')) return { booking: prior[0] as Booking, gym };
    throw new HttpError(409, 'That checkout has ended. Pick your slot again.', 'hold_ended');
  }

  const same = await db()`SELECT * FROM bookings WHERE user_id = ${userId}::uuid AND gym_id = ${gymId}::uuid AND starts_at = ${iso}::timestamptz AND status IN ('hold','confirmed')`;
  if (same[0]) {
    if (same[0].status === 'hold') return { booking: same[0] as Booking, gym };
    throw new HttpError(409, 'You already booked this time. Find it in Passes.', 'already_booked');
  }

  try {
    const rows = await db()`
      WITH reserved AS (
        INSERT INTO slots (gym_id, starts_at, capacity, booked)
        VALUES (${gymId}::uuid, ${iso}::timestamptz, ${gym.capacity}::int, 1)
        ON CONFLICT (gym_id, starts_at) DO UPDATE SET booked = slots.booked + 1
        WHERE slots.booked < slots.capacity
        RETURNING 1
      )
      INSERT INTO bookings (code, user_id, gym_id, starts_at, price_cents, commission_cents, status, idempotency_key, hold_expires_at)
      SELECT ${newCode()}, ${userId}::uuid, ${gymId}::uuid, ${iso}::timestamptz, ${gym.price_cents}::int, ${commission(gym, gym.price_cents)}::int,
        'hold', ${key}, now() + make_interval(mins => ${HOLD_MINUTES}::int)
      FROM reserved
      RETURNING *`;
    if (!rows[0]) throw new HttpError(409, 'Someone just took the last spot at that time. Pick another slot.', 'slot_full');
    return { booking: rows[0] as Booking, gym };
  } catch (e) {
    if (isUnique(e)) {
      const again = await db()`SELECT * FROM bookings WHERE user_id = ${userId}::uuid AND (idempotency_key = ${key} OR (gym_id = ${gymId}::uuid AND starts_at = ${iso}::timestamptz AND status IN ('hold','confirmed')))`;
      if (again[0]) return { booking: again[0] as Booking, gym };
    }
    throw e;
  }
}

async function getOwned(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, 'Booking not found.');
  const rows = await db()`SELECT * FROM bookings WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  return rows[0] as Booking;
}

// Called after money or a check-in has already gone through, so a failed lookup must not fail the action.
const gymLabel = async (gymId: string) => {
  const gym = await getGymById(gymId).catch(() => null);
  return { name: gym?.name ?? 'your gym', tz: gym?.timezone ?? 'UTC' };
};

// Step two: pay. The booking becomes confirmed only when the charge succeeds.
export async function payHold(userId: string, id: string, method: PayMethod) {
  const b = await getOwned(userId, id);
  if (b.status === 'confirmed') return { booking: b, replayed: true };
  if (b.status !== 'hold') throw new HttpError(409, 'This checkout has ended. Pick your slot again.', 'hold_ended');
  if (b.hold_expires_at && new Date(b.hold_expires_at).getTime() < Date.now()) {
    await releaseExpiredHolds();
    throw new HttpError(409, 'Your ten-minute hold ran out. Pick your slot again.', 'hold_expired');
  }

  const result = await charge({ method, amountCents: b.price_cents });

  if (result.status === 'declined') {
    const failed = await db()`
      WITH failed AS (
        UPDATE bookings SET status = 'failed', hold_expires_at = NULL, updated_at = now()
        WHERE id = ${id}::uuid AND status = 'hold' RETURNING id, gym_id, starts_at, price_cents
      ), freed AS (
        UPDATE slots s SET booked = greatest(s.booked - 1, 0) FROM failed f
        WHERE s.gym_id = f.gym_id AND s.starts_at = f.starts_at RETURNING 1
      ), logged AS (
        INSERT INTO payments (booking_id, kind, status, amount_cents, method, idempotency_key)
        SELECT f.id, 'charge', 'declined', f.price_cents, ${method}, 'decline:' || f.id FROM failed f
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING 1
      )
      SELECT id FROM failed`;
    if (!failed[0]) {
      // Another request paid first, so report what really happened.
      const now = await getOwned(userId, id);
      if (now.status === 'confirmed') return { booking: now, replayed: true };
    }
    throw new HttpError(402, 'Payment declined. You were not charged and no booking was made.', 'declined');
  }

  const rows = await db()`
    WITH done AS (
      UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL, updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'hold'
      RETURNING *
    ), paid AS (
      INSERT INTO payments (booking_id, kind, status, amount_cents, method, idempotency_key)
      SELECT d.id, 'charge', 'succeeded', d.price_cents, ${method}, 'charge:' || d.id FROM done d
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING 1
    )
    SELECT * FROM done`;
  if (rows[0]) {
    const booking = rows[0] as Booking;
    const { name, tz } = await gymLabel(booking.gym_id);
    await addMessage(userId, 'confirmation', `Your pass for ${name} is ready`, `${dateLabel(booking.starts_at, tz)} at ${timeLabel(booking.starts_at, tz)}. Paid ${money(booking.price_cents)} with ${methodLabel(method)}. Code ${booking.code}.`, booking.id);
    return { booking, replayed: false };
  }
  const now = await getOwned(userId, id);
  if (now.status !== 'confirmed') throw new HttpError(409, 'Your ten-minute hold ran out. You were not charged. Pick your slot again.', 'hold_expired');
  return { booking: now, replayed: true };
}

const LATE_MESSAGE = 'This visit is less than 24 hours away, so changes are no longer possible.';
const STALE_MESSAGE = 'This booking was just changed elsewhere. Reload to see the latest.';

// Move a booking to a new time, optionally at another gym. One atomic statement:
// take the new spot, update the booking, free the old spot and record any price difference.
export async function changeBooking(userId: string, id: string, input: { startsAt: string; gymId?: string; method?: PayMethod; version?: number }) {
  const b = await getOwned(userId, id);
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only confirmed bookings can be changed.', 'not_confirmed');
  if (b.checked_in_at) throw new HttpError(409, 'You have already checked in for this visit.', 'checked_in');
  // The person chose this from an older screen, such as a second device, so it must not replace a newer change.
  if (input.version != null && input.version !== b.confirmation_version) throw new HttpError(409, STALE_MESSAGE, 'stale');
  if (new Date(b.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000) throw new HttpError(409, LATE_MESSAGE, 'too_late');

  const gym = await getGymById(input.gymId ?? b.gym_id);
  if (!gym) throw new HttpError(404, 'This gym is no longer listed.');
  const startsAt = new Date(input.startsAt);
  if (!isValidSlot(gym, startsAt)) throw new HttpError(409, 'That time is not available. Pick another slot.', 'slot_invalid');
  const iso = startsAt.toISOString();
  if (gym.id === b.gym_id && iso === new Date(b.starts_at).toISOString()) throw new HttpError(400, 'Pick a different time from your current booking.', 'same_slot');

  const difference = gym.price_cents - b.price_cents;
  // Never charge a difference the person was not shown and did not approve.
  if (difference > 0 && !input.method) throw new HttpError(409, `This gym's price is now ${money(gym.price_cents)}, so a difference is due. Reload to review it.`, 'price_changed');
  const method: PayMethod = input.method ?? 'demo-card';
  if (difference > 0) {
    const res = await charge({ method, amountCents: difference });
    if (res.status === 'declined') throw new HttpError(402, 'Payment declined. Your booking stays as it was.', 'declined');
  }
  const refund = difference < 0 ? -difference : 0;
  const paymentKind = difference > 0 ? 'adjustment' : difference < 0 ? 'refund' : null;
  const version = b.confirmation_version + 1;

  await releaseExpiredHolds();
  try {
    const rows = await db()`
      WITH cur AS (
        SELECT * FROM bookings
        WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'confirmed'
          AND confirmation_version = ${b.confirmation_version}::int
          AND starts_at > now() + interval '24 hours'
        FOR UPDATE
      ), reserved AS (
        INSERT INTO slots (gym_id, starts_at, capacity, booked)
        SELECT ${gym.id}::uuid, ${iso}::timestamptz, ${gym.capacity}::int, 1 FROM cur
        ON CONFLICT (gym_id, starts_at) DO UPDATE SET booked = slots.booked + 1
        WHERE slots.booked < slots.capacity
        RETURNING 1
      ), moved AS (
        UPDATE bookings x SET
          starts_at = ${iso}::timestamptz, gym_id = ${gym.id}::uuid,
          price_cents = ${gym.price_cents}::int, commission_cents = ${commission(gym, gym.price_cents)}::int,
          previous_starts_at = cur.starts_at, previous_gym_id = cur.gym_id,
          confirmation_version = ${version}::int, refund_cents = x.refund_cents + ${refund}::int, updated_at = now()
        FROM cur WHERE x.id = cur.id AND EXISTS (SELECT 1 FROM reserved)
        RETURNING x.*
      ), freed AS (
        UPDATE slots s SET booked = greatest(s.booked - 1, 0) FROM cur
        WHERE EXISTS (SELECT 1 FROM moved) AND s.gym_id = cur.gym_id AND s.starts_at = cur.starts_at
        RETURNING 1
      ), paid AS (
        INSERT INTO payments (booking_id, kind, status, amount_cents, method, idempotency_key)
        SELECT m.id, ${paymentKind}::text, 'succeeded', ${Math.abs(difference)}::int, ${method}, ${`change:${id}:${version}`}
        FROM moved m WHERE ${paymentKind}::text IS NOT NULL
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING 1
      )
      SELECT * FROM moved`;
    if (rows[0]) {
      const booking = rows[0] as Booking;
      const extra = difference > 0 ? ` You paid ${money(difference)} more.` : refund > 0 ? ` ${money(refund)} refunded.` : '';
      await addMessage(userId, 'change', `Booking updated: ${gym.name}`, `Now ${dateLabel(iso, gym.timezone)} at ${timeLabel(iso, gym.timezone)}.${extra} Confirmation ${version}.`, id);
      return { booking, difference, refund };
    }
  } catch (e) {
    if (isUnique(e)) throw new HttpError(409, 'You already have a booking at that gym and time.', 'already_booked');
    throw e;
  }

  const now = await getOwned(userId, id);
  if (now.confirmation_version !== b.confirmation_version) throw new HttpError(409, STALE_MESSAGE, 'stale');
  if (new Date(now.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000) throw new HttpError(409, LATE_MESSAGE, 'too_late');
  throw new HttpError(409, 'Someone just took the last spot at that time. Pick another slot.', 'slot_full');
}

async function refundBooking(userId: string, id: string, reason: string, conditionHours: number | null) {
  const rows = await db()`
    WITH done AS (
      UPDATE bookings SET status = 'cancelled', refund_cents = refund_cents + price_cents, refund_reason = ${reason},
        confirmation_version = confirmation_version + 1, updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'confirmed' AND checked_in_at IS NULL
        AND (${conditionHours}::int IS NULL OR starts_at > now() + make_interval(hours => ${conditionHours ?? 0}::int))
      RETURNING *
    ), freed AS (
      UPDATE slots s SET booked = greatest(s.booked - 1, 0) FROM done d
      WHERE s.gym_id = d.gym_id AND s.starts_at = d.starts_at AND s.starts_at > now() RETURNING 1
    ), refunded AS (
      INSERT INTO payments (booking_id, kind, status, amount_cents, method, idempotency_key)
      SELECT d.id, 'refund', 'succeeded', d.price_cents, 'demo-card', 'cancel:' || d.id FROM done d
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING 1
    )
    SELECT * FROM done`;
  return (rows[0] as Booking) ?? null;
}

export async function cancelBooking(userId: string, id: string) {
  const b = await getOwned(userId, id);
  if (b.status === 'cancelled') return b;
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only confirmed bookings can be cancelled.', 'not_confirmed');
  if (b.checked_in_at) throw new HttpError(409, 'You have already checked in for this visit.', 'checked_in');
  if (new Date(b.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000) throw new HttpError(409, LATE_MESSAGE, 'too_late');
  const done = await refundBooking(userId, id, 'cancelled', 24);
  if (done) {
    const { name } = await gymLabel(done.gym_id);
    await addMessage(userId, 'refund', `Booking cancelled: ${name}`, `${money(done.price_cents)} is on its way back to your demo card.`, id);
    return done;
  }
  const now = await getOwned(userId, id);
  if (now.status === 'cancelled') return now;
  throw new HttpError(409, LATE_MESSAGE, 'too_late');
}

// The promise that sets Daypass apart: if the gym won't let you in, you get your money back.
export async function refuseEntryRefund(user: User, id: string, detail: string) {
  const b = await getOwned(user.id, id);
  if (b.status !== 'confirmed') throw new HttpError(409, 'This booking is not active, so there is nothing to refund.', 'not_confirmed');
  if (b.checked_in_at) throw new HttpError(409, 'This pass has already been used at the desk.', 'checked_in');
  const { tz } = await gymLabel(b.gym_id);
  if (!user.is_demo && !refusalIsOpen(b.starts_at, tz)) {
    if (hoursUntil(b.starts_at) > 0) throw new HttpError(409, 'This is for problems at the door, so it opens on the day of your session.', 'too_early');
    throw new HttpError(409, 'This session ended too long ago to claim a refund here.', 'too_late');
  }
  const done = await refundBooking(user.id, id, detail.slice(0, 120) || 'entry refused', null);
  if (!done) throw new HttpError(409, 'This booking is not active, so there is nothing to refund.', 'not_confirmed');
  const { name } = await gymLabel(done.gym_id);
  await addMessage(user.id, 'refund', `Refund sent: ${name}`, `Sorry you couldn't get in. We refunded ${money(done.price_cents)} to your demo card.`, id);
  return done;
}

export type DeskResult = 'valid' | 'used' | 'expired' | 'too_early' | 'wrong_date' | 'cancelled' | 'unknown';

// What reception sees. Valid only from an hour before the session until three hours after it starts.
// This is a demo with no staff accounts, so a real person's pass can only be scanned from their own account.
// Demo passes can be scanned from any account, so two phones can act out the door.
export async function deskCheck(scanner: User, code: string, apply: boolean) {
  const clean = code.trim().toUpperCase().replace(/^DAYPASS:/, '');
  const rows = await db()`
    SELECT b.*, g.name AS gym_name, g.timezone AS gym_timezone, u.name AS holder, u.is_demo AS holder_is_demo
    FROM bookings b JOIN gyms g ON g.id = b.gym_id JOIN users u ON u.id = b.user_id
    WHERE b.code = ${clean} AND b.status IN ('confirmed','cancelled')`;
  const b = rows[0] as (Booking & { gym_name: string; gym_timezone: string; holder: string; holder_is_demo: boolean }) | undefined;
  if (!b || (b.user_id !== scanner.id && !b.holder_is_demo)) return { result: 'unknown' as DeskResult };
  const detail = { gym: b.gym_name, holder: b.holder, when: `${dateLabel(b.starts_at, b.gym_timezone)}, ${timeLabel(b.starts_at, b.gym_timezone)}`, code: b.code };
  if (b.status === 'cancelled') return { result: 'cancelled' as DeskResult, ...detail };
  if (b.checked_in_at) return { result: 'used' as DeskResult, ...detail, usedAt: timeLabel(b.checked_in_at, b.gym_timezone) };
  // Demo passes skip the time window, so the door can be tried at any time.
  if (!b.holder_is_demo) {
    const hours = hoursUntil(b.starts_at);
    if (hours > 1) return { result: (sameLocalDay(new Date(b.starts_at), new Date(), b.gym_timezone) ? 'too_early' : 'wrong_date') as DeskResult, ...detail };
    if (hours < -3) return { result: 'expired' as DeskResult, ...detail };
  }
  // Two scans at once, or a cancel in between: only one can win, and the other is told what happened.
  if (apply && !(await markCheckedIn(b.id, b.user_id))) {
    const [now] = await db()`SELECT status, checked_in_at FROM bookings WHERE id = ${b.id}::uuid`;
    if (!now) return { result: 'unknown' as DeskResult };
    if (now.status === 'cancelled') return { result: 'cancelled' as DeskResult, ...detail };
    return { result: 'used' as DeskResult, ...detail, usedAt: now.checked_in_at ? timeLabel(now.checked_in_at as string, b.gym_timezone) : undefined };
  }
  return { result: 'valid' as DeskResult, ...detail };
}

async function markCheckedIn(id: string, userId: string) {
  const rows = await db()`UPDATE bookings SET checked_in_at = now(), updated_at = now() WHERE id = ${id}::uuid AND status = 'confirmed' AND checked_in_at IS NULL RETURNING gym_id`;
  if (rows[0]) {
    const { name } = await gymLabel(rows[0].gym_id as string);
    await addMessage(userId, 'checkin', `Checked in at ${name}`, 'Enjoy your session. We will ask how it went afterwards.', id);
  }
  return !!rows[0];
}

// The owner's own simulated desk scan. Demo accounts can try it any time. A real account can use it only
// around its session, so nobody can use up a pass weeks ahead or post a rating without visiting.
export async function simulateCheckIn(user: User, id: string) {
  const b = await getOwned(user.id, id);
  if (b.status !== 'confirmed') throw new HttpError(409, 'This pass is not active.', 'not_confirmed');
  if (!user.is_demo && !b.checked_in_at) {
    const hours = hoursUntil(b.starts_at);
    if (hours > 1) throw new HttpError(409, 'Check-in opens one hour before your session.', 'too_early');
    if (hours < -3) throw new HttpError(409, 'This session has ended, so the pass can no longer be checked in.', 'too_late');
  }
  // A cancel can land in between. The person must not be told they are checked in.
  if (!b.checked_in_at && !(await markCheckedIn(id, user.id))) {
    const [now] = await db()`SELECT status FROM bookings WHERE id = ${id}::uuid`;
    if (now?.status !== 'confirmed') throw new HttpError(409, 'This pass is not active.', 'not_confirmed');
  }
  return getOwned(user.id, id);
}

export async function addToWallet(userId: string, id: string) {
  const b = await getOwned(userId, id);
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only active passes can go in your wallet.', 'not_confirmed');
  await db()`UPDATE bookings SET wallet_added_at = coalesce(wallet_added_at, now()) WHERE id = ${id}::uuid`;
}

// Whether a pass can still get someone in, which is what the Wallet holds.
export const inWalletNow = (b: { wallet_added_at?: string | null; status: string; checked_in_at: string | null; starts_at: string }, now = Date.now()) =>
  !!b.wallet_added_at && b.status === 'confirmed' && !b.checked_in_at && new Date(b.starts_at).getTime() + 3 * 3600000 > now;

export type BookingView = Booking & {
  gym_name: string;
  gym_slug: string;
  gym_city: string;
  gym_address: string;
  gym_lat: number;
  gym_lng: number;
  gym_timezone: string;
  gym_photos: string[];
  gym_facts: GymFacts;
  review_stars: number | null;
  previous_gym_name: string | null;
};

const VIEW = `
  SELECT b.*, g.name AS gym_name, g.slug AS gym_slug, g.city AS gym_city, g.address AS gym_address,
    g.lat AS gym_lat, g.lng AS gym_lng, g.timezone AS gym_timezone, g.photos AS gym_photos, g.facts AS gym_facts,
    r.stars AS review_stars, pg.name AS previous_gym_name
  FROM bookings b
  JOIN gyms g ON g.id = b.gym_id
  LEFT JOIN gyms pg ON pg.id = b.previous_gym_id
  LEFT JOIN reviews r ON r.booking_id = b.id`;

export async function listBookings(userId: string) {
  const rows = await db().query(`${VIEW} WHERE b.user_id = $1 AND b.status IN ('confirmed','cancelled') ORDER BY b.starts_at DESC`, [userId]);
  return rows as BookingView[];
}

export async function getBookingView(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const rows = await db().query(`${VIEW} WHERE b.user_id = $1 AND b.id = $2 AND b.status IN ('confirmed','cancelled')`, [userId, id]);
  return (rows[0] as BookingView) ?? null;
}

// Gives a new account one finished visit, so past bookings and rating can be tried straight away.
export async function addSamplePastVisit(userId: string, area: string | null = null) {
  await db()`
    INSERT INTO bookings (code, user_id, gym_id, starts_at, price_cents, commission_cents, status, idempotency_key, is_sample, checked_in_at)
    SELECT ${newCode()}, ${userId}::uuid, g.id, date_trunc('hour', now()) - interval '9 days', g.price_cents, round(g.price_cents * g.commission_bps / 10000.0)::int,
      'confirmed', 'sample-past-visit', true, date_trunc('hour', now()) - interval '9 days'
    FROM gyms g WHERE g.slug = coalesce((SELECT slug FROM gyms WHERE is_demo AND lower(city) = lower(${area}::text) ORDER BY name = 'Iron Gym' DESC LIMIT 1), 'iron-gym-amsterdam')
    ON CONFLICT DO NOTHING`;
}

export async function addReview(user: User, bookingId: string, stars: number, body: string | null) {
  const b = await getOwned(user.id, bookingId);
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only completed visits can be rated.');
  if (!b.checked_in_at && new Date(b.starts_at).getTime() > Date.now()) throw new HttpError(409, 'You can rate this gym after your visit.');
  // Sample visits and demo accounts can try rating, without changing a gym's public score.
  const isPublic = !b.is_sample && !user.is_demo;
  await db()`
    INSERT INTO reviews (booking_id, user_id, gym_id, stars, body, is_public)
    VALUES (${bookingId}::uuid, ${user.id}::uuid, ${b.gym_id}::uuid, ${stars}::int, ${body}, ${isPublic})
    ON CONFLICT (booking_id) DO UPDATE SET stars = EXCLUDED.stars, body = EXCLUDED.body`;
  return b.gym_id;
}

// The subtle demo login. Every tap makes a new throwaway account with a lived-in history,
// so it can never reach anyone's real account.
export async function createDemoUser(area: string | null = null) {
  await db()`
    WITH old AS (SELECT id FROM users WHERE is_demo AND created_at < now() - interval '14 days'),
    live AS (
      SELECT b.gym_id, b.starts_at, count(*)::int AS c FROM bookings b JOIN old ON old.id = b.user_id
      WHERE b.status IN ('hold','confirmed') AND b.starts_at > now() GROUP BY b.gym_id, b.starts_at
    ), freed AS (
      UPDATE slots s SET booked = greatest(s.booked - l.c, 0) FROM live l
      WHERE s.gym_id = l.gym_id AND s.starts_at = l.starts_at RETURNING 1
    )
    DELETE FROM users u USING old WHERE u.id = old.id`;

  const hash = await hashPassword(randomBytes(24).toString('hex'));
  const email = `demo-${randomUUID()}@demo.daypass.invalid`;
  const [user] = await db()`
    INSERT INTO users (email, name, password_hash, is_demo, saved_card)
    VALUES (${email}, 'Sam Demo', ${hash}, true, ${JSON.stringify({ brand: 'Demo card', last4: '4242' })}::jsonb)
    RETURNING id`;
  const userId = user.id as string;

  // A short training history across cities, for the visit grid and Passes.
  const history = [
    ['iron-gym-amsterdam', 6], ['iron-gym-berlin', 13], ['iron-gym-lisbon', 19], ['iron-gym-paris', 34],
    ['iron-gym-amsterdam', 41], ['iron-gym-prague', 58], ['iron-gym-barcelona', 77], ['iron-gym-vienna', 96],
  ] as const;
  for (const [i, [slug, days]] of history.entries()) {
    // Believable training times, mostly after work.
    const hour = [17, 7, 18, 16, 6, 17, 8, 18][i];
    await db()`
      INSERT INTO bookings (code, user_id, gym_id, starts_at, price_cents, commission_cents, status, idempotency_key, is_sample, checked_in_at)
      SELECT ${newCode()}, ${userId}::uuid, g.id, date_trunc('day', now()) + make_interval(hours => ${hour}::int) - make_interval(days => ${days}::int),
        g.price_cents, round(g.price_cents * g.commission_bps / 10000.0)::int, 'confirmed', ${`sample-${i}`}, true,
        date_trunc('day', now()) + make_interval(hours => ${hour}::int) - make_interval(days => ${days}::int)
      FROM gyms g WHERE g.slug = ${slug}`;
  }
  await addMessage(userId, 'welcome', 'Welcome to Daypass', 'This is a demo account with sample visits. Payments, email, Face ID and Wallet are simulated, so try anything.');

  // One upcoming pass, booked through the real rules.
  try {
    const [local] = area ? await db()`SELECT slug FROM gyms WHERE lower(city) = lower(${area}) AND is_demo ORDER BY name = 'Iron Gym' DESC LIMIT 1` : [];
    const gym = await getGymBySlug((local?.slug as string) ?? 'iron-gym-amsterdam');
    if (gym) {
      const days = await getAvailability(gym);
      const later = days.slice(3).flatMap((d) => d.slots).find((s) => Number(s.label.slice(0, 2)) >= 9);
      if (later) {
        const { booking } = await createHold(userId, gym.id, later.startsAt, `demo-${randomUUID()}`);
        await payHold(userId, booking.id, 'demo-card');
      }
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'demo booking failed');
  }
  return userId;
}
