// Refreshes sample gyms with room-first photos, unique reviews and pass facts.
// Only touches gyms flagged is_demo. Safe to run repeatedly.
import { neon } from '@neondatabase/serverless';
import { gymExtras } from './seed-data.mjs';

const sql = neon(process.env.DATABASE_URL);
const gyms = await sql`SELECT id, slug, seed_rating, photos FROM gyms WHERE is_demo = true`;
let n = 0;
for (const g of gyms) {
  const extras = gymExtras(g.slug, Number(g.seed_rating));
  // Gyms seeded without photos stay that way, to keep the no-photo case visible.
  const photos = g.photos.length === 0 ? [] : extras.photos;
  await sql`UPDATE gyms SET photos = ${photos}, facts = ${JSON.stringify(extras.facts)}::jsonb WHERE id = ${g.id}::uuid`;
  await sql`DELETE FROM seed_reviews WHERE gym_id = ${g.id}::uuid`;
  for (const r of extras.reviews) {
    await sql`INSERT INTO seed_reviews (gym_id, author, stars, body, days_ago) VALUES (${g.id}::uuid, ${r.author}, ${r.stars}, ${r.body}, ${r.days_ago})`;
  }
  n++;
}
console.log(`upgraded ${n} sample gyms`);
