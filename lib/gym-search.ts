import { HttpError } from './auth';
import { ensureCityHasGyms, geocodeCity, searchGyms, type Sort } from './gyms';

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

// One gym search, for the API and for the first view of Find. `seed: false` leaves an empty city empty, so a plain
// page load, a crawler's included, never adds sample gyms. The browser's own search still does.
export async function findGyms(p: Record<string, unknown>, opts: { seed?: boolean } = {}) {
  let lat = num(p.lat);
  let lng = num(p.lng);
  let place: { name: string; country: string } | null = null;

  const city = typeof p.city === 'string' ? p.city : null;
  if (city) {
    let found;
    try {
      found = await geocodeCity(city, typeof p.country === 'string' ? p.country : null);
    } catch {
      throw new HttpError(503, 'City search is unavailable right now. Try again in a moment.', 'geocoder');
    }
    if (!found) throw new HttpError(404, `No place called "${city.slice(0, 60)}" was found. Check the spelling or try a nearby city.`, 'no_place');
    if (opts.seed !== false) await ensureCityHasGyms(found);
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
