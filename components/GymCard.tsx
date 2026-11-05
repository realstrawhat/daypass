'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { distanceLabel, money, ratingLabel } from '@/lib/format';
import { gymStatus, type GymHours, type GymStatus } from '@/lib/hours';
import { GymPhoto } from './GymPhoto';
import { IconArrow, IconHeart, IconStar } from './Icons';
import { useSession } from './session';
import { SharedPhoto } from './ui/Page';

export type CardGym = GymHours & {
  slug: string;
  name: string;
  city?: string;
  price_cents: number;
  photos: string[];
  rating: number | null;
  rating_count: number;
  distance_km?: number | null;
};

// Opening status depends on the time now, so it appears after the page reaches the browser.
export function useGymStatus(gym: GymHours) {
  const [status, setStatus] = useState<GymStatus | null>(null);
  useEffect(() => {
    setStatus(gymStatus(gym));
    // Hours only change on the hour, so one check per screen is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym.id]);
  return status;
}

export function SaveButton({ gymId, name, tone = 'photo' }: { gymId: string; name: string; tone?: 'photo' | 'plain' }) {
  const { saved, toggleSaved } = useSession();
  const isSaved = saved.includes(gymId);
  const pressed = useRef(false);
  const wasSaved = useRef(isSaved);
  const [burst, setBurst] = useState(0);
  const [drop, setDrop] = useState(0);
  // Only a press plays the burst, not the heart filling in when a list loads.
  useEffect(() => {
    if (pressed.current && isSaved !== wasSaved.current) {
      if (isSaved) setBurst((b) => b + 1);
      else setDrop((d) => d + 1);
      pressed.current = false;
    }
    wasSaved.current = isSaved;
  }, [isSaved]);
  return (
    <button
      type="button"
      data-feel="none"
      className={`save is-${tone}${isSaved ? ' is-on' : ''}${drop ? ' is-dropped' : ''}`}
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        pressed.current = true;
        toggleSaved(gymId, name).finally(() => {
          pressed.current = false;
        });
      }}
    >
      <IconHeart key={drop} filled={isSaved} width={20} height={20} />
      {burst ? (
        <span key={burst} className="save-burst" aria-hidden="true">
          <i className="save-ring" />
          {Array.from({ length: 7 }, (_, n) => <b key={n} style={{ '--a': `${n * (360 / 7)}deg` } as React.CSSProperties} />)}
        </span>
      ) : null}
    </button>
  );
}

export function RatingLine({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <span className="rate rate-new">New</span>;
  return (
    <span className="rate">
      <IconStar width={14} height={14} /> {ratingLabel(rating)} <small>({count})</small>
    </span>
  );
}

function CardPhoto({ gym, morph, priority, sizes }: { gym: CardGym; morph: boolean; priority?: boolean; sizes: string }) {
  const photo = <GymPhoto src={gym.photos[0]} name={gym.name} priority={priority} sizes={sizes} />;
  return morph ? <SharedPhoto name={`gym-${gym.id}`} className="card-photo">{photo}</SharedPhoto> : <div className="card-photo">{photo}</div>;
}

// The photo is the card. The gym name sits on it in big type, and the price is a tilted sticker.
export function GymCard({ gym, active, priority, morph = true, onHover }: { gym: CardGym; active?: boolean; priority?: boolean; morph?: boolean; onHover?: () => void }) {
  const status = useGymStatus(gym);
  return (
    <Link href={`/gyms/${gym.slug}`} transitionTypes={['nav-forward']} className={`gym-card${active ? ' is-active' : ''}`} onMouseEnter={onHover} onFocus={onHover}>
      <CardPhoto gym={gym} morph={morph} priority={priority} sizes="(max-width: 560px) 94vw, (max-width: 1200px) 46vw, 26vw" />
      <i className="card-shade" aria-hidden="true" />
      <span className="price-sticker">{money(gym.price_cents)}</span>
      <SaveButton gymId={gym.id} name={gym.name} />
      <div className="card-copy">
        <h3>{gym.name}</h3>
        <p className="card-meta">
          <RatingLine rating={gym.rating} count={gym.rating_count} />
          {gym.distance_km != null ? <span>{distanceLabel(Number(gym.distance_km))}</span> : gym.city ? <span>{gym.city}</span> : null}
        </p>
        <p className="card-status">
          <span className={`status-dot${status?.open ? ' is-open' : ''}`}>{status?.line ?? ' '}</span>
          {status?.nextSlot ? <span className="card-next">Next: {status.nextSlot}</span> : null}
        </p>
      </div>
    </Link>
  );
}

export function PickCard({ gym, priority, morph = true }: { gym: CardGym; priority?: boolean; morph?: boolean }) {
  const status = useGymStatus(gym);
  return (
    <Link href={`/gyms/${gym.slug}`} transitionTypes={['nav-forward']} className="pick-card">
      <CardPhoto gym={gym} morph={morph} priority={priority} sizes="240px" />
      <i className="card-shade" aria-hidden="true" />
      <span className="price-sticker is-small">{money(gym.price_cents)}</span>
      <SaveButton gymId={gym.id} name={gym.name} />
      <div className="card-copy">
        <h3>{gym.name}</h3>
        <p className="card-meta"><RatingLine rating={gym.rating} count={gym.rating_count} /></p>
        <p className="card-status"><span className={`status-dot${status?.open ? ' is-open' : ''}`}>{status?.line ?? ' '}</span></p>
      </div>
    </Link>
  );
}

// The big swipeable card at the top of Home.
export function FeatureCard({ gym, priority, morph = true, showCity }: { gym: CardGym; priority?: boolean; morph?: boolean; showCity?: boolean }) {
  const status = useGymStatus(gym);
  return (
    <Link href={`/gyms/${gym.slug}`} transitionTypes={['nav-forward']} className="feature-card">
      <CardPhoto gym={gym} morph={morph} priority={priority} sizes="(max-width: 860px) 130vw, 620px" />
      <i className="card-shade" aria-hidden="true" />
      <span className="price-sticker is-large">{money(gym.price_cents)}<small>one visit</small></span>
      <SaveButton gymId={gym.id} name={gym.name} />
      <div className="card-copy">
        <h3>{gym.name}</h3>
        <p className="card-meta">
          <RatingLine rating={gym.rating} count={gym.rating_count} />
          {showCity && gym.city ? <span>{gym.city}</span> : null}
          <span className={`status-dot${status?.open ? ' is-open' : ''}`}>{status?.line ?? ' '}</span>
        </p>
        <span className="feature-book">{status?.nextSlot ? `Book ${status.nextSlot.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}` : 'See times'} <i aria-hidden="true"><IconArrow /></i></span>
      </div>
    </Link>
  );
}
