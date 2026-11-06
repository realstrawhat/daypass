import { handle, HttpError, readJson } from '@/lib/auth';
import { ownerAct, ownerSnapshot, requireOwner } from '@/lib/owner';

const noStore = { headers: { 'Cache-Control': 'private, no-store' } };

// The panel's live data, which the screen asks for every few seconds. No gym named means all gyms.
export const GET = handle(async (req) => {
  await requireOwner();
  return Response.json(await ownerSnapshot(new URL(req.url).searchParams.get('gym')), noStore);
});

// Checking someone in or out returns the fresh picture, so the screen never shows the old one.
export const POST = handle(async (req) => {
  await requireOwner();
  const body = await readJson(req);
  if (body.gym != null && typeof body.gym !== 'string') throw new HttpError(400, 'Pick a gym.');
  const gym = body.gym ?? null;
  const { desk } = await ownerAct(gym, body);
  return Response.json({ desk: desk ?? null, snapshot: await ownerSnapshot(gym) }, noStore);
});
