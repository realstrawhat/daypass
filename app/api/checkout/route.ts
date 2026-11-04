import { handle, readJson, requireUser } from '@/lib/auth';
import { createHold } from '@/lib/bookings';

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const { booking, gym } = await createHold(user.id, String(body.gymId), String(body.startsAt), String(body.key));
  return Response.json({ booking: { id: booking.id, status: booking.status, price_cents: booking.price_cents, hold_expires_at: booking.hold_expires_at }, gym: { name: gym.name } });
});
