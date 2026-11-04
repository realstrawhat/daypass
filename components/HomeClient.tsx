'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, timeLabel } from '@/lib/format';
import { FeatureCard, PickCard, type CardGym } from './GymCard';
import { IconArrow, IconBell, IconLocate, IconSearch, Spark } from './Icons';
import { locate } from './location';
import { SearchOverlay } from './SearchOverlay';
import { useSession, type NextBooking } from './session';
import { useFeedback } from './ui/feedback';
import { Ribbon } from './ui/Ribbon';

const CITIES = [
  { name: 'Berlin', img: '/img/g24.jpg' },
  { name: 'Lisbon', img: '/img/g13.jpg' },
  { name: 'Barcelona', img: '/img/g15.jpg' },
  { name: 'Paris', img: '/img/g12.jpg' },
  { name: 'Prague', img: '/img/g21.jpg' },
  { name: 'Vienna', img: '/img/g02.jpg' },
  { name: 'Rome', img: '/img/g28.jpg' },
];

function countdown(iso: string) {
  const hours = (new Date(iso).getTime() - Date.now()) / 3600000;
  if (hours < 0) return 'Happening now';
  if (hours < 1) return `In ${Math.max(1, Math.round(hours * 60))} minutes`;
  if (hours < 24) return `In ${Math.round(hours)} ${Math.round(hours) === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

function NextCard({ next }: { next: NextBooking }) {
  const [when, setWhen] = useState('');
  useEffect(() => setWhen(countdown(next.starts_at)), [next.starts_at]);
  return (
    <Link href={`/bookings/${next.id}`} transitionTypes={['nav-forward']} className="next-card">
      <i className="foil-sweep" aria-hidden="true" />
      <div className="next-main">
        <p className="next-label">{when || ' '}</p>
        <h2>{next.gym_name}</h2>
        <p className="next-when">{dateLabel(next.starts_at, next.gym_timezone)} at {timeLabel(next.starts_at, next.gym_timezone)}, {next.gym_city}</p>
      </div>
      <span className="next-open"><i aria-hidden="true"><IconArrow /></i></span>
    </Link>
  );
}

function FeaturedRail({ gyms, morphAllowed }: { gyms: CardGym[]; morphAllowed: (id: string) => boolean }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const onScroll = () => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setIndex(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
  };
  return (
    <section className="featured" aria-label="Featured gyms">
      <ul className="featured-track" ref={track} onScroll={onScroll} tabIndex={0}>
        {gyms.map((g, i) => <li key={g.id} className="featured-item"><FeatureCard gym={g} priority={i < 1} morph={morphAllowed(g.id)} /></li>)}
      </ul>
      <div className="featured-dots" aria-hidden="true">
        {gyms.map((g, i) => <i key={g.id} className={i === index ? 'on' : ''} />)}
      </div>
    </section>
  );
}

export function HomeClient({ picks, city }: { picks: CardGym[]; city: string }) {
  const { user, ready, next, toRate, unread, saved } = useSession();
  const [overlay, setOverlay] = useState(false);
  const [note, setNote] = useState('');
  const [personal, setPersonal] = useState<{ city: string; gyms: CardGym[] } | null>(null);
  const [savedGyms, setSavedGyms] = useState<CardGym[]>([]);
  const router = useRouter();
  const { toast } = useFeedback();

  // A saved home city replaces the default picks.
  useEffect(() => {
    const home = user?.home_city;
    if (!home || home.toLowerCase() === city.toLowerCase()) {
      setPersonal(null);
      return;
    }
    let live = true;
    fetch(`/api/gyms?city=${encodeURIComponent(home)}`).then((r) => r.json()).then((d) => {
      if (live && d.gyms) setPersonal({ city: d.place?.name ?? home, gyms: d.gyms.slice(0, 12) });
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [user?.home_city, city]);

  useEffect(() => {
    if (!user || saved.length === 0) {
      setSavedGyms([]);
      return;
    }
    let live = true;
    fetch('/api/saved').then((r) => r.json()).then((d) => {
      if (live && d.gyms) setSavedGyms(d.gyms);
    }).catch(() => {});
    return () => {
      live = false;
    };
    // Only refetch when the set of saved gyms changes size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, saved.length]);

  const nearMe = async () => {
    try {
      await locate();
      router.push('/gyms?near=1');
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Location is off. Type a city instead.';
      toast(text, 'error');
      setNote(text);
      setOverlay(true);
    }
  };

  const shown = personal?.gyms ?? picks;
  const shownCity = personal?.city ?? city;
  const featured = shown.slice(0, 5);
  const rest = shown.slice(5);
  // A photo can only morph from one card on a screen, so a saved gym's copy here stays still.
  const canMorph = (id: string) => !savedGyms.some((s) => s.id === id);

  return (
    <main className="home">
      <header className="home-top">
        <p className="home-brand"><Spark /> {!ready ? <span className="sk sk-word" /> : user ? `Hi ${user.name.split(' ')[0]}` : 'Daypass'}</p>
        <div className="home-actions">
          {user ? (
            <>
              <Link href="/inbox" className="round round-solid" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
                <IconBell />{unread ? <b className="count-badge">{unread}</b> : null}
              </Link>
              <Link href="/account" className="avatar" aria-label="Account">{user.name.charAt(0).toUpperCase()}</Link>
            </>
          ) : ready ? (
            <Link href="/login?next=/home" className="home-login">Log in</Link>
          ) : null}
        </div>
      </header>

      <h1 className="home-title">One gym. One day. No contract.</h1>

      <div className="home-search">
        <button type="button" className="search-pill is-large" onClick={() => { setNote(''); setOverlay(true); }}>
          <IconSearch /> <span>Where are you training?</span>
        </button>
        <button type="button" className="round round-solid round-lg" aria-label="Gyms near me" onClick={nearMe}><IconLocate /></button>
      </div>

      {ready && next ? <NextCard next={next} /> : null}

      {toRate ? (
        <Link href={`/bookings/${toRate.id}#rate`} className="rate-nudge">
          <span><strong>How was {toRate.gym_name}?</strong> Rate your visit out of 5.</span>
          <IconArrow />
        </Link>
      ) : null}

      {featured.length ? <FeaturedRail gyms={featured} morphAllowed={canMorph} /> : null}

      <Ribbon />

      {savedGyms.length ? (
        <section className="rail-section" aria-labelledby="saved">
          <div className="rail-head"><h2 id="saved">Saved</h2></div>
          <ul className="h-rail">
            {savedGyms.map((g) => <li key={g.id}><PickCard gym={g} /></li>)}
          </ul>
        </section>
      ) : null}

      <section className="rail-section" aria-labelledby="picks">
        <div className="rail-head">
          <h2 id="picks">More in {shownCity}</h2>
          <Link href={`/gyms?city=${encodeURIComponent(shownCity)}`} transitionTypes={['nav-tab']}>See all</Link>
        </div>
        <ul className="h-rail">
          {rest.map((g) => <li key={g.id}><PickCard gym={g} morph={canMorph(g.id)} /></li>)}
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

      <Link href="/partners" className="home-partner">
        <strong>Own a gym?</strong>
        <span>List it for free and set your own price. You pay 15% only when someone books.</span>
      </Link>
      <p className="fine home-fine">Student project demo. Gyms are sample data, and payments, Wallet and email are simulated.</p>
      <SearchOverlay open={overlay} onClose={() => { setOverlay(false); setNote(''); }} note={note} />
    </main>
  );
}
