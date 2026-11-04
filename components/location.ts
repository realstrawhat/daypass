// Location stays in memory on this device for the current visit. It is never saved.
let lastCoords: { lat: number; lng: number } | null = null;

export const getLastCoords = () => lastCoords;

export function locate(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share your location. Type a city instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lastCoords = { lat: p.coords.latitude, lng: p.coords.longitude };
        resolve(lastCoords);
      },
      () => reject(new Error('Location is off. Type a city instead.')),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

// When nothing is listed near you yet, this finds your city name so the app can open it.
export async function nearestCity(coords: { lat: number; lng: number }): Promise<string | null> {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { city?: string; locality?: string };
    return d.city || d.locality || null;
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
