// Creates the schema and seeds demo gyms. Safe to run repeatedly.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing');
const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    password_hash text NOT NULL,
    home_city text,
    default_sort text NOT NULL DEFAULT 'recommended',
    max_price_cents int,
    saved_card jsonb,
    deletion_requested_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS passkeys (
    credential_id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key text NOT NULL,
    counter bigint NOT NULL DEFAULT 0,
    transports text[],
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_challenges (
    id text PRIMARY KEY,
    challenge text NOT NULL,
    user_id uuid,
    expires_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS gyms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    city text NOT NULL,
    country text NOT NULL,
    address text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    price_cents int NOT NULL CHECK (price_cents > 0),
    photos text[] NOT NULL DEFAULT '{}',
    equipment text[] NOT NULL DEFAULT '{}',
    description text NOT NULL DEFAULT '',
    open_hour int NOT NULL DEFAULT 6,
    close_hour int NOT NULL DEFAULT 22,
    weekend_open_hour int NOT NULL DEFAULT 8,
    weekend_close_hour int NOT NULL DEFAULT 20,
    capacity int NOT NULL DEFAULT 4,
    timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
    seed_rating numeric(2,1) NOT NULL DEFAULT 0,
    seed_rating_count int NOT NULL DEFAULT 0,
    is_demo boolean NOT NULL DEFAULT true,
    owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    commission_bps int NOT NULL DEFAULT 1500,
    confirmed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS gyms_lat_lng ON gyms(lat, lng)`,
  `CREATE INDEX IF NOT EXISTS gyms_owner ON gyms(owner_user_id)`,
  `CREATE TABLE IF NOT EXISTS slots (
    gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    capacity int NOT NULL,
    booked int NOT NULL DEFAULT 0 CHECK (booked >= 0),
    PRIMARY KEY (gym_id, starts_at),
    CHECK (booked <= capacity)
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id uuid NOT NULL REFERENCES gyms(id),
    starts_at timestamptz NOT NULL,
    price_cents int NOT NULL,
    commission_cents int NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('hold','confirmed','cancelled','failed','expired')),
    idempotency_key text NOT NULL,
    hold_expires_at timestamptz,
    previous_starts_at timestamptz,
    previous_gym_id uuid REFERENCES gyms(id),
    confirmation_version int NOT NULL DEFAULT 1,
    refund_cents int NOT NULL DEFAULT 0,
    is_sample boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
  )`,
  `CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id, starts_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_per_slot
     ON bookings(user_id, gym_id, starts_at) WHERE status IN ('hold','confirmed')`,
  `CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('charge','adjustment','refund')),
    status text NOT NULL CHECK (status IN ('succeeded','declined')),
    amount_cents int NOT NULL,
    method text NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_one_charge
     ON payments(booking_id) WHERE kind = 'charge' AND status = 'succeeded'`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
    body text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reviews_gym ON reviews(gym_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS seed_reviews (
    id serial PRIMARY KEY,
    gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    author text NOT NULL,
    stars int NOT NULL,
    body text NOT NULL,
    days_ago int NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS seed_reviews_gym ON seed_reviews(gym_id)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at timestamptz`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wallet_added_at timestamptz`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_reason text`,
  `ALTER TABLE gyms ADD COLUMN IF NOT EXISTS facts jsonb NOT NULL DEFAULT '{}'`,
  `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_user ON messages(user_id, created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS messages_one_reminder ON messages(booking_id, kind) WHERE kind = 'reminder'`,
  `CREATE TABLE IF NOT EXISTS saved_gyms (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, gym_id)
  )`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_out_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS day_notes (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day date NOT NULL,
    body text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS door_guest_actions (
    gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    day date NOT NULL,
    guest_no int NOT NULL,
    in_at timestamptz,
    out_at timestamptz,
    PRIMARY KEY (gym_id, day, guest_no)
  )`,
];

for (const s of statements) await sql.query(s);
// Reviews written before the public flag existed: samples and demo accounts must not count.
await sql`UPDATE reviews r SET is_public = false FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = r.booking_id AND r.is_public AND (b.is_sample OR u.is_demo)`;
console.log('schema ready');

const { seedCity, CITIES } = await import('./seed-data.mjs');
for (const city of CITIES) {
  // Only seed an empty city, so running setup again never adds duplicates.
  const [{ existing }] = await sql`SELECT count(*)::int AS existing FROM gyms WHERE city = ${city.name}`;
  const n = existing === 0 ? await seedCity(sql, city) : 0;
  console.log(`${city.name}: ${existing + n} gyms`);
}
const [{ count }] = await sql`SELECT count(*)::int AS count FROM gyms`;
console.log('total gyms', count);
