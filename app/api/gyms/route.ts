import { handle, HttpError } from '@/lib/auth';
import { ensureCityHasGyms, geocodeCity, searchGyms, type Sort } from '@/lib/gyms';

const SORTS: Sort[] = ['recommended', 'nearest', 'price_asc', 'price_desc', 'rating'];
const num = (v: string | null) => {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Coordinates are used for this one response. They are not stored or logged.
export const GET = handle(async (req) => {
  const q = new URL(req.url).searchParams;
  let lat = num(q.get('lat'));
  let lng = num(q.get('lng'));
  let place: { name: string; country: string } | null = null;

  const city = q.get('city');
  if (city) {
    const found = await geocodeCity(city);
    if (!found) throw new HttpError(404, `No place called "${city.slice(0, 60)}" was found. Check the spelling or try a nearby city.`, 'no_place');
    await ensureCityHasGyms(found);
    lat = found.lat;
    lng = found.lng;
    place = { name: found.name, country: found.country };
  }
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(400, 'Share your location or type a city.');

  const sortParam = q.get('sort') as Sort;
  const bboxParts = q.get('bbox')?.split(',').map(Number);
  const bbox = bboxParts?.length === 4 && bboxParts.every(Number.isFinite) ? (bboxParts as [number, number, number, number]) : null;

  const result = await searchGyms({
    lat,
    lng,
    bbox,
    sort: SORTS.includes(sortParam) ? sortParam : 'recommended',
    minRating: num(q.get('minRating')),
    maxPriceCents: num(q.get('maxPrice')),
    page: num(q.get('page')) ?? 1,
  });

  return Response.json(
    { ...result, center: { lat, lng }, place },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
});
