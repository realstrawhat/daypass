import { handle, HttpError, readJson, requireUser } from '@/lib/auth';
import { deskCheck } from '@/lib/bookings';

// The reception check: looks a pass up, and checks it in when it's valid.
export const POST = handle(async (req) => {
  await requireUser();
  const { code, apply } = await readJson(req);
  if (typeof code !== 'string' || !code.trim()) throw new HttpError(400, 'Enter or scan a pass code.');
  return Response.json(await deskCheck(code, apply !== false));
});
