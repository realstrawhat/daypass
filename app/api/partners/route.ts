import { revalidatePath } from 'next/cache';
import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { geocodeCity } from '@/lib/gyms';

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const price = (v: unknown) => {
  const n = Math.round(Number(v) * 100);
  if (!Number.isFinite(n) || n < 100 || n > 20000) throw new HttpError(400, 'Set a day pass price between €1 and €200.');
  return n;
};

const DEFAULT_FACTS = { stay: 'Stay up to 2 hours', entry: 'Show your pass code at reception', towel: 'Bring your own towel', lock: 'Bring a padlock for the lockers', shower: 'Showers available', water: 'Water bottles for sale', age: '16 and over', access: 'Ask the gym about step-free access', staffedUntil: 20 };

// A gym lists itself and sets its own price.
export const POST = handle(async (req) => {
  const user = await requireUser();
  const b = await readJson(req);
  const name = String(b.name ?? '').trim().slice(0, 60);
  const address = String(b.address ?? '').trim().slice(0, 140);
  const city = String(b.city ?? '').trim();
  if (!name) throw new HttpError(400, 'Enter the gym name.');
  if (!address) throw new HttpError(400, 'Enter the street address.');
  const place = await geocodeCity(city).catch(() => null);
  if (!place) throw new HttpError(400, 'Enter a city we can find on the map.');

  // A pin must be real coordinates, near the chosen city.
  const hasPin = String(b.lat ?? '').trim() !== '' && String(b.lng ?? '').trim() !== '';
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (hasPin && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat - place.lat) > 0.6 || Math.abs(lng - place.lng) > 0.9)) {
    throw new HttpError(400, `Those coordinates are not near ${place.name}. Check them, or leave them empty.`);
  }

  const equipment = String(b.equipment ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const capacity = Math.min(50, Math.max(1, Math.round(Number(b.capacity)) || 4));
  const slug = `${slugify(name)}-${slugify(place.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const rows = await db()`
    INSERT INTO gyms (slug, name, city, country, timezone, address, lat, lng, price_cents, equipment, description, is_demo, owner_user_id, capacity, facts)
    VALUES (${slug}, ${name}, ${place.name}, ${place.country}, ${place.timezone}, ${address}, ${hasPin ? lat : place.lat}, ${hasPin ? lng : place.lng}, ${price(b.price)},
      ${equipment}, ${String(b.description ?? '').trim().slice(0, 400)}, false, ${user.id}::uuid, ${capacity}::int, ${JSON.stringify(DEFAULT_FACTS)}::jsonb)
    RETURNING slug`;
  return Response.json({ slug: rows[0].slug });
});

// Update the price or confirm details, which restarts the 90-day check.
export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const b = await readJson(req);
  const id = String(b.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Gym not found on your account.');
  const rows = await db()`
    UPDATE gyms SET price_cents = ${price(b.price)}, confirmed_at = now()
    WHERE id = ${id}::uuid AND owner_user_id = ${user.id}::uuid RETURNING slug`;
  if (!rows[0]) throw new HttpError(404, 'Gym not found on your account.');
  revalidatePath(`/gyms/${rows[0].slug as string}`);
  return Response.json({ ok: true });
});
