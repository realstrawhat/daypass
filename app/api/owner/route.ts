import { getCurrentUser, handle, HttpError, readJson } from '@/lib/auth';
import { ownerAct, ownerSnapshot, requireOwner } from '@/lib/owner';

const noStore = { headers: { 'Cache-Control': 'private, no-store' } };
const viewerId = async () => (await getCurrentUser().catch(() => null))?.id ?? null;

// The owner panel's live data, which the screen asks for every few seconds.
export const GET = handle(async (req) => {
  await requireOwner();
  const gym = new URL(req.url).searchParams.get('gym');
  if (!gym) throw new HttpError(400, 'Pick a gym.');
  return Response.json(await ownerSnapshot(gym, await viewerId()), noStore);
});

// Checking someone in or out returns the fresh picture, so the screen never shows the old one.
export const POST = handle(async (req) => {
  await requireOwner();
  const body = await readJson(req);
  if (typeof body.gym !== 'string') throw new HttpError(400, 'Pick a gym.');
  const { desk } = await ownerAct(body.gym, body);
  return Response.json({ desk: desk ?? null, snapshot: await ownerSnapshot(body.gym, await viewerId()) }, noStore);
});
