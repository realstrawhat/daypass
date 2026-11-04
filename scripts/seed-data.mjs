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
const AUTHORS = ['Mara K.', 'Tom V.', 'Sofia R.', 'Daniel P.', 'Ana L.', 'Luca B.', 'Nina H.', 'Omar S.', 'Eva W.', 'Jonas M.', 'Priya N.', 'Marco D.', 'Lena F.', 'Sam T.'];
const REVIEWS = [
  'Booked from my hotel, walked in ten minutes later. No front desk sales pitch at all.',
  'Good racks and plenty of plates. Exactly what I wanted on a work trip.',
  'Clean showers and a fair price for one session. I will come back next time I am in town.',
  'A bit busy at six, quiet by eight. Staff were helpful with the lockers.',
  'I train twice a month, so paying per visit makes far more sense than a membership.',
  'Showed the code at reception and was on the floor in under a minute.',
  'Plenty of space on the free weights floor, even on a weekday evening.',
  'Older equipment but well looked after. Nothing was out of order when I visited.',
  'Bring your own lock. Otherwise easy, friendly and exactly as described.',
  'Great for a one-off leg day while travelling. Squat racks were free straight away.',
  'The conditioning area is the best part. Sleds and rowers without a queue.',
  'Quiet on a Sunday morning, which is what I wanted. Good music, not too loud.',
  'Changing rooms were small but spotless. I would book this one again.',
  'Staff explained the layout on my first visit without trying to sell me anything.',
];

// Room shots lead each gym, because people judge a venue by the room. Action shots follow.
export const ROOM_PHOTOS = ['g01', 'g03', 'g06', 'g15', 'g16', 'g19', 'g20', 'g22', 'g23', 'g24'];
export const ACTION_PHOTOS = ['g04', 'g05', 'g07', 'g08', 'g10', 'g12', 'g14', 'g18', 'g26', 'g27', 'g28', 'g30', 'g31', 'g32', 'g33', 'g34', 'g35', 'g36'];

export const hashText = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// A gym's photos, reviews and pass facts all derive from its slug, so reseeding is stable.
export function gymExtras(slug, rating) {
  const r = rng(hashText(slug));
  const shuffled = (list) => [...list].map((v) => [r(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const photo = (n) => `/img/${n}.jpg`;
  const rooms = shuffled(ROOM_PHOTOS);
  const actions = shuffled(ACTION_PHOTOS);
  const photos = [photo(rooms[0]), photo(actions[0]), photo(rooms[1]), photo(actions[1])];
  const authors = shuffled(AUTHORS);
  const reviews = shuffled(REVIEWS).slice(0, 5).map((body, i) => ({
    author: authors[i],
    stars: Math.max(3, Math.min(5, Math.round(rating + (r() - 0.5) * 1.6))),
    body,
    days_ago: 2 + Math.floor(r() * 12) + i * 14,
  }));
  const facts = {
    stay: pickFrom(r, ['Stay up to 2 hours', 'Stay up to 2 hours', 'Stay as long as you like that day', 'Stay up to 3 hours']),
    entry: pickFrom(r, ['Show your pass code at reception', 'Show your pass code at reception', 'Scan your pass at the turnstile']),
    towel: pickFrom(r, ['Bring your own towel', 'Towel included', 'Towels for hire at €2']),
    lock: pickFrom(r, ['Bring a padlock for the lockers', 'Digital lockers, no padlock needed', 'Lockers with key from reception']),
    shower: r() > 0.12 ? 'Showers available' : 'No showers',
    water: pickFrom(r, ['Free water refill', 'Water bottles for sale', 'Free water refill']),
    age: pickFrom(r, ['16 and over', '18 and over', '16 and over']),
    access: r() > 0.3 ? 'Step-free entrance' : 'Stairs at the entrance',
    staffedUntil: 16 + Math.floor(r() * 6),
  };
  return { photos, reviews, facts };
}

const pickFrom = (r, list) => list[Math.floor(r() * list.length)];

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
    const kit = [...KIT].sort(() => r() - 0.5).slice(0, 6 + Math.floor(r() * 5));
    const slug = `${slugify(name)}-${slugify(city.name)}`;
    const rating = Number((3.6 + r() * 1.4).toFixed(1));
    const extras = gymExtras(slug, rating);
    const reviewCount = 12 + Math.floor(r() * 300);
    gyms.push({
      slug,
      name,
      city: city.name,
      country: city.country,
      timezone: city.timezone,
      address: `${10 + Math.floor(r() * 180)} ${pick(STREETS)}, ${city.name}`,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      price_cents: i === 0 ? 1200 : 800 + Math.floor(r() * 18) * 100,
      photos: i === 7 ? [] : extras.photos,
      facts: extras.facts,
      equipment: kit,
      description: pick(NOTES),
      open_hour: 5 + Math.floor(r() * 3),
      close_hour: 21 + Math.floor(r() * 3),
      weekend_open_hour: 7 + Math.floor(r() * 3),
      weekend_close_hour: 18 + Math.floor(r() * 4),
      capacity: 2 + Math.floor(r() * 5),
      seed_rating: rating,
      seed_rating_count: reviewCount,
      reviews: extras.reviews,
    });
  }
  return gyms;
}

export async function seedCity(sql, city, count = 24) {
  const gyms = buildCityGyms(city, count);
  for (const g of gyms) {
    const rows = await sql`
      INSERT INTO gyms (slug, name, city, country, timezone, address, lat, lng, price_cents, photos, facts, equipment, description,
        open_hour, close_hour, weekend_open_hour, weekend_close_hour, capacity, seed_rating, seed_rating_count, is_demo)
      VALUES (${g.slug}, ${g.name}, ${g.city}, ${g.country}, ${g.timezone}, ${g.address}, ${g.lat}, ${g.lng}, ${g.price_cents}, ${g.photos}, ${JSON.stringify(g.facts)}::jsonb, ${g.equipment}, ${g.description},
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
