// Opening hours and next free time. Pure functions, so server and browser agree.
export type GymHours = {
  id: string;
  timezone: string;
  open_hour: number;
  close_hour: number;
  weekend_open_hour: number;
  weekend_close_hour: number;
};

export function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }).formatToParts(date);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { y: Number(v('year')), m: Number(v('month')), d: Number(v('day')), h: Number(v('hour')), min: Number(v('minute')), weekday: v('weekday') };
}

export const isWeekend = (weekday: string) => weekday === 'Sat' || weekday === 'Sun';
const two = (n: number) => String(n).padStart(2, '0');

export const hoursFor = (gym: GymHours, weekday: string) =>
  isWeekend(weekday) ? { open: gym.weekend_open_hour, close: gym.weekend_close_hour } : { open: gym.open_hour, close: gym.close_hour };

// Some hours are held back by the gym for classes or maintenance. Stable per gym and hour.
export function heldByGym(gymId: string, utcIso: string) {
  let h = 7;
  const s = gymId + utcIso;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h % 7 === 0;
}

function tzOffsetMs(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(utcMs));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) - utcMs;
}

export function localToUtc(y: number, m: number, d: number, h: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h);
  const first = guess - tzOffsetMs(guess, tz);
  return new Date(guess - tzOffsetMs(first, tz));
}

export type GymStatus = { open: boolean; line: string; nextSlot: string | null };

// What a result card shows: open or closed now, and the next hour that can be booked.
export function gymStatus(gym: GymHours, now = new Date()): GymStatus {
  const today = localParts(now, gym.timezone);
  const { open, close } = hoursFor(gym, today.weekday);
  const isOpen = today.h >= open && today.h < close;
  let line: string;
  if (isOpen) line = `Open until ${two(close)}:00`;
  else if (today.h < open) line = `Opens at ${two(open)}:00`;
  else {
    const tomorrow = new Date(Date.UTC(today.y, today.m - 1, today.d + 1, 12));
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(tomorrow);
    line = `Opens tomorrow at ${two(hoursFor(gym, wd).open)}:00`;
  }

  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const anchor = new Date(Date.UTC(today.y, today.m - 1, today.d + dayOffset, 12));
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(anchor);
    const h = hoursFor(gym, wd);
    for (let hour = h.open; hour < h.close; hour++) {
      const at = localToUtc(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, anchor.getUTCDate(), hour, gym.timezone);
      if (at.getTime() <= now.getTime()) continue;
      if (heldByGym(gym.id, at.toISOString())) continue;
      const label = `${two(hour)}:00`;
      return { open: isOpen, line, nextSlot: dayOffset === 0 ? `Today ${label}` : dayOffset === 1 ? `Tomorrow ${label}` : `${wd} ${label}` };
    }
  }
  return { open: isOpen, line, nextSlot: null };
}

// Rating bars, spread around the gym's average so they always agree with the headline number.
export function ratingShares(rating: number | null) {
  if (rating == null) return [0, 0, 0, 0, 0];
  const weights = [5, 4, 3, 2, 1].map((s) => Math.exp(-((s - rating) ** 2) / 0.9));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / total) * 100));
}

// The door rules, in one place for the screens and the server. Hours are counted to the session's start.
export const hoursUntil = (iso: string, now = Date.now()) => (new Date(iso).getTime() - now) / 3600000;
export const doorIsOpen = (hours: number) => hours <= 1 && hours >= -3;

export function sameLocalDay(a: Date, b: Date, tz: string) {
  const x = localParts(a, tz);
  const y = localParts(b, tz);
  return x.y === y.y && x.m === y.m && x.d === y.d;
}

// A refused-entry claim opens on the day of the session, and closes six hours after it starts.
export function refusalIsOpen(iso: string, tz: string, now = Date.now()) {
  const hours = hoursUntil(iso, now);
  return hours >= -6 && (hours <= 3 || sameLocalDay(new Date(iso), new Date(now), tz));
}

// Whole calendar days until a session, on the gym's own calendar.
export function daysUntil(iso: string, tz: string, now = Date.now()) {
  const a = localParts(new Date(iso), tz);
  const b = localParts(new Date(now), tz);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
}
