// Deterministic demo gyms. Names and listings are fictional and flagged is_demo.
export const CITIES = [
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, timezone: 'Europe/Amsterdam' },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, timezone: 'Europe/Berlin' },
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393, timezone: 'Europe/Lisbon' },
  { name: 'Barcelona', country: 'Spain', lat: 41.3874, lng: 2.1686, timezone: 'Europe/Madrid' },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' },
  { name: 'Prague', country: 'Czechia', lat: 50.0755, lng: 14.4378, timezone: 'Europe/Prague' },
  { name: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738, timezone: 'Europe/Vienna' },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964, timezone: 'Europe/Rome' },
];

const FIRST = ['Iron', 'Forge', 'Northside', 'Concrete', 'Anvil', 'Vault', 'Plate', 'Foundry', 'Kilo', 'Harbor', 'Atlas', 'Grit', 'Tempo', 'Barbell', 'Rack', 'Union', 'Canal', 'Second', 'Blackline', 'Low Bar', 'Peak', 'Hammer', 'Southpaw', 'Basement', 'Rooftop', 'Corner', 'Static', 'Chalk'];
const LAST = ['Gym', 'Athletic', 'Club', 'House', 'Strength', 'Lab', 'Works', 'Room'];
const STREETS = ['Station Road', 'Market Street', 'Canal Side', 'Mill Lane', 'Park Avenue', 'Harbour Way', 'Foundry Yard', 'Old Town Passage', 'Victoria Street', 'Bridge Road'];
const KIT = ['Squat racks', 'Olympic platforms', 'Dumbbells to 50 kg', 'Cable machines', 'Treadmills', 'Rowers', 'Assault bikes', 'Sled track', 'Kettlebells', 'Boxing bags', 'Sauna', 'Showers', 'Lockers', 'Towel service', 'Yoga room', 'Pilates reformers', 'Climbing wall', 'Leg press'];
const NOTES = [
  'Serious lifting floor with room to move, even at peak hours.',
  'Daylight, clean kit and staff who show you around on your first visit.',
  'A quiet, well-kept room for people who came to train and leave.',
  'Big conditioning area and a free-weights floor that is rarely crowded.',
  'Compact and friendly, with everything you need for a full session.',
];
const AUTHORS = ['Mara K.', 'Tom V.', 'Sofia R.', 'Daniel P.', 'Ana L.', 'Luca B.', 'Nina H.', 'Omar S.'];
const REVIEWS = [
  'Booked from my hotel, walked in ten minutes later. No front desk sales pitch at all.',
  'Good racks and plenty of plates. Exactly what I wanted on a work trip.',
  'Clean showers and fair price for one session. I would come back next time I am here.',
  'A bit busy at six, quiet by eight. Staff were helpful with the lockers.',
  'I train twice a month, so paying per visit makes far more sense than a membership.',
];

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const rng = (seed) => {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
};
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildCityGyms(city, count = 24) {
  const r = rng(hash(city.name + city.country));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const used = new Set();
  const gyms = [];
  for (let i = 0; i < count; i++) {
    let name;
    if (i === 0) name = 'Iron Gym';
    else {
      do name = `${pick(FIRST)} ${pick(LAST)}`;
      while (used.has(name));
    }
    used.add(name);
    const angle = r() * Math.PI * 2;
    const km = i === 0 ? 0.5 : i < 4 ? 1 + r() * 3 : 1 + r() * 8;
    const lat = city.lat + (km / 111) * Math.cos(angle);
    const lng = city.lng + (km / (111 * Math.cos((city.lat * Math.PI) / 180))) * Math.sin(angle);
    const photoStart = 1 + Math.floor(r() * 18);
    const photos = [0, 5, 11].map((o) => `/img/g${String(((photoStart + o - 1) % 18) + 1).padStart(2, '0')}.jpg`);
    const kit = [...KIT].sort(() => r() - 0.5).slice(0, 6 + Math.floor(r() * 5));
    gyms.push({
      slug: `${slugify(name)}-${slugify(city.name)}`,
      name,
      city: city.name,
      country: city.country,
      timezone: city.timezone,
      address: `${10 + Math.floor(r() * 180)} ${pick(STREETS)}, ${city.name}`,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      price_cents: i === 0 ? 1200 : 800 + Math.floor(r() * 18) * 100,
      photos: i === 7 ? [] : photos,
      equipment: kit,
      description: pick(NOTES),
      open_hour: 5 + Math.floor(r() * 3),
      close_hour: 21 + Math.floor(r() * 3),
      weekend_open_hour: 7 + Math.floor(r() * 3),
      weekend_close_hour: 18 + Math.floor(r() * 4),
      capacity: 2 + Math.floor(r() * 5),
      seed_rating: Number((3.6 + r() * 1.4).toFixed(1)),
      seed_rating_count: 12 + Math.floor(r() * 300),
      reviews: [0, 1, 2].map(() => ({ author: pick(AUTHORS), stars: 3 + Math.floor(r() * 3), body: pick(REVIEWS), days_ago: 3 + Math.floor(r() * 90) })),
    });
  }
  return gyms;
}

export async function seedCity(sql, city, count = 24) {
  const gyms = buildCityGyms(city, count);
  for (const g of gyms) {
    const rows = await sql`
      INSERT INTO gyms (slug, name, city, country, timezone, address, lat, lng, price_cents, photos, equipment, description,
        open_hour, close_hour, weekend_open_hour, weekend_close_hour, capacity, seed_rating, seed_rating_count, is_demo)
      VALUES (${g.slug}, ${g.name}, ${g.city}, ${g.country}, ${g.timezone}, ${g.address}, ${g.lat}, ${g.lng}, ${g.price_cents}, ${g.photos}, ${g.equipment}, ${g.description},
        ${g.open_hour}, ${g.close_hour}, ${g.weekend_open_hour}, ${g.weekend_close_hour}, ${g.capacity}, ${g.seed_rating}, ${g.seed_rating_count}, true)
      ON CONFLICT (slug) DO NOTHING RETURNING id`;
    if (rows[0]) {
      for (const rv of g.reviews) {
        await sql`INSERT INTO seed_reviews (gym_id, author, stars, body, days_ago) VALUES (${rows[0].id}, ${rv.author}, ${rv.stars}, ${rv.body}, ${rv.days_ago})`;
      }
    }
  }
  return gyms.length;
}
