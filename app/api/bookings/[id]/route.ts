import { handle, HttpError, requireUser } from '@/lib/auth';
import { cancelBooking, changeBooking } from '@/lib/bookings';
import { PAY_METHODS, type PayMethod } from '@/lib/payments';

// Change a booking: new time, and optionally a different gym.
export const PATCH = handle(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();
  const method = body.method as PayMethod | undefined;
  if (method && !PAY_METHODS.includes(method)) throw new HttpError(400, 'Choose a way to pay.');
  const { booking, difference, refund } = await changeBooking(user.id, id, { startsAt: String(body.startsAt), gymId: body.gymId ? String(body.gymId) : undefined, method });
  return Response.json({ booking: { id: booking.id, starts_at: booking.starts_at, confirmation_version: booking.confirmation_version }, difference, refund });
});

export const DELETE = handle(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const booking = await cancelBooking(user.id, id);
  return Response.json({ booking: { id: booking.id, status: booking.status, refund_cents: booking.refund_cents } });
});
