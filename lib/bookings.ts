import { randomBytes } from 'node:crypto';
import { db } from './db';
import { HttpError } from './auth';
import { getGymById, isValidSlot, releaseExpiredHolds, type Gym } from './gyms';
import { charge, type PayMethod } from './payments';

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
  is_sample: boolean;
  updated_at: string;
  created_at: string;
};

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';

const commission = (gym: Gym, price: number) => Math.round((price * gym.commission_bps) / 10000);

// Step one of checkout: hold a spot for ten minutes. A hold is never shown as a booking.
export async function createHold(userId: string, gymId: string, startsAtIso: string, key: string) {
  if (!key || key.length > 80) throw new HttpError(400, 'Missing request key. Reload and try again.');
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
    throw new HttpError(409, 'You already booked this time. Find it in My bookings.', 'already_booked');
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
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Booking not found.');
  const rows = await db()`SELECT * FROM bookings WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  return rows[0] as Booking;
}

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
    await db()`
      WITH failed AS (
        UPDATE bookings SET status = 'failed', hold_expires_at = NULL, updated_at = now()
        WHERE id = ${id}::uuid AND status = 'hold' RETURNING id, gym_id, starts_at, price_cents
      ), freed AS (
        UPDATE slots s SET booked = greatest(s.booked - 1, 0) FROM failed f
        WHERE s.gym_id = f.gym_id AND s.starts_at = f.starts_at RETURNING 1
      )
      INSERT INTO payments (booking_id, kind, status, amount_cents, method, idempotency_key)
      SELECT f.id, 'charge', 'declined', f.price_cents, ${method}, 'decline:' || f.id FROM failed f
      ON CONFLICT (idempotency_key) DO NOTHING`;
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
  if (rows[0]) return { booking: rows[0] as Booking, replayed: false };
  return { booking: await getOwned(userId, id), replayed: true };
}

const LATE_MESSAGE = 'This visit is less than 24 hours away, so changes are no longer possible.';

// Move a booking to a new time, optionally at another gym. One atomic statement:
// take the new spot, update the booking, free the old spot and record any price difference.
export async function changeBooking(userId: string, id: string, input: { startsAt: string; gymId?: string; method?: PayMethod }) {
  const b = await getOwned(userId, id);
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only confirmed bookings can be changed.', 'not_confirmed');
  if (new Date(b.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000) throw new HttpError(409, LATE_MESSAGE, 'too_late');

  const gym = await getGymById(input.gymId ?? b.gym_id);
  if (!gym) throw new HttpError(404, 'This gym is no longer listed.');
  const startsAt = new Date(input.startsAt);
  if (!isValidSlot(gym, startsAt)) throw new HttpError(409, 'That time is not available. Pick another slot.', 'slot_invalid');
  const iso = startsAt.toISOString();
  if (gym.id === b.gym_id && iso === new Date(b.starts_at).toISOString()) throw new HttpError(400, 'Pick a different time from your current booking.', 'same_slot');

  const difference = gym.price_cents - b.price_cents;
  // Never charge a difference the person was not shown and did not approve.
  if (difference > 0 && !input.method) throw new HttpError(409, `This gym's price is now ${(gym.price_cents / 100).toFixed(2)} euros, so a difference is due. Reload to review it.`, 'price_changed');
  const method: PayMethod = input.method ?? 'demo-card';
  if (difference > 0) {
    const res = await charge({ method, amountCents: difference });
    if (res.status === 'declined') throw new HttpError(402, 'Payment declined. Your booking stays as it was.', 'declined');
  }
  const refund = difference < 0 ? -difference : 0;
  const paymentKind = difference > 0 ? 'adjustment' : difference < 0 ? 'refund' : null;
  const version = b.confirmation_version + 1;

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
    if (rows[0]) return { booking: rows[0] as Booking, difference, refund };
  } catch (e) {
    if (isUnique(e)) throw new HttpError(409, 'You already have a booking at that gym and time.', 'already_booked');
    throw e;
  }

  const now = await getOwned(userId, id);
  if (now.confirmation_version !== b.confirmation_version) throw new HttpError(409, 'This booking was just changed elsewhere. Reload to see the latest.', 'stale');
  if (new Date(now.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000) throw new HttpError(409, LATE_MESSAGE, 'too_late');
  throw new HttpError(409, 'Someone just took the last spot at that time. Pick another slot.', 'slot_full');
}

