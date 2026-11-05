// Coordinates stay in memory on this device for the current visit and are never saved.
// The only thing remembered is that the person said yes, so the app doesn't ask again.
export type Coords = { lat: number; lng: number };

const ALLOWED = 'daypass-location-ok';
let lastCoords: Coords | null = null;
let resolvedCity: string | null = null;

export const getLastCoords = () => lastCoords;
export const getResolvedCity = () => resolvedCity;
export const setResolvedCity = (city: string | null) => {
  resolvedCity = city;
};

function remember(ok: boolean) {
  try {
    if (ok) localStorage.setItem(ALLOWED, '1');
    else localStorage.removeItem(ALLOWED);
  } catch {}
}

export function locate(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share your location. Type a city instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lastCoords = { lat: p.coords.latitude, lng: p.coords.longitude };
        remember(true);
        resolve(lastCoords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) remember(false);
        reject(new Error('Location is off. Type a city instead.'));
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

// True when location can be used without showing a prompt.
export async function locationAllowed(): Promise<boolean> {
  try {
    const state = (await navigator.permissions?.query({ name: 'geolocation' }))?.state;
    if (state === 'granted') return true;
    if (state === 'denied') {
      remember(false);
      return false;
    }
    return localStorage.getItem(ALLOWED) === '1';
  } catch {
    try {
      return localStorage.getItem(ALLOWED) === '1';
    } catch {
      return false;
    }
  }
}

// Keeps the position current while the app is open and in use.
export function watchLocation(onMove: (c: Coords) => void) {
  if (!navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => {
      lastCoords = { lat: p.coords.latitude, lng: p.coords.longitude };
      onMove(lastCoords);
    },
    () => {},
    { maximumAge: 15000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Rough distance in km, used to decide whether someone has really moved.
export function kmBetween(a: Coords, b: Coords) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// When nothing is listed near you yet, this finds your city name so the app can open it.
export async function nearestCity(coords: Coords): Promise<string | null> {
  if (resolvedCity) return resolvedCity;
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { city?: string; locality?: string };
    resolvedCity = d.city || d.locality || null;
    return resolvedCity;
  } catch {
    return null;
  }
}

const RECENT = 'daypass-recent';

export function recentCities(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]');
  } catch {
    return [];
  }
}

export function rememberCity(city: string) {
  try {
    const next = [city, ...recentCities().filter((c) => c.toLowerCase() !== city.toLowerCase())].slice(0, 4);
    localStorage.setItem(RECENT, JSON.stringify(next));
  } catch {}
}

// The general area from the person's network, for when exact location hasn't been shared. Asked once per visit.
export type Area = { city: string; country: string | null };
let areaLookup: Promise<Area | null> | null = null;
export function generalArea(): Promise<Area | null> {
  areaLookup ??= fetch('/api/where', { signal: AbortSignal.timeout(4000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no answer'))))
    .then((d) => (d?.city ? { city: d.city as string, country: (d.country as string) ?? null } : null))
    .catch(() => {
      // A weak connection shouldn't decide this for the whole visit, so the next caller can ask again.
      areaLookup = null;
      return null;
    });
  return areaLookup;
}

// The address for another place. On Find it keeps the sort and filters the person has chosen.
export function placeUrl(place: Record<string, string | null>) {
  const next = new URLSearchParams(window.location.pathname === '/gyms' ? window.location.search : '');
  for (const key of ['city', 'country', 'near', 'area']) next.delete(key);
  for (const [key, value] of Object.entries(place)) if (value) next.set(key, value);
  return `/gyms?${next}`;
}
