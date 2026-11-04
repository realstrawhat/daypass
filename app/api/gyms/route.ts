import { handle, HttpError, readJson } from '@/lib/auth';
import { ensureCityHasGyms, geocodeCity, searchGyms, type Sort } from '@/lib/gyms';

const SORTS: Sort[] = ['recommended', 'nearest', 'price_asc', 'price_desc', 'rating'];
const num = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown, max: number) => {
  const n = num(v);
  return n === null ? null : Math.min(max, Math.max(0, Math.round(n)));
};

type Params = Record<string, unknown>;

async function run(p: Params) {
  let lat = num(p.lat);
  let lng = num(p.lng);
  let place: { name: string; country: string } | null = null;

  const city = typeof p.city === 'string' ? p.city : null;
  if (city) {
    let found;
    try {
      found = await geocodeCity(city);
    } catch {
      throw new HttpError(503, 'City search is unavailable right now. Try again in a moment.', 'geocoder');
    }
    if (!found) throw new HttpError(404, `No place called "${city.slice(0, 60)}" was found. Check the spelling or try a nearby city.`, 'no_place');
    await ensureCityHasGyms(found);
    lat = found.lat;
    lng = found.lng;
    place = { name: found.name, country: found.country };
  }
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(400, 'Share your location or type a city.');

  const bboxParts = typeof p.bbox === 'string' ? p.bbox.split(',').map(Number) : null;
  const bbox = bboxParts?.length === 4 && bboxParts.every(Number.isFinite) ? (bboxParts as [number, number, number, number]) : null;
  const equipment = typeof p.equipment === 'string' && p.equipment ? p.equipment.split('|').slice(0, 8) : [];

  const result = await searchGyms({
    lat,
    lng,
    bbox,
    sort: SORTS.includes(p.sort as Sort) ? (p.sort as Sort) : 'recommended',
    minRating: num(p.minRating),
    maxPriceCents: int(p.maxPrice, 100000),
    openNow: p.openNow === true || p.openNow === '1',
    equipment,
    page: int(p.page, 500) ?? 1,
  });
  return { ...result, center: { lat, lng }, place };
}

// City searches are the same for everyone, so the edge can answer them instantly.
export const GET = handle(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const body = await run(params);
  const isCity = !!params.city && !params.bbox;
  return Response.json(body, { headers: { 'Cache-Control': isCity ? 'public, s-maxage=30, stale-while-revalidate=300' : 'private, no-store' } });
});

// Coordinates travel in the body, never the URL, so request logs can't record them.
// They are used for this one response and are not stored.
export const POST = handle(async (req) => {
  const body = await run(await readJson(req));
  return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
});
