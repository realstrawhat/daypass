import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { payHold } from '@/lib/bookings';
import { db } from '@/lib/db';
import { PAY_METHODS, type PayMethod } from '@/lib/payments';

export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const method = body.method as PayMethod;
  if (!PAY_METHODS.includes(method)) throw new HttpError(400, 'Choose a way to pay.');
  const { booking } = await payHold(user.id, id, method);
  if (body.saveCard && method !== 'demo-decline') {
    const card = JSON.stringify(method === 'demo-wallet' ? { brand: 'Demo wallet', last4: '' } : { brand: 'Demo card', last4: '4242' });
    await db()`UPDATE users SET saved_card = ${card}::jsonb WHERE id = ${user.id}::uuid`;
  }
  return Response.json({ booking: { id: booking.id, status: booking.status } });
});
