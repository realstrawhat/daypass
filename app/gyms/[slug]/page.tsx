import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BookingPanel } from '@/components/BookingPanel';
import { GymPhoto } from '@/components/GymPhoto';
import { IconBack, IconStar } from '@/components/Icons';
import { LocationMap } from '@/components/LocationMap';
import { getCurrentUser } from '@/lib/auth';
import { hourLabel, money, ratingLabel } from '@/lib/format';
import { getAvailability, getGymBySlug, getReviews } from '@/lib/gyms';

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const gym = await getGymBySlug(slug);
  return { title: gym ? `${gym.name}, ${gym.city}` : 'Gym' };
}

export default async function GymPage({ params }: P) {
  const { slug } = await params;
  const gym = await getGymBySlug(slug);
  if (!gym) notFound();
  const [days, reviews, user] = await Promise.all([getAvailability(gym), getReviews(gym.id), getCurrentUser().catch(() => null)]);
  const counts = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.stars === s).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.n));
  const daysSinceConfirm = Math.floor((Date.now() - new Date(gym.confirmed_at).getTime()) / 86400000);

  return (
    <main className="gym">
      <section className="gym-hero">
        <div className="gym-hero-main">
          <GymPhoto src={gym.photos[0]} name={gym.name} priority sizes="(max-width: 860px) 100vw, 66vw" />
          <div className="gym-hero-shade" aria-hidden="true" />
          <Link href={`/gyms?city=${encodeURIComponent(gym.city)}`} className="round round-glass gym-back" aria-label={`Back to gyms in ${gym.city}`}><IconBack /></Link>
          <div className="gym-hero-copy">
            <h1>{gym.name}</h1>
            <p>{gym.address}</p>
          </div>
        </div>
        {gym.photos.length > 1 ? (
          <div className="gym-hero-side">
            {gym.photos.slice(1, 3).map((p) => (
              <div key={p}><GymPhoto src={p} name={gym.name} sizes="(max-width: 860px) 50vw, 30vw" /></div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="gym-layout">
        <div className="gym-info">
          <dl className="gym-stats">
            <div><dt>Day pass</dt><dd>{money(gym.price_cents)}</dd></div>
            <div><dt>Rating</dt><dd className="with-star"><IconStar /> {ratingLabel(gym.rating)}</dd></div>
            <div><dt>Reviews</dt><dd>{gym.rating_count}</dd></div>
          </dl>

          {gym.description ? <p className="gym-desc">{gym.description}</p> : null}

          <section className="gym-section">
            <h2>Opening hours</h2>
            <dl className="hours">
              <div><dt>Monday to Friday</dt><dd>{hourLabel(gym.open_hour)} to {hourLabel(gym.close_hour)}</dd></div>
              <div><dt>Saturday and Sunday</dt><dd>{hourLabel(gym.weekend_open_hour)} to {hourLabel(gym.weekend_close_hour)}</dd></div>
            </dl>
          </section>

          <section className="gym-section">
            <h2>Equipment</h2>
            {gym.equipment.length ? (
              <ul className="kit">{gym.equipment.map((e) => <li key={e}>{e}</li>)}</ul>
            ) : <p className="note">This gym has not listed its equipment yet.</p>}
          </section>

          <section className="gym-section">
            <h2>Location</h2>
            <p className="gym-address">{gym.address}</p>
            <div className="gym-map"><LocationMap gym={{ id: gym.id, slug: gym.slug, name: gym.name, lat: gym.lat, lng: gym.lng, price_cents: gym.price_cents }} /></div>
          </section>

          <section className="gym-section">
            <h2>Reviews</h2>
            <div className="rating-board">
              <p className="rating-big">{ratingLabel(gym.rating)}</p>
              <ul className="rating-bars" aria-label="Recent reviews by stars">
                {counts.map((c) => (
                  <li key={c.s}><span>{c.s}</span><i><b style={{ width: `${(c.n / maxCount) * 100}%` }} /></i><span className="sr">{c.n} reviews</span></li>
                ))}
              </ul>
            </div>
            {reviews.length ? (
              <ul className="reviews">
                {reviews.map((r, i) => (
                  <li key={i}>
                    <div><strong>{r.author}</strong><span className="review-stars" aria-label={`${r.stars} out of 5 stars`}>{Array.from({ length: r.stars }, (_, n) => <IconStar key={n} />)}</span></div>
                    {r.body ? <p>{r.body}</p> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="note">No reviews yet.</p>}
          </section>

          <p className="fine">
            {gym.is_demo ? 'Sample listing for this demo. ' : ''}
            Details confirmed by the gym {daysSinceConfirm === 0 ? 'today' : `${daysSinceConfirm} ${daysSinceConfirm === 1 ? 'day' : 'days'} ago`}. Gyms confirm every 90 days.
          </p>
        </div>

        <aside className="gym-book">
          <BookingPanel gym={{ id: gym.id, name: gym.name, price_cents: gym.price_cents, timezone: gym.timezone }} days={days} loggedIn={!!user} savedCard={user?.saved_card ?? null} />
        </aside>
      </div>

      <div className="book-bar">
        <p><strong>{money(gym.price_cents)}</strong> one visit</p>
        <a href="#book" className="btn btn-volt">Choose a time</a>
      </div>
    </main>
  );
}
