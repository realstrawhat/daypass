import { handle } from '@/lib/auth';
import { suggestPlaces } from '@/lib/gyms';

// City suggestions while typing.
export const GET = handle(async (req) => {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const places = await suggestPlaces(q, 5).catch(() => []);
  return Response.json(
    { places: places.map((p) => ({ name: p.name, country: p.country, admin: p.admin })) },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
  );
});
