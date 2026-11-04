import { revalidatePath } from 'next/cache';
import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { addReview } from '@/lib/bookings';
import { getGymById } from '@/lib/gyms';

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Choose from 1 to 5 stars.');
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 800) : '';
  const gymId = await addReview(user, String(body.bookingId), stars, text || null);
  const gym = await getGymById(gymId);
  if (gym) revalidatePath(`/gyms/${gym.slug}`);
  return Response.json({ ok: true });
});
