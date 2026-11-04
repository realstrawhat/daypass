import { destroySession, handle, HttpError, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

const SORTS = ['recommended', 'nearest', 'price_asc', 'price_desc', 'rating'];

export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const body = await req.json();
  const sort = SORTS.includes(body.default_sort) ? body.default_sort : user.default_sort;
  const city = typeof body.home_city === 'string' ? body.home_city.trim().slice(0, 80) || null : user.home_city;
  const maxPrice = body.max_price_cents === null ? null : Number.isFinite(Number(body.max_price_cents)) ? Math.round(Number(body.max_price_cents)) : user.max_price_cents;
  const card = body.remove_card ? null : user.saved_card;
  await db()`UPDATE users SET default_sort = ${sort}, home_city = ${city}, max_price_cents = ${maxPrice}::int, saved_card = ${card ? JSON.stringify(card) : null}::jsonb WHERE id = ${user.id}::uuid`;
  return Response.json({ ok: true });
});

// Records a deletion request. The account is erased within 30 days and the user is logged out now.
export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  await db()`UPDATE users SET deletion_requested_at = now() WHERE id = ${user.id}::uuid`;
  await db()`DELETE FROM sessions WHERE user_id = ${user.id}::uuid`;
  await destroySession();
  return Response.json({ ok: true });
});