export async function cancelBooking(userId: string, id: string) {
  const b = await getOwned(userId, id);
  if (b.status === 'cancelled') return b;
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only confirmed bookings can be cancelled.', 'not_confirmed');
  if (new Date(b.starts_at).getTime() - Date.now() <= 24 * 3600 * 1000) throw new HttpError(409, LATE_MESSAGE, 'too_late');
  const rows = await db()`
    WITH done AS (
      UPDATE bookings SET status = 'cancelled', refund_cents = refund_cents + price_cents,
        confirmation_version = confirmation_version + 1, updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'confirmed' AND starts_at > now() + interval '24 hours'
      RETURNING *
    ), freed AS (
      UPDATE slots s SET booked = greatest(s.booked - 1, 0) FROM done d
      WHERE s.gym_id = d.gym_id AND s.starts_at = d.starts_at RETURNING 1
    ), refunded AS (
      INSERT INTO payments (booking_id, kind, status, amount_cents, method, idempotency_key)
      SELECT d.id, 'refund', 'succeeded', d.price_cents, 'demo-card', 'cancel:' || d.id FROM done d
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING 1
    )
    SELECT * FROM done`;
  if (rows[0]) return rows[0] as Booking;
  const now = await getOwned(userId, id);
  if (now.status === 'cancelled') return now;
  throw new HttpError(409, LATE_MESSAGE, 'too_late');
}

export type BookingView = Booking & {
  gym_name: string;
  gym_slug: string;
  gym_city: string;
  gym_address: string;
  gym_lat: number;
  gym_lng: number;
  gym_timezone: string;
  gym_photos: string[];
  review_stars: number | null;
  previous_gym_name: string | null;
};

const VIEW = `
  SELECT b.*, g.name AS gym_name, g.slug AS gym_slug, g.city AS gym_city, g.address AS gym_address,
    g.lat AS gym_lat, g.lng AS gym_lng, g.timezone AS gym_timezone, g.photos AS gym_photos,
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
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db().query(`${VIEW} WHERE b.user_id = $1 AND b.id = $2 AND b.status IN ('confirmed','cancelled')`, [userId, id]);
  return (rows[0] as BookingView) ?? null;
}

// Gives a new account one finished visit, so past bookings and rating can be tried straight away.
export async function addSamplePastVisit(userId: string) {
  await db()`
    INSERT INTO bookings (code, user_id, gym_id, starts_at, price_cents, commission_cents, status, idempotency_key, is_sample)
    SELECT ${newCode()}, ${userId}::uuid, g.id, date_trunc('hour', now()) - interval '9 days', g.price_cents, round(g.price_cents * g.commission_bps / 10000.0)::int,
      'confirmed', 'sample-past-visit', true
    FROM gyms g WHERE g.slug = 'iron-gym-amsterdam'
    ON CONFLICT DO NOTHING`;
}

export async function addReview(userId: string, bookingId: string, stars: number, body: string | null) {
  const b = await getOwned(userId, bookingId);
  if (b.status !== 'confirmed') throw new HttpError(409, 'Only completed visits can be rated.');
  if (new Date(b.starts_at).getTime() > Date.now()) throw new HttpError(409, 'You can rate this gym after your visit.');
  await db()`
    INSERT INTO reviews (booking_id, user_id, gym_id, stars, body)
    VALUES (${bookingId}::uuid, ${userId}::uuid, ${b.gym_id}::uuid, ${stars}::int, ${body})
    ON CONFLICT (booking_id) DO UPDATE SET stars = EXCLUDED.stars, body = EXCLUDED.body`;
}
