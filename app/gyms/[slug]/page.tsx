import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { RatingLine } from '@/components/GymCard';
import { GymBooking } from '@/components/GymBooking';
import { GymGallery, GymStatusLine, GymTopBar, LocationMap } from '@/components/GymParts';
import { IconAccess, IconClock, IconDrop, IconIdCard, IconKey, IconScan, IconStar, IconTowel, IconUser } from '@/components/Icons';
import { Page } from '@/components/ui/Page';
import { hourLabel, money, ratingLabel } from '@/lib/format';
import { getGymBySlug, getReviews, type GymFacts } from '@/lib/gyms';
import { ratingShares } from '@/lib/hours';

type P = { params: Promise<{ slug: string }> };

// Gym pages are static and refreshed in the background, so opening one is instant.
// Open times and personal details load in the browser.
export const revalidate = 300;
export const generateStaticParams = async () => [];

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const gym = await getGymBySlug(slug).catch(() => null);
  return { title: gym ? `${gym.name}, ${gym.city}` : 'Gym' };
}

const FACT_ROWS: { key: keyof GymFacts; icon: React.ReactNode }[] = [
  { key: 'stay', icon: <IconClock /> },
  { key: 'entry', icon: <IconScan /> },
  { key: 'towel', icon: <IconTowel /> },
  { key: 'lock', icon: <IconKey /> },
  { key: 'shower', icon: <IconDrop /> },
  { key: 'water', icon: <IconDrop /> },
  { key: 'age', icon: <IconIdCard /> },
  { key: 'access', icon: <IconAccess /> },
];

export default async function GymPage({ params }: P) {
  const { slug } = await params;
  const gym = await getGymBySlug(slug);
  if (!gym) notFound();
  const reviews = await getReviews(gym.id);
  const shares = ratingShares(gym.rating);
  const daysSinceConfirm = Math.floor((Date.now() - new Date(gym.confirmed_at).getTime()) / 86400000);
  const hours = { id: gym.id, timezone: gym.timezone, open_hour: gym.open_hour, close_hour: gym.close_hour, weekend_open_hour: gym.weekend_open_hour, weekend_close_hour: gym.weekend_close_hour };

  return (
    <Page>
      <main className="gym">
        <GymTopBar gym={{ id: gym.id, name: gym.name, city: gym.city }} />
        <GymGallery gym={{ id: gym.id, name: gym.name, photos: gym.photos }} title={<h1>{gym.name}</h1>} />

        <div className="gym-sheet">
          <i className="sheet-handle" aria-hidden="true" />
          <header className="gym-title">
            <p className="gym-address">{gym.address}</p>
            <div className="gym-title-row">
              <RatingLine rating={gym.rating} count={gym.rating_count} />
              <GymStatusLine gym={hours} />
            </div>
          </header>
          <dl className="gym-stats">
            <div><dt>One visit</dt><dd>{money(gym.price_cents)}</dd></div>
            <div><dt>Rating</dt><dd>{gym.rating != null ? ratingLabel(gym.rating) : 'New'}</dd></div>
            <div><dt>Reviews</dt><dd>{gym.rating_count}</dd></div>
          </dl>

          <div className="gym-layout">
            <aside className="gym-book">
              <GymBooking gym={{ id: gym.id, name: gym.name, price_cents: gym.price_cents, timezone: gym.timezone }} />
            </aside>

            <div className="gym-info">
              {gym.description ? <p className="gym-desc">{gym.description}</p> : null}

              <section className="gym-section" aria-labelledby="facts">
                <h2 id="facts">What your pass includes</h2>
                <ul className="facts">
                  {FACT_ROWS.map(({ key, icon }) => (gym.facts?.[key] ? <li key={key}><i>{icon}</i><span>{String(gym.facts[key])}</span></li> : null))}
                  {gym.facts?.staffedUntil ? <li><i><IconUser /></i><span>Staffed until {hourLabel(gym.facts.staffedUntil)}</span></li> : null}
                </ul>
              </section>

              <section className="gym-section" aria-labelledby="hours">
                <h2 id="hours">Opening hours</h2>
                <dl className="hours">
                  <div><dt>Monday to Friday</dt><dd>{hourLabel(gym.open_hour)} to {hourLabel(gym.close_hour)}</dd></div>
                  <div><dt>Saturday and Sunday</dt><dd>{hourLabel(gym.weekend_open_hour)} to {hourLabel(gym.weekend_close_hour)}</dd></div>
                </dl>
              </section>

              <section className="gym-section" aria-labelledby="kit">
                <h2 id="kit">Equipment</h2>
                {gym.equipment.length ? <ul className="kit">{gym.equipment.map((e) => <li key={e}>{e}</li>)}</ul> : <p className="note">This gym has not listed its equipment yet.</p>}
              </section>

              <section className="gym-section" aria-labelledby="where">
                <h2 id="where">Where it is</h2>
                <p className="gym-where">{gym.address}</p>
                <div className="gym-map"><LocationMap gym={{ id: gym.id, slug: gym.slug, name: gym.name, lat: gym.lat, lng: gym.lng, price_cents: gym.price_cents }} /></div>
              </section>

              <section className="gym-section" aria-labelledby="reviews">
                <h2 id="reviews">Reviews</h2>
                {gym.rating != null ? (
                  <div className="rating-board">
                    <div className="rating-big"><strong>{ratingLabel(gym.rating)}</strong><small>{gym.rating_count} reviews</small></div>
                    <ul className="rating-bars" aria-label="Estimated share of reviews by stars">
                      {shares.map((pct, i) => (
                        <li key={i}><span>{5 - i}</span><i><b style={{ width: `${pct}%` }} /></i><span className="sr">{pct} percent</span></li>
                      ))}
                    </ul>
                  </div>
                ) : <p className="note">No reviews yet. Be the first after your visit.</p>}
                {gym.rating != null ? <p className="rating-estimate">Bars are estimated from the average rating.</p> : null}
                {reviews.length ? (
                  <ul className="reviews">
                    {reviews.map((r, i) => (
                      <li key={i}>
                        <div><strong>{r.author}</strong><span className="review-stars" aria-label={`${r.stars} out of 5 stars`}>{Array.from({ length: r.stars }, (_, n) => <IconStar key={n} />)}</span></div>
                        {r.body ? <p>{r.body}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <p className="fine gym-fine">
                {gym.is_demo ? 'Sample listing for this demo. ' : ''}
                Details confirmed by the gym {daysSinceConfirm <= 0 ? 'today' : `${daysSinceConfirm} ${daysSinceConfirm === 1 ? 'day' : 'days'} ago`}. Gyms confirm every 90 days.
              </p>
            </div>
          </div>
        </div>
      </main>
    </Page>
  );
}
