import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

const MAX_NOTE = 500;

const realDay = (day: unknown): day is string => {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
};

// One note per calendar day. Saving an empty note removes it.
export const PUT = handle(async (req) => {
  const user = await requireUser();
  const { day, body } = await readJson(req);
  if (!realDay(day)) throw new HttpError(400, 'That date is not valid.');
  if (typeof body !== 'string') throw new HttpError(400, 'That note could not be read.');
  const text = body.trim();
  if (text.length > MAX_NOTE) throw new HttpError(400, `Keep notes to ${MAX_NOTE} characters.`);
  if (!text) {
    await db()`DELETE FROM day_notes WHERE user_id = ${user.id}::uuid AND day = ${day}::date`;
    return Response.json({ body: '' });
  }
  await db()`
    INSERT INTO day_notes (user_id, day, body) VALUES (${user.id}::uuid, ${day}::date, ${text})
    ON CONFLICT (user_id, day) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`;
  return Response.json({ body: text });
});
