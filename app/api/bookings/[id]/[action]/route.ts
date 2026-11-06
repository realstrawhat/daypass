import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { addToWallet, checkOut, refuseEntryRefund, simulateCheckIn, undoCheckOut } from '@/lib/bookings';

// Pass actions: add to the demo Wallet, the simulated desk scan, leaving the gym, and refused entry.
export const POST = handle(async (req, ctx) => {
  const user = await requireUser();
  const { id, action } = await ctx.params;
  if (action === 'wallet') {
    await addToWallet(user.id, id);
    return Response.json({ ok: true });
  }
  if (action === 'checkin') {
    const b = await simulateCheckIn(user, id);
    return Response.json({ checked_in_at: b.checked_in_at });
  }
  if (action === 'exit') {
    const b = await checkOut(user.id, id);
    return Response.json({ checked_out_at: b.checked_out_at });
  }
  if (action === 'exit-undo') {
    await undoCheckOut(user.id, id);
    return Response.json({ ok: true });
  }
  if (action === 'refused') {
    const body = await readJson(req);
    const b = await refuseEntryRefund(user, id, String(body.reason ?? ''));
    return Response.json({ refund_cents: b.refund_cents });
  }
  throw new HttpError(404, 'Not found.');
});
