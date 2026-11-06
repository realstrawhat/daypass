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
// A session is one hour, with 15 minutes' grace before and after. So the door opens 15 minutes before the start
// and closes 15 minutes after the hour ends.
export const GRACE_MINUTES = 15;
export const DOOR_OPENS_HOURS = GRACE_MINUTES / 60;
export const DOOR_CLOSES_HOURS = 1 + GRACE_MINUTES / 60;
export const SESSION_RULE = `1-hour session, with ${GRACE_MINUTES} minutes' grace before and after`;
export const doorIsOpen = (hours: number) => hours <= DOOR_OPENS_HOURS && hours >= -DOOR_CLOSES_HOURS;

// Entry and exit. Someone who never checks out stops counting as inside after this long.
export const MAX_STAY_HOURS = 6;
// A second scan this soon is the same person at the door, not them leaving.
export const SCAN_OUT_AFTER_MS = 60000;
export const UNDO_EXIT_MS = 5 * 60000;

export type VisitState = 'not_in' | 'inside' | 'left' | 'no_exit';

export function visitState(inAt: string | number | null | undefined, outAt: string | number | null | undefined, now = Date.now()): VisitState {
  if (!inAt) return 'not_in';
  if (outAt) return 'left';
  return now - new Date(inAt).getTime() > MAX_STAY_HOURS * 3600000 ? 'no_exit' : 'inside';
}

export function stayLabel(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function timerLabel(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(two).join(':');
}

// Every booking is a one-hour session, and it starts counting when the person is let in.
export const SESSION_MS = 3600000;
const GRACE_MS = GRACE_MINUTES * 60000;

// The hour counts down, then the grace period does, then it goes negative. Nobody is locked out: staff can see who has run over.
export function timeLeft(inAt: string | number, now = Date.now()) {
  const left = new Date(inAt).getTime() + SESSION_MS - now;
  if (left >= 0) return { stage: 'session' as const, over: false, label: timerLabel(Math.ceil(left / 1000) * 1000) };
  const grace = left + GRACE_MS;
  if (grace >= 0) return { stage: 'grace' as const, over: false, label: timerLabel(Math.ceil(grace / 1000) * 1000) };
  return { stage: 'over' as const, over: true, label: `\u2212${timerLabel(-grace)}` };
}

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
