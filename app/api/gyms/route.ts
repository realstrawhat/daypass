import { handle, readJson } from '@/lib/auth';
import { findGyms } from '@/lib/gym-search';

// City searches are the same for everyone, so the edge can answer them instantly.
export const GET = handle(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const body = await findGyms(params);
  const isCity = !!params.city && !params.bbox;
  return Response.json(body, { headers: { 'Cache-Control': isCity ? 'public, s-maxage=30, stale-while-revalidate=300' : 'private, no-store' } });
});

// Coordinates travel in the body, never the URL, so request logs can't record them.
// They are used for this one response and are not stored.
export const POST = handle(async (req) => {
  const body = await findGyms(await readJson(req));
  return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
});
