'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dateLabel, distanceLabel, money, timeLabel } from '@/lib/format';
import { gymStatus } from '@/lib/hours';
import { CityMark } from './CityMark';
import { PickCard, RatingLine, SaveButton, useGymStatus, type CardGym } from './GymCard';
import { GymPhoto } from './GymPhoto';
import { IconArrow, IconBell, IconLocate, IconSearch, Spark } from './Icons';
import { locate, locationAllowed, nearestCity, setResolvedCity } from './location';
import { useSession, type NextBooking } from './session';
import { useFeedback } from './ui/feedback';
import { SharedPhoto } from './ui/Page';

const SearchOverlay = dynamic(() => import('./SearchOverlay').then((m) => m.SearchOverlay), { ssr: false });

const CITIES = ['Amsterdam', 'Berlin', 'Paris', 'Lisbon', 'Barcelona', 'Prague', 'Vienna', 'Rome'];
const SLIDE_MS = 5600;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function countdown(iso: string) {
  const hours = (new Date(iso).getTime() - Date.now()) / 3600000;
  if (hours < 0) return 'Happening now';
  if (hours < 1) return `In ${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `In ${Math.round(hours)} ${Math.round(hours) === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

function HeroSlide({ gym, first, morph }: { gym: CardGym; first: boolean; morph: boolean }) {
  const status = useGymStatus(gym);
  const photo = <GymPhoto src={gym.photos[0]} name={gym.name} priority={first} sizes="(max-width: 700px) 150vw, 100vw" />;
  return (
    <Link href={`/gyms/${gym.slug}`} transitionTypes={['nav-forward']} className="hero-slide">
      {morph ? <SharedPhoto name={`gym-${gym.id}`} className="hero-photo">{photo}</SharedPhoto> : <div className="hero-photo">{photo}</div>}
      <i className="hero-shade" aria-hidden="true" />
      <div className="hero-copy">
        <p className="hero-meta">
          <RatingLine rating={gym.rating} count={gym.rating_count} />
          {gym.distance_km != null ? <span>{distanceLabel(Number(gym.distance_km))}</span> : null}
          <span className={`status-dot${status?.open ? ' is-open' : ''}`}>{status?.line ?? ' '}</span>
        </p>
        <h2>{gym.name}</h2>
        <div className="hero-actions">
          <span className="hero-price">{money(gym.price_cents)}</span>
          <span className="hero-cta">{status?.nextSlot ? `Book ${status.nextSlot.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}` : 'See times'} <i aria-hidden="true"><IconArrow /></i></span>
        </div>
      </div>
    </Link>
  );
}

// The opening screen: real gyms, full screen, moving on by themselves like stories until you touch them.
function Hero({ gyms, children, morphAllowed }: { gyms: CardGym[]; children: React.ReactNode; morphAllowed: (id: string) => boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAuto(true);
  }, []);

  useEffect(() => {
    if (!auto || gyms.length < 2) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el || document.hidden) return;
      const next = (indexRef.current + 1) % gyms.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, [auto, gyms.length]);

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const current = gyms[Math.min(index, gyms.length - 1)];

  return (
    <section className="hero" aria-label="Featured gyms" onPointerDown={() => setAuto(false)} onFocus={() => setAuto(false)}>
      <div className="hero-track" ref={track} onScroll={onScroll} tabIndex={0}>
        {gyms.map((g, i) => <HeroSlide key={g.id} gym={g} first={i === 0} morph={morphAllowed(g.id)} />)}
      </div>
      <div className="hero-bars" aria-hidden="true">
        {gyms.map((g, i) => <i key={g.id} className={i < index ? 'is-done' : i === index ? (auto ? 'is-running' : 'is-done') : ''} style={{ '--slide': `${SLIDE_MS}ms` } as React.CSSProperties} />)}
      </div>
      {children}
      {current ? <SaveButton gymId={current.id} name={current.name} /> : null}
    </section>
  );
}

function NextTicket({ next }: { next: NextBooking }) {
  const [when, setWhen] = useState('');
  useEffect(() => setWhen(countdown(next.starts_at)), [next.starts_at]);
  return (
    <Link href={`/bookings/${next.id}`} transitionTypes={['nav-forward']} className="next-ticket">
      <i className="foil-sweep" aria-hidden="true" />
      <div className="next-ticket-photo"><GymPhoto src={next.gym_photos[0]} name={next.gym_name} sizes="96px" /></div>
      <div className="next-ticket-copy">
        <small>{when || ' '}</small>
        <strong>{next.gym_name}</strong>
        <span>{dateLabel(next.starts_at, next.gym_timezone)}, {timeLabel(next.starts_at, next.gym_timezone)}</span>
      </div>
      <span className="next-ticket-open">Pass <IconArrow width={18} height={18} /></span>
    </Link>
  );
}

export function HomeClient({ picks, city }: { picks: CardGym[]; city: string }) {
  const { user, ready, next, toRate, unread, saved } = useSession();
  const [overlay, setOverlay] = useState(false);
  const [note, setNote] = useState('');
  const [local, setLocal] = useState<{ label: string; gyms: CardGym[] } | null>(null);
  const [savedGyms, setSavedGyms] = useState<CardGym[]>([]);
  const [hello, setHello] = useState('');
  const { toast } = useFeedback();

  useEffect(() => setHello(greeting()), []);

  // Show gyms around the person: their position if allowed, otherwise their saved home city.
  const loadNear = async (coords: { lat: number; lng: number }) => {
    const res = await fetch('/api/gyms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...coords, sort: 'recommended' }) });
    const d = await res.json();
    if (d.gyms?.length) {
      setLocal({ label: 'you', gyms: d.gyms.slice(0, 12) });
      return;
    }
    const found = await nearestCity(coords);
    if (!found) return;
    setResolvedCity(found);
    const c = await (await fetch(`/api/gyms?city=${encodeURIComponent(found)}`)).json();
    if (c.gyms?.length) setLocal({ label: c.place?.name ?? found, gyms: c.gyms.slice(0, 12) });
  };

  useEffect(() => {
    let live = true;
    (async () => {
      if (await locationAllowed()) {
        try {
          const c = await locate();
          if (live) await loadNear(c);
          return;
        } catch {}
      }
      const home = user?.home_city;
      if (home && home.toLowerCase() !== city.toLowerCase()) {
        const d = await (await fetch(`/api/gyms?city=${encodeURIComponent(home)}`)).json().catch(() => null);
        if (live && d?.gyms) setLocal({ label: d.place?.name ?? home, gyms: d.gyms.slice(0, 12) });
      }
    })().catch(() => {});
    return () => {
      live = false;
    };
    // Re-run if the saved home city changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const c = await locate();
      await loadNear(c);
      toast('Showing gyms around you');
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Location is off. Type a city instead.';
      toast(text, 'error');
      setNote(text);
      setOverlay(true);
    }
  };

  const shown = local?.gyms ?? picks;
  const place = local ? (local.label === 'you' ? 'near you' : `in ${local.label}`) : `in ${city}`;
  const featured = shown.slice(0, 5);
  const rest = shown.slice(5);
  const canMorph = (id: string) => !savedGyms.some((s) => s.id === id);
  const openCount = useMemo(() => (hello ? shown.filter((g) => gymStatus(g).open).length : null), [shown, hello]);

  return (
    <main className="home">
      <Hero gyms={featured} morphAllowed={canMorph}>
        <header className="hero-top">
          <div className="hero-hello">
            <p><Spark /> {ready && user ? `${hello}, ${user.name.split(' ')[0]}` : hello || ' '}</p>
            <small>{openCount === null ? ' ' : openCount === 0 ? 'Closed now. Book for tomorrow' : `${openCount} ${openCount === 1 ? 'gym' : 'gyms'} open ${place}`}</small>
          </div>
          <div className="home-actions">
            {user ? (
              <>
                <Link href="/inbox" className="round round-glass" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
                  <IconBell />{unread ? <b className="count-badge">{unread}</b> : null}
                </Link>
                <Link href="/account" className="avatar" aria-label="Account">{user.name.charAt(0).toUpperCase()}</Link>
              </>
            ) : ready ? (
              <Link href="/login?next=/home" className="home-login">Log in</Link>
            ) : null}
          </div>
        </header>
      </Hero>

      <div className="home-search">
        <button type="button" className="search-pill is-large" onClick={() => { setNote(''); setOverlay(true); }}>
          <IconSearch /> <span>Where are you training?</span>
        </button>
        <button type="button" className="round round-volt round-lg" aria-label="Gyms near me" onClick={nearMe}><IconLocate /></button>
      </div>

      <div className="home-body">
        {ready && next ? <NextTicket next={next} /> : null}

        {toRate ? (
          <Link href={`/bookings/${toRate.id}#rate`} className="rate-nudge">
            <span><strong>How was {toRate.gym_name}?</strong> Rate your visit out of 5.</span>
            <IconArrow />
          </Link>
        ) : null}

        {savedGyms.length ? (
          <section className="rail-section" aria-labelledby="saved">
            <div className="rail-head"><h2 id="saved">Saved</h2></div>
            <ul className="h-rail">{savedGyms.map((g) => <li key={g.id}><PickCard gym={g} /></li>)}</ul>
          </section>
        ) : null}

        {rest.length ? (
          <section className="rail-section" aria-labelledby="picks">
            <div className="rail-head">
              <h2 id="picks">More {place}</h2>
              <Link href={local?.label === 'you' ? '/gyms' : `/gyms?city=${encodeURIComponent(local?.label ?? city)}`} transitionTypes={['nav-tab']}>See all</Link>
            </div>
            <ul className="h-rail">{rest.map((g) => <li key={g.id}><PickCard gym={g} morph={canMorph(g.id)} /></li>)}</ul>
          </section>
        ) : null}

        <section className="rail-section" aria-labelledby="cities">
          <div className="rail-head"><h2 id="cities">Train anywhere</h2></div>
          <ul className="city-grid">
            {CITIES.map((c) => (
              <li key={c}>
                <Link href={`/gyms?city=${c}`} transitionTypes={['nav-tab']} className="city-tile">
                  <CityMark city={c} />
                  <span>{c}</span>
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
      </div>
      <SearchOverlay open={overlay} onClose={() => { setOverlay(false); setNote(''); }} note={note} />
    </main>
  );
}
