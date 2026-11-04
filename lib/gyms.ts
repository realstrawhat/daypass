import { db } from './db';
import { seedCity } from '../scripts/seed-data.mjs';

export type Gym = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  address: string;
  lat: number;
  lng: number;
  price_cents: number;
  photos: string[];
  equipment: string[];
  description: string;
  open_hour: number;
  close_hour: number;
  weekend_open_hour: number;
  weekend_close_hour: number;
  capacity: number;
  is_demo: boolean;
  confirmed_at: string;
  commission_bps: number;
  owner_user_id: string | null;
  rating: number;
  rating_count: number;
  distance_km?: number | null;
};

export type Sort = 'recommended' | 'nearest' | 'price_asc' | 'price_desc' | 'rating';
export const PAGE_SIZE = 20;

export type SearchInput = {
  lat: number;
  lng: number;
  radiusKm?: number;
  bbox?: [number, number, number, number] | null; // south, west, north, east
  sort?: Sort;
  minRating?: number | null;
  maxPriceCents?: number | null;
  page?: number;
};

export async function searchGyms(input: SearchInput) {
  const { lat, lng, sort = 'recommended', minRating = null, maxPriceCents = null, page = 1 } = input;
  const radius = input.radiusKm ?? 25;
  const dLat = radius / 111;
  const dLng = radius / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const [south, west, north, east] = input.bbox ?? [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;

  const rows = await db()`
    WITH nearby AS (
      SELECT g.*,
        6371 * 2 * asin(sqrt(power(sin(radians(g.lat - ${lat}::float8) / 2), 2)
          + cos(radians(${lat}::float8)) * cos(radians(g.lat)) * power(sin(radians(g.lng - ${lng}::float8) / 2), 2))) AS distance_km
      FROM gyms g
      WHERE g.lat BETWEEN ${south}::float8 AND ${north}::float8
        AND g.lng BETWEEN ${west}::float8 AND ${east}::float8
    ),
    rated AS (
      SELECT n.*,
        (SELECT round(((n.seed_rating * n.seed_rating_count + coalesce(sum(r.stars), 0)) / nullif(n.seed_rating_count + count(r.id), 0))::numeric, 1)
           FROM reviews r WHERE r.gym_id = n.id) AS rating,
        (SELECT n.seed_rating_count + count(r.id) FROM reviews r WHERE r.gym_id = n.id)::int AS rating_count
      FROM nearby n
    ),
    filtered AS (
      SELECT * FROM rated
      WHERE (${minRating}::numeric IS NULL OR rating >= ${minRating}::numeric)
        AND (${maxPriceCents}::int IS NULL OR price_cents <= ${maxPriceCents}::int)
    )
    SELECT id, slug, name, city, country, timezone, address, lat, lng, price_cents, photos, equipment, description,
      open_hour, close_hour, weekend_open_hour, weekend_close_hour, capacity, is_demo, confirmed_at, commission_bps, owner_user_id,
      rating::float8 AS rating, rating_count, distance_km, count(*) OVER()::int AS total
    FROM filtered
    ORDER BY
      CASE WHEN ${sort}::text = 'nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN ${sort}::text = 'price_asc' THEN price_cents END ASC NULLS LAST,
      CASE WHEN ${sort}::text = 'price_desc' THEN price_cents END DESC NULLS LAST,
      CASE WHEN ${sort}::text = 'rating' THEN rating END DESC NULLS LAST,
      CASE WHEN ${sort}::text = 'recommended' THEN
        (coalesce(rating, 4.0) / 5.0) * 0.5 + (1 - least(distance_km / 10.0, 1)) * 0.3 + (1 - least(price_cents / 2500.0, 1)) * 0.2 END DESC NULLS LAST,
      distance_km ASC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

  const total = rows[0] ? (rows[0].total as number) : 0;
  return { gyms: rows as unknown as Gym[], total, page: Math.max(1, page), pageSize: PAGE_SIZE };
}

const GYM_SELECT_RATING = `
  (SELECT round(((g.seed_rating * g.seed_rating_count + coalesce(sum(r.stars), 0)) / nullif(g.seed_rating_count + count(r.id), 0))::numeric, 1)::float8 FROM reviews r WHERE r.gym_id = g.id) AS rating,
  (SELECT g.seed_rating_count + count(r.id) FROM reviews r WHERE r.gym_id = g.id)::int AS rating_count`;

export async function getGymBySlug(slug: string): Promise<Gym | null> {
  const rows = await db().query(`SELECT g.*, ${GYM_SELECT_RATING} FROM gyms g WHERE g.slug = $1`, [slug]);
  return (rows[0] as Gym) ?? null;
}

export async function getGymById(id: string): Promise<Gym | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db().query(`SELECT g.*, ${GYM_SELECT_RATING} FROM gyms g WHERE g.id = $1`, [id]);
  return (rows[0] as Gym) ?? null;
}

export async function getReviews(gymId: string) {
  const rows = await db()`
    SELECT author, stars, body, created_at FROM (
      SELECT u.name AS author, r.stars, r.body, r.created_at
      FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.gym_id = ${gymId}::uuid
      UNION ALL
      SELECT s.author, s.stars, s.body, now() - make_interval(days => s.days_ago) FROM seed_reviews s WHERE s.gym_id = ${gymId}::uuid
    ) x ORDER BY created_at DESC LIMIT 12`;
  return rows as { author: string; stars: number; body: string | null; created_at: string }[];
}

// Time zones ---------------------------------------------------------------

function tzOffsetMs(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(utcMs));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) - utcMs;
}

export function localToUtc(y: number, m: number, d: number, h: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h);
  const first = guess - tzOffsetMs(guess, tz);
  return new Date(guess - tzOffsetMs(first, tz));
}

function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }).formatToParts(date);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { y: Number(v('year')), m: Number(v('month')), d: Number(v('day')), h: Number(v('hour')), min: Number(v('minute')), weekday: v('weekday') };
}

const isWeekend = (weekday: string) => weekday === 'Sat' || weekday === 'Sun';

// Some slots are held back by the gym (classes, maintenance). Stable per gym and hour.
function heldByGym(gymId: string, utcIso: string) {
  let h = 7;
  const s = gymId + utcIso;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h % 7 === 0;
}

export const BOOKING_DAYS = 21;

export function isValidSlot(gym: Gym, startsAt: Date) {
  if (Number.isNaN(startsAt.getTime())) return false;
  const now = Date.now();
  if (startsAt.getTime() <= now) return false;
  if (startsAt.getTime() > now + (BOOKING_DAYS + 1) * 86400000) return false;
  const p = localParts(startsAt, gym.timezone);
  if (p.min !== 0) return false;
  const open = isWeekend(p.weekday) ? gym.weekend_open_hour : gym.open_hour;
  const close = isWeekend(p.weekday) ? gym.weekend_close_hour : gym.close_hour;
  if (p.h < open || p.h >= close) return false;
  return !heldByGym(gym.id, startsAt.toISOString());
}

export type SlotDay = {
  date: string;
  weekday: string;
  day: number;
  month: string;
  free: number;
  total: number;
  slots: { startsAt: string; label: string; spots: number }[];
};

// Abandoned checkouts give their spot back after ten minutes.
export async function releaseExpiredHolds() {
  await db()`
    WITH exp AS (
      UPDATE bookings SET status = 'expired', updated_at = now()
      WHERE status = 'hold' AND hold_expires_at < now()
      RETURNING gym_id, starts_at
    ), grouped AS (
      SELECT gym_id, starts_at, count(*)::int AS c FROM exp GROUP BY gym_id, starts_at
    )
    UPDATE slots s SET booked = greatest(s.booked - g.c, 0)
    FROM grouped g WHERE s.gym_id = g.gym_id AND s.starts_at = g.starts_at`;
}

export async function getAvailability(gym: Gym): Promise<SlotDay[]> {
  await releaseExpiredHolds();
  const now = new Date();
  const until = new Date(now.getTime() + (BOOKING_DAYS + 1) * 86400000);
  const rows = await db()`SELECT starts_at, capacity, booked FROM slots WHERE gym_id = ${gym.id}::uuid AND starts_at BETWEEN ${now.toISOString()}::timestamptz AND ${until.toISOString()}::timestamptz`;
  const booked = new Map(rows.map((r) => [new Date(r.starts_at as string).toISOString(), Math.max(0, (r.capacity as number) - (r.booked as number))]));
  const today = localParts(now, gym.timezone);
  const days: SlotDay[] = [];
  for (let i = 0; i < BOOKING_DAYS; i++) {
    const anchor = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12));
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth() + 1;
    const d = anchor.getUTCDate();
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(anchor);
    const open = isWeekend(weekday) ? gym.weekend_open_hour : gym.open_hour;
    const close = isWeekend(weekday) ? gym.weekend_close_hour : gym.close_hour;
    const slots: SlotDay['slots'] = [];
    let total = 0;
    for (let h = open; h < close; h++) {
      const at = localToUtc(y, m, d, h, gym.timezone);
      if (at.getTime() <= now.getTime()) continue;
      total++;
      const iso = at.toISOString();
      if (heldByGym(gym.id, iso)) continue;
      const spots = booked.has(iso) ? (booked.get(iso) as number) : gym.capacity;
      if (spots > 0) slots.push({ startsAt: iso, label: `${String(h).padStart(2, '0')}:00`, spots });
    }
    days.push({
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      weekday,
      day: d,
      month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(anchor),
      free: slots.length,
      total,
      slots,
    });
  }
  return days;
}

// Typed city search -----------------------------------------------------------

export type Place = { name: string; country: string; lat: number; lng: number; timezone: string };

export async function geocodeCity(query: string): Promise<Place | null> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return null;
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { name: string; country?: string; latitude: number; longitude: number; timezone?: string }[] };
  const hit = data.results?.[0];
  if (!hit) return null;
  return { name: hit.name, country: hit.country ?? '', lat: hit.latitude, lng: hit.longitude, timezone: hit.timezone ?? 'UTC' };
}

// Sample listings let a tester search any city. They are flagged as demo data.
export async function ensureCityHasGyms(place: Place) {
  const [{ n }] = (await db()`
    SELECT count(*)::int AS n FROM gyms
    WHERE lat BETWEEN ${place.lat - 0.25}::float8 AND ${place.lat + 0.25}::float8
      AND lng BETWEEN ${place.lng - 0.35}::float8 AND ${place.lng + 0.35}::float8`) as { n: number }[];
  if (n === 0) await seedCity(db(), place);
}
