// Removes accounts and listings created by automated tests, then recounts slot usage.
// Only touches qa+...@example.com accounts and gyms named QA Test Gym.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const gyms = await sql`DELETE FROM gyms WHERE slug LIKE 'qa-test-gym-%' AND is_demo = false RETURNING id`;
const users = await sql`DELETE FROM users WHERE email LIKE 'qa+%@example.com' RETURNING id`;
await sql`
  UPDATE slots s SET booked = (
    SELECT count(*) FROM bookings b
    WHERE b.gym_id = s.gym_id AND b.starts_at = s.starts_at AND b.status IN ('hold', 'confirmed')
  )`;
const [left] = await sql`SELECT count(*)::int AS gyms, (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM bookings) AS bookings FROM gyms`;
console.log(`removed ${users.length} test accounts and ${gyms.length} test gyms`, left);
