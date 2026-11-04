import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { addToWallet, refuseEntryRefund, simulateCheckIn } from '@/lib/bookings';

// Pass actions: add to the demo Wallet, the simulated desk scan, and refused entry.
export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  const { id, action } = await ctx.params;
  if (action === 'wallet') {
    await addToWallet(user.id, id);
    return Response.json({ ok: true });
  }
  if (action === 'checkin') {
    const b = await simulateCheckIn(user.id, id);
    return Response.json({ checked_in_at: b.checked_in_at });
  }
  if (action === 'refused') {
    const body = await readJson(req);
    const b = await refuseEntryRefund(user, id, String(body.reason ?? ''));
    return Response.json({ refund_cents: b.refund_cents });
  }
  throw new HttpError(404, 'Not found.');
});
