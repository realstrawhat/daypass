'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { GymPhoto } from './GymPhoto';
import { SaveButton, useGymStatus } from './GymCard';
import { IconBack } from './Icons';
import type { MapGym } from './GymMap';
import type { GymHours } from '@/lib/hours';
import { SharedPhoto } from './ui/Page';

const GymMap = dynamic(() => import('./GymMap').then((m) => m.GymMap), { ssr: false, loading: () => <div className="map-wrap map-loading" /> });

export function LocationMap({ gym }: { gym: MapGym }) {
  return <GymMap gyms={[gym]} center={{ lat: gym.lat, lng: gym.lng }} zoom={14.5} activeId={gym.id} single />;
}

// Swipeable photos, with the first one growing out of the card that opened this page.
// The photos drift gently as the page scrolls, and the gym name sits on top in big type.
export function GymGallery({ gym, title }: { gym: { id: string; name: string; photos: string[] }; title: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const photos = gym.photos.length ? gym.photos : [undefined];
  return (
    <div className="gallery">
      <div className="gallery-track" ref={track} onScroll={onScroll} tabIndex={gym.photos.length > 1 ? 0 : undefined} aria-label={`Photos of ${gym.name}`} role="group">
        {photos.map((p, i) =>
          i === 0 ? (
            <SharedPhoto key="hero" name={`gym-${gym.id}`} className="gallery-slide">
              <GymPhoto src={p} name={gym.name} priority sizes="(max-width: 860px) 100vw, 70vw" />
            </SharedPhoto>
          ) : (
            <div key={p} className="gallery-slide"><GymPhoto src={p} name={gym.name} sizes="(max-width: 860px) 100vw, 70vw" /></div>
          ),
        )}
      </div>
      <div className="gallery-shade" aria-hidden="true" />
      <div className="gallery-title">{title}</div>
      {gym.photos.length > 1 ? (
        <div className="gallery-dots" aria-hidden="true">{gym.photos.map((p, i) => <i key={p} className={i === index ? 'on' : ''} />)}</div>
      ) : null}
    </div>
  );
}

// A native-style bar: floating buttons over the photo, then the name settles into a solid bar on scroll.
export function GymTopBar({ gym }: { gym: { id: string; name: string; city: string } }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.42);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`gym-bar${solid ? ' is-solid' : ''}`}>
      <Link href={`/gyms?city=${encodeURIComponent(gym.city)}`} transitionTypes={['nav-back']} className="round round-glass" aria-label={`Back to gyms in ${gym.city}`}><IconBack /></Link>
      <p className="gym-bar-title" aria-hidden={!solid}>{gym.name}</p>
      <SaveButton gymId={gym.id} name={gym.name} tone="plain" />
    </header>
  );
}

export function GymStatusLine({ gym }: { gym: GymHours }) {
  const status = useGymStatus(gym);
  return <p className={`status-dot gym-status${status?.open ? ' is-open' : ''}`}>{status ? status.line : ' '}{status?.nextSlot ? <small>Next free: {status.nextSlot}</small> : null}</p>;
}
