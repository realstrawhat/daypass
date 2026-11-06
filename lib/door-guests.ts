// The owner panel's sample guests. They are worked out from the gym and the date rather than stored, so everyone
// sees the same day, and people arrive and leave as the clock moves without anything running in the background.
export type SampleGuest = { no: number; name: string; code: string; plannedIn: number; plannedOut: number };

const FIRST = ['Mia', 'Noah', 'Lena', 'Omar', 'Ana', 'Theo', 'Sofia', 'Ivan', 'Nora', 'Luca', 'Zoe', 'Emil', 'Aya', 'Hugo', 'Elif', 'Finn', 'Ines', 'Max', 'Tara', 'Leo'];
const INITIALS = 'ABCDEFGHJKLMNPRSTVW';
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Minutes until the next arrival. Before and after work are busiest, but the gym is never empty for long,
// because the demo has to work whenever someone opens it.
function gapRange(hour: number): [number, number] {
  if ((hour >= 6 && hour < 9) || (hour >= 17 && hour < 21)) return [3, 6];
  if (hour >= 9 && hour < 17) return [5, 11];
  if (hour >= 21 || hour === 5) return [9, 16];
  return [14, 26];
}

export function sampleGuests(gymId: string, day: string, startMs: number, endMs: number): SampleGuest[] {
  const random = seeded(`${gymId}:${day}`);
  const pick = (from: number, to: number) => from + random() * (to - from);
  const guests: SampleGuest[] = [];
  let at = startMs + pick(0, 3) * 60000;
  while (at < endMs) {
    const name = `${FIRST[Math.floor(random() * FIRST.length)]} ${INITIALS[Math.floor(random() * INITIALS.length)]}.`;
    const code = `DP-${Array.from({ length: 5 }, () => CODE[Math.floor(random() * CODE.length)]).join('')}`;
    guests.push({ no: guests.length + 1, name, code, plannedIn: Math.round(at), plannedOut: Math.round(at + pick(25, 100) * 60000) });
    const [low, high] = gapRange(Math.floor((at - startMs) / 3600000));
    at += pick(low, high) * 60000;
  }
  return guests;
}
