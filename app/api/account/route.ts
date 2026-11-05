import { destroySession, handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { eraseUser } from '@/lib/bookings';
import { db } from '@/lib/db';

const SORTS = ['recommended', 'nearest', 'price_asc', 'price_desc', 'rating'];

export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const sort = SORTS.includes(body.default_sort) ? body.default_sort : user.default_sort;
  const city = typeof body.home_city === 'string' ? body.home_city.trim().slice(0, 80) || null : user.home_city;
  const asked = Number(body.max_price_cents);
  const maxPrice = body.max_price_cents === null || body.max_price_cents === '' ? null : Number.isFinite(asked) && asked >= 100 && asked <= 20000 ? Math.round(asked) : user.max_price_cents;
  const card = body.remove_card ? null : user.saved_card;
  await db()`UPDATE users SET default_sort = ${sort}, home_city = ${city}, max_price_cents = ${maxPrice}::int, saved_card = ${card ? JSON.stringify(card) : null}::jsonb WHERE id = ${user.id}::uuid`;
  return Response.json({ ok: true });
});

// Erases the account at once, which meets the 30 days the build pack allows, and logs it out.
export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  await eraseUser(user.id);
  await destroySession();
  return Response.json({ ok: true });
});
