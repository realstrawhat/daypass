import { handle, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Marks everything read when the inbox opens.
export const POST = handle(async () => {
  const user = await requireUser();
  await db()`UPDATE messages SET read_at = now() WHERE user_id = ${user.id}::uuid AND read_at IS NULL`;
  return Response.json({ ok: true });
});
