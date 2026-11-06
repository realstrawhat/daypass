import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { cancelBooking, changeBooking, visitStatus } from '@/lib/bookings';
import { PAY_METHODS, type PayMethod } from '@/lib/payments';

// Whether this pass has been scanned in or out.
export const GET = handle(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return Response.json(await visitStatus(user.id, id), { headers: { 'Cache-Control': 'private, no-store' } });
});

// Change a booking: new time, and optionally a different gym.
export const PATCH = handle(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const method = body.method as PayMethod | undefined;
  if (method && !PAY_METHODS.includes(method)) throw new HttpError(400, 'Choose a way to pay.');
  const version = Number.isInteger(body.version) ? Number(body.version) : undefined;
  const { booking, difference, refund } = await changeBooking(user.id, id, { startsAt: String(body.startsAt), gymId: body.gymId ? String(body.gymId) : undefined, method, version });
  return Response.json({ booking: { id: booking.id, starts_at: booking.starts_at, confirmation_version: booking.confirmation_version }, difference, refund });
});

export const DELETE = handle(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const booking = await cancelBooking(user.id, id);
  return Response.json({ booking: { id: booking.id, status: booking.status, refund_cents: booking.refund_cents } });
});
