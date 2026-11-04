import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { GymPhoto } from '@/components/GymPhoto';
import { HeroSearch } from '@/components/HeroSearch';
import { IconArrow, IconStar } from '@/components/Icons';
import { getCurrentUser } from '@/lib/auth';
import { listBookings } from '@/lib/bookings';
import { dateLabel, money, ratingLabel, timeLabel } from '@/lib/format';
import { ensureCityHasGyms, geocodeCity, searchGyms } from '@/lib/gyms';

export const metadata: Metadata = { title: 'Home' };

const CITIES = [
  { name: 'Amsterdam', img: '/img/g02.jpg', lat: 52.3676, lng: 4.9041 },
  { name: 'Berlin', img: '/img/g09.jpg' },
  { name: 'Lisbon', img: '/img/g13.jpg' },
  { name: 'Barcelona', img: '/img/g15.jpg' },
  { name: 'Paris', img: '/img/g12.jpg' },
  { name: 'Prague', img: '/img/g08.jpg' },
];

export default async function HomePage() {
  const user = await getCurrentUser().catch(() => null);
  const homeCity = user?.home_city ?? 'Amsterdam';
  let centre = { lat: 52.3676, lng: 4.9041, name: 'Amsterdam' };
  if (user?.home_city) {
    const place = await geocodeCity(user.home_city).catch(() => null);
    if (place) {
      await ensureCityHasGyms(place);
      centre = { lat: place.lat, lng: place.lng, name: place.name };
    }
  }
  const [picks, bookings] = await Promise.all([
    searchGyms({ lat: centre.lat, lng: centre.lng, sort: 'recommended' }),
    user ? listBookings(user.id) : Promise.resolve([]),
  ]);
  const now = Date.now();
  const next = bookings.filter((b) => b.status === 'confirmed' && new Date(b.starts_at).getTime() > now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  const toRate = bookings.find((b) => b.status === 'confirmed' && new Date(b.starts_at).getTime() <= now && b.review_stars == null);
  const hoursAway = next ? (new Date(next.starts_at).getTime() - now) / 3600000 : null;

  return (
    <main className="home">
      <header className="home-top">
        <div>
          <p className="home-hi">{user ? `Hi ${user.name.split(' ')[0]}` : 'Hi there'}</p>
          <h1>Where are you training?</h1>
        </div>
        {user ? (
          <Link href="/account" className="avatar" aria-label="Account">{user.name.charAt(0).toUpperCase()}</Link>
        ) : (
          <Link href="/login?next=/home" className="btn btn-volt home-login">Log in</Link>
        )}
      </header>

      <HeroSearch />

      {next ? (
        <Link href={`/bookings/${next.id}`} className="next-card">
          <div>
            <p className="next-label">{hoursAway !== null && hoursAway < 48 ? 'Reminder: coming up soon' : 'Your next session'}</p>
            <h2>{next.gym_name}</h2>
            <p className="next-when">{dateLabel(next.starts_at, next.gym_timezone)} at {timeLabel(next.starts_at, next.gym_timezone)}</p>
          </div>
          <span className="next-open">Open pass <i aria-hidden="true"><IconArrow /></i></span>
        </Link>
      ) : (
        <Link href="/gyms" className="next-card">
          <div>
            <p className="next-label">Nothing booked yet</p>
            <h2>Find your next session</h2>
            <p className="next-when">Pay for one visit. No contract, no calls.</p>
          </div>
          <span className="next-open">Find a gym <i aria-hidden="true"><IconArrow /></i></span>
        </Link>
      )}

      {toRate ? (
        <Link href={`/bookings/${toRate.id}#rate`} className="banner">
          <strong>How was {toRate.gym_name}?</strong>
          <span>Rate your visit out of 5.</span>
        </Link>
      ) : null}

      <section className="rail-section" aria-labelledby="picks">
        <div className="rail-head">
          <h2 id="picks">Top picks in {centre.name}</h2>
          <Link href={`/gyms?city=${encodeURIComponent(homeCity)}`}>See all</Link>
        </div>
        <ul className="h-rail">
          {picks.gyms.slice(0, 8).map((g, i) => (
            <li key={g.id}>
              <Link href={`/gyms/${g.slug}`} className="pick-card">
                <GymPhoto src={g.photos[0]} name={g.name} priority={i < 2} sizes="260px" />
                <span className="gym-price">{money(g.price_cents)}</span>
                <div className="pick-copy">
                  <strong>{g.name}</strong>
                  <span><IconStar /> {ratingLabel(g.rating)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rail-section" aria-labelledby="cities">
        <div className="rail-head"><h2 id="cities">Travelling?</h2></div>
        <ul className="h-rail">
          {CITIES.map((c) => (
            <li key={c.name}>
              <Link href={`/gyms?city=${c.name}`} className="city-chip">
                <Image src={c.img} alt="" fill sizes="170px" />
                <span>{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/partners" className="banner home-partner">
        <strong>Own a gym?</strong>
        <span>List it for free and set your own price. You pay 15% only when someone books.</span>
      </Link>
      <p className="fine">Student project demo. Gyms are sample data and payments are simulated.</p>
    </main>
  );
}
