import { handle, HttpError, requireUser } from '@/lib/auth';
import { addReview } from '@/lib/bookings';

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await req.json();
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Choose from 1 to 5 stars.');
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 800) : '';
  await addReview(user.id, String(body.bookingId), stars, text || null);
  return Response.json({ ok: true });
});
