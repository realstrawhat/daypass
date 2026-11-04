import { handle, HttpError } from '@/lib/auth';
import { getAvailability, getGymById } from '@/lib/gyms';

export const GET = handle(async (_req, ctx) => {
  const { id } = await ctx.params;
  const gym = await getGymById(id);
  if (!gym) throw new HttpError(404, 'This gym is no longer listed.');
  return Response.json({ days: await getAvailability(gym), gym: { id: gym.id, name: gym.name, price_cents: gym.price_cents, timezone: gym.timezone } }, { headers: { 'Cache-Control': 'no-store' } });
});
