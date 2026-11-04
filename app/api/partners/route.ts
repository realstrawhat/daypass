import { handle, HttpError, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { geocodeCity } from '@/lib/gyms';

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const price = (v: unknown) => {
  const n = Math.round(Number(v) * 100);
  if (!Number.isFinite(n) || n < 100 || n > 20000) throw new HttpError(400, 'Set a day pass price between €1 and €200.');
  return n;
};

// A gym lists itself and sets its own price.
export const POST = handle(async (req) => {
  const user = await requireUser();
  const b = await req.json();
  const name = String(b.name ?? '').trim().slice(0, 60);
  const address = String(b.address ?? '').trim().slice(0, 140);
  const city = String(b.city ?? '').trim();
  if (!name) throw new HttpError(400, 'Enter the gym name.');
  if (!address) throw new HttpError(400, 'Enter the street address.');
  const place = await geocodeCity(city);
  if (!place) throw new HttpError(400, 'Enter a city we can find on the map.');
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && b.lat !== '' && b.lng !== '';
  const equipment = String(b.equipment ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const slug = `${slugify(name)}-${slugify(place.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const rows = await db()`
    INSERT INTO gyms (slug, name, city, country, timezone, address, lat, lng, price_cents, equipment, description, is_demo, owner_user_id, capacity)
    VALUES (${slug}, ${name}, ${place.name}, ${place.country}, ${place.timezone}, ${address}, ${hasPin ? lat : place.lat}, ${hasPin ? lng : place.lng}, ${price(b.price)},
      ${equipment}, ${String(b.description ?? '').trim().slice(0, 400)}, false, ${user.id}::uuid, ${Math.min(50, Math.max(1, Number(b.capacity) || 4))}::int)
    RETURNING slug`;
  return Response.json({ slug: rows[0].slug });
});

// Update the price or confirm details, which restarts the 90-day check.
export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const b = await req.json();
  const id = String(b.id ?? '');
  const rows = await db()`
    UPDATE gyms SET price_cents = ${price(b.price)}, confirmed_at = now()
    WHERE id = ${id}::uuid AND owner_user_id = ${user.id}::uuid RETURNING id`;
  if (!rows[0]) throw new HttpError(404, 'Gym not found on your account.');
  return Response.json({ ok: true });
});
