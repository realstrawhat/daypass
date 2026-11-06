import { getCurrentUser, handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { deskCheck } from '@/lib/bookings';
import { ownerSignedIn } from '@/lib/owner';

// The reception check: looks a pass up, and checks it in or out. An admin can check any pass, with or without an account.
export const POST = handle(async (req) => {
  const admin = await ownerSignedIn();
  const user = admin ? await getCurrentUser().catch(() => null) : await requireUser();
  const { code, apply } = await readJson(req);
  if (typeof code !== 'string' || !code.trim()) throw new HttpError(400, 'Enter or scan a pass code.');
  return Response.json(await deskCheck({ id: user?.id ?? null, admin }, code, apply !== false));
});
