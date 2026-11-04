import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { GYM_SELECT_RATING } from '@/lib/gyms';

export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await db().query(
    `SELECT g.id, g.slug, g.name, g.city, g.price_cents, g.photos, g.timezone, g.open_hour, g.close_hour, g.weekend_open_hour, g.weekend_close_hour,
      ${GYM_SELECT_RATING}
    FROM saved_gyms s JOIN gyms g ON g.id = s.gym_id
    WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 20`,
    [user.id],
  );
  return Response.json({ gyms: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const { gymId, saved } = await readJson(req);
  if (typeof gymId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gymId)) throw new HttpError(400, 'That gym could not be saved.');
  if (saved) await db()`INSERT INTO saved_gyms (user_id, gym_id) SELECT ${user.id}::uuid, id FROM gyms WHERE id = ${gymId}::uuid ON CONFLICT DO NOTHING`;
  else await db()`DELETE FROM saved_gyms WHERE user_id = ${user.id}::uuid AND gym_id = ${gymId}::uuid`;
  return Response.json({ ok: true });
});
