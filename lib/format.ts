export const money = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export const dateLabel = (iso: string | Date, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(iso));

export const longDate = (iso: string | Date, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(new Date(iso));

export const timeLabel = (iso: string | Date, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));

export const distanceLabel = (km: number | null | undefined) =>
  km == null ? '' : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

// A gym with no ratings yet is new, not rated zero.
export const ratingLabel = (rating: number | null | undefined) => (rating == null ? 'New' : Number(rating).toFixed(1));

export const hourLabel =(h: number) => `${String(h).padStart(2, '0')}:00`;

export const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const canChange = (iso: string | Date) => new Date(iso).getTime() - Date.now() > CANCEL_WINDOW_MS;

export const directionsLinks = (lat: number, lng: number, name: string) => {
  const q = encodeURIComponent(name);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=transit`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}&q=${q}`,
    web: `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=15/${lat}/${lng}`,
  };
};
