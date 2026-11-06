'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, timeLabel } from '@/lib/format';
import { daysUntil, hoursUntil } from '@/lib/hours';
import { CityMark } from './CityMark';
import { FeatureCard, PickCard, type CardGym } from './GymCard';
import { GymPhoto } from './GymPhoto';
import { IconArrow, IconBell, IconHeart, IconLocate, IconSearch, Spark } from './Icons';
import { generalArea, locate, locationAllowed, nearestCity, setResolvedCity } from './location';
import { useSession, type NextBooking } from './session';
import { useFeedback } from './ui/feedback';
import { ScrollArrows } from './ui/Rail';
import { TimeLeft } from './ui/StayTimer';

const SearchOverlay = dynamic(() => import('./SearchOverlay').then((m) => m.SearchOverlay), { ssr: false });

const CITIES = ['Amsterdam', 'Berlin', 'Paris', 'Lisbon', 'Barcelona', 'Prague', 'Vienna', 'Rome'];

const MOVES = [
  { title: 'Lift heavy', note: 'heavy days', kit: 'Squat racks', img: '/cutouts/lift.webp', tone: 'is-lime', tall: true },
  { title: 'Core and mat', note: 'just breathe', kit: 'Yoga room', img: '/cutouts/core.webp', tone: 'is-pale', tall: false },
  { title: 'Kettlebells', note: 'stronger every day', kit: 'Kettlebells', img: '/cutouts/kettlebell.webp', tone: 'is-lime', tall: true },
  { title: 'Sled and sprint', note: 'push it', kit: 'Sled track', img: '/cutouts/sled.webp', tone: 'is-dark', tall: false },
];

type Local = { label: string; gyms: CardGym[]; source: 'exact' | 'home' | 'area' };

// Coming back to Home shows the last answer straight away, then checks it again.
let homeMemory: Local | null = null;

// Counted on the gym's calendar, so a session tomorrow evening is one day away, not two.
function untilSession(iso: string, tz: string) {
  const hours = hoursUntil(iso);
  if (hours < 0) return { n: 'Now', unit: 'happening' };
  const days = daysUntil(iso, tz);
  if (days >= 1) return { n: String(days), unit: days === 1 ? 'day to go' : 'days to go' };
  if (hours < 1) return { n: String(Math.max(1, Math.round(hours * 60))), unit: 'minutes to go' };
  return { n: String(Math.round(hours)), unit: Math.round(hours) === 1 ? 'hour to go' : 'hours to go' };
}

function useHeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  // Plays only while on screen, and stays still for reduced motion and data saver.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const watch = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) v.pause();
      else if (!calm && !saving) v.play().catch(() => {});
    }, { threshold: 0.15 });
    watch.observe(v);
    return () => watch.disconnect();
  }, []);

  return (
    <>
      <picture>
        <source media="(orientation: portrait)" srcSet="/video/hero-portrait.jpg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vhero-poster" src="/video/hero-wide.jpg" alt="" fetchPriority="high" />
      </picture>
      <video ref={video} className={`vhero-video${started ? ' is-on' : ''}`} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} onPlaying={() => setStarted(true)}>
        <source media="(orientation: portrait)" src="/video/hero-portrait.mp4" type="video/mp4" />
        <source src="/video/hero-wide.mp4" type="video/mp4" />
      </video>
      <i className="vhero-shade" aria-hidden="true" />
    </>
  );
}

function NextCard({ next }: { next: NextBooking }) {
  const [when, setWhen] = useState<{ n: string; unit: string } | null>(null);
  useEffect(() => {
    const update = () => setWhen(untilSession(next.starts_at, next.gym_timezone));
    update();
    const t = setInterval(update, 60000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', update);
    };
  }, [next.starts_at, next.gym_timezone]);
  return (
    <Link href={`/bookings/${next.id}`} transitionTypes={['nav-forward']} className="next-photo">
      <GymPhoto src={next.gym_photos[0]} name={next.gym_name} sizes="(max-width: 860px) 130vw, 900px" />
      <i className="next-photo-shade" aria-hidden="true" />
      <p className="next-number" aria-label={when ? `${when.n} ${when.unit}` : undefined}><strong>{when?.n ?? ' '}</strong><small>{when?.unit ?? ' '}</small></p>
      <div className="next-photo-copy">
        <div>
          <h2>{next.gym_name}</h2>
          <p>{dateLabel(next.starts_at, next.gym_timezone)} at {timeLabel(next.starts_at, next.gym_timezone)}, {next.gym_city}</p>
        </div>
        <span className="next-photo-open" aria-hidden="true"><IconArrow /></span>
      </div>
    </Link>
  );
}

function RailSection({ id, title, action, children }: { id: string; title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  return (
    <section className="rail-section" aria-labelledby={id}>
      <div className="rail-head">
        <h2 id={id}>{title}</h2>
        <div className="rail-tools">{action}<ScrollArrows target={track} label="Scroll this row" /></div>
      </div>
      <ul className="h-rail" ref={track}>{children}</ul>
    </section>
  );
}

function FeaturedRail({ gyms, heading, showCity, morphAllowed, onLocate, askLocation }: { gyms: CardGym[]; heading: string; showCity: boolean; morphAllowed: (id: string) => boolean; onLocate: () => void; askLocation: { lead: string; action: string } | null }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const onScroll = () => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    // On wide screens the last cards can't reach the start, so the end of the row counts as the last dot.
    setIndex(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 ? gyms.length - 1 : Math.round(el.scrollLeft / (first.offsetWidth + 12)));
  };
  return (
    <section className="featured" aria-labelledby="featured-title">
      <div className="rail-head">
        <div>
          <h2 id="featured-title" className="two-tone">Find your <em>next gym</em></h2>
          <p className="featured-where">{heading}</p>
        </div>
        <ScrollArrows target={track} label="Scroll featured gyms" />
      </div>
      {askLocation ? <button type="button" className="where-note" onClick={onLocate}><IconLocate /> <span>{askLocation.lead} <b>{askLocation.action}</b></span></button> : null}
      <ul className="featured-track" ref={track} onScroll={onScroll} tabIndex={0}>
        {gyms.map((g, i) => <li key={g.id} className="featured-item"><FeatureCard gym={g} priority={i < 1} morph={morphAllowed(g.id)} showCity={showCity} /></li>)}
      </ul>
      <div className="featured-dots" aria-hidden="true">
        {gyms.map((g, i) => <i key={g.id} className={i === index ? 'on' : ''} />)}
      </div>
    </section>
  );
}

function RailSkeleton() {
  return (
    <section className="featured" aria-busy="true" aria-label="Finding gyms near you">
      <div className="rail-head"><div><h2 className="two-tone">Find your <em>next gym</em></h2><p className="featured-where"><span className="sk sk-word" /></p></div></div>
      <div className="featured-track"><div className="featured-item"><span className="sk feature-sk" /></div><div className="featured-item"><span className="sk feature-sk" /></div></div>
    </section>
  );
}

export function HomeClient({ picks }: { picks: CardGym[] }) {
  const { user, ready, next, inGym, toRate, unread, saved } = useSession();
  const hero = useHeroVideo();
  const [overlay, setOverlay] = useState(false);
  const [note, setNote] = useState('');
  const [local, setLocalState] = useState<Local | null>(homeMemory);
  const [finding, setFinding] = useState(!homeMemory);
  const exactFound = useRef(false);
  const setLocal = (next: Local) => {
    homeMemory = next;
    setLocalState(next);
  };
  const [savedGyms, setSavedGyms] = useState<CardGym[]>([]);
  const { toast } = useFeedback();

  const cityGyms = async (name: string, country: string | null, source: Local['source']): Promise<Local | null> => {
    const res = await fetch(`/api/gyms?city=${encodeURIComponent(name)}${country ? `&country=${encodeURIComponent(country)}` : ''}`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.gyms?.length ? { label: d.place?.name ?? name, gyms: d.gyms.slice(0, 12), source } : null;
  };

  const loadNear = async (coords: { lat: number; lng: number }) => {
    const res = await fetch('/api/gyms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...coords, sort: 'recommended' }) });
    if (!res.ok) return false;
    const d = await res.json();
    if (d.gyms?.length) {
      exactFound.current = true;
      setLocal({ label: 'you', gyms: d.gyms.slice(0, 12), source: 'exact' });
      return true;
    }
    const found = await nearestCity(coords);
    if (!found) return false;
    setResolvedCity(found);
    const city = await cityGyms(found, null, 'exact');
    if (city) {
      exactFound.current = true;
      setLocal(city);
    }
    return !!city;
  };

  // The saved home city or the general area from the network shows straight away. Exact location, when it was
  // allowed, can take seconds and replaces them when it arrives. If nothing is known, the screen says so
  // instead of guessing a city.
  useEffect(() => {
    if (!ready) return;
    let live = true;
    (async () => {
      if (!(await locationAllowed())) return;
      const c = await locate();
      if (live && (await loadNear(c))) setFinding(false);
    })().catch(() => {});
    (async () => {
      const home = user?.home_city;
      const area = home ? null : await generalArea();
      const found = home ? await cityGyms(home, null, 'home') : area ? await cityGyms(area.city, area.country, 'area') : null;
      if (live && found && !exactFound.current && homeMemory?.source !== 'exact') setLocal(found);
    })()
      .catch(() => {})
      .finally(() => {
        if (live) setFinding(false);
      });
    return () => {
      live = false;
    };
    // Re-run if the saved home city changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.home_city]);

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
    let coords;
    try {
      coords = await locate();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Location is off. Type a city instead.';
      toast(text, 'error');
      setNote(text);
      setOverlay(true);
      return;
    }
    const found = await loadNear(coords).catch(() => false);
    setFinding(false);
    if (found) toast('Showing gyms around you');
    else toast('Gyms near you did not load. Try typing a city.', 'error');
  };

  const shown = local?.gyms ?? picks;
  const place = !local ? null : local.label === 'you' ? 'near you' : `in ${local.label}`;
  const heading = place ? `Top picks ${place}` : 'Top rated across Europe';
  const askLocation = !local ? { lead: 'We don’t know where you are yet.', action: 'Use my location' } : local.source === 'area' ? { lead: `${local.label} is your general area.`, action: 'Use my exact location' } : null;
  const featured = shown.slice(0, 5);
  const rest = shown.slice(5);
  const searchQuery = !local ? '' : local.label === 'you' ? 'near=1&' : `city=${encodeURIComponent(local.label)}&`;
  // A photo can only morph from one card on a screen, so a saved gym's copy here stays still.
  const canMorph = (id: string) => !savedGyms.some((s) => s.id === id);

  return (
    <main className="home">
      <section className="vhero" aria-labelledby="home-title">
        {hero}
        <header className="home-top">
          <p className="home-brand"><Spark /> {!ready ? <span className="sk sk-word" /> : user ? `Hi ${user.name.split(' ')[0]}` : 'Daypass'}</p>
          <div className="home-actions">
            {user ? (
              <>
                <Link href="/saved" className="round round-frost" aria-label={saved.length ? `Saved gyms, ${saved.length}` : 'Saved gyms'}>
                  <IconHeart filled={saved.length > 0} width={20} height={20} />
                </Link>
                <Link href="/inbox" className="round round-frost" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
                  <IconBell />{unread ? <b className="count-badge">{unread}</b> : null}
                </Link>
                <Link href="/account" className="avatar" aria-label="Account">{user.name.charAt(0).toUpperCase()}</Link>
              </>
            ) : ready ? (
              <Link href="/login?next=/home" className="home-login">Log in</Link>
            ) : null}
          </div>
        </header>

        <div className="vhero-copy">
          {ready && inGym ? (
            <Link href={`/bookings/${inGym.id}`} transitionTypes={['nav-forward']} className="vhero-next is-live">
              <b className="live-dot" aria-hidden="true" />
              <span>{inGym.gym_name} <TimeLeft from={inGym.checked_in_at} /></span>
              <i aria-hidden="true"><IconArrow width={16} height={16} /></i>
            </Link>
          ) : null}
          {ready && next ? (
            <Link href={`/bookings/${next.id}`} transitionTypes={['nav-forward']} className="vhero-next">
              <span>Next: {next.gym_name}, {dateLabel(next.starts_at, next.gym_timezone)}, {timeLabel(next.starts_at, next.gym_timezone)}</span>
              <i aria-hidden="true"><IconArrow width={16} height={16} /></i>
            </Link>
          ) : null}
          <p className="hand vhero-note">
            no membership, no catch
            <svg viewBox="0 0 180 14" aria-hidden="true"><path d="M2 9c30-6 58-7 84-4s58 5 92-2" /></svg>
          </p>
          <h1 id="home-title" className="home-title"><span>One gym.</span><span>One day.</span><em>No contract.</em></h1>
          <div className="home-search">
            <button type="button" className="search-pill is-large" onClick={() => { setNote(''); setOverlay(true); }}>
              <IconSearch /> <span>Where are you training?</span>
            </button>
            <button type="button" className="round home-locate" aria-label="Gyms near me" onClick={nearMe}><IconLocate /></button>
          </div>
        </div>
      </section>

      {ready && next ? <NextCard next={next} /> : null}

      {toRate ? (
        <Link href={`/bookings/${toRate.id}#rate`} className="rate-nudge">
          <span><strong>How was {toRate.gym_name}?</strong> Rate your visit out of 5.</span>
          <IconArrow />
        </Link>
      ) : null}

      {finding ? <RailSkeleton /> : featured.length ? <FeaturedRail gyms={featured} heading={heading} showCity={!local} morphAllowed={canMorph} onLocate={nearMe} askLocation={askLocation} /> : (
        <div className="empty">
          <h2>Gyms did not load</h2>
          <p>Check your signal, or search for a city.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setOverlay(true)}>Search a city</button>
        </div>
      )}

      <section className="moves-section" aria-labelledby="moves-title">
        <h2 id="moves-title" className="two-tone">Train <em>your way</em></h2>
        <ul className="moves">
          {MOVES.map((m) => (
            <li key={m.title} className={m.tall ? 'is-tall' : ''}>
              <Link href={`/gyms?${searchQuery}equipment=${encodeURIComponent(m.kit)}`} transitionTypes={['nav-tab']} className={`move ${m.tone}`}>
                <span className="hand move-note">{m.note}</span>
                <Image className="move-img" src={m.img} alt="" fill sizes="(max-width: 860px) 60vw, 320px" />
                <span className="move-foot"><strong>{m.title}</strong><i aria-hidden="true"><IconArrow /></i></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {!finding && rest.length ? (
        <RailSection
          id="picks"
          title={place ? `More ${place}` : 'More top gyms'}
          action={local ? <Link href={local.label === 'you' ? '/gyms?near=1' : `/gyms?city=${encodeURIComponent(local.label)}`} transitionTypes={['nav-tab']}>See all</Link> : null}
        >
          {rest.map((g) => <li key={g.id}><PickCard gym={g} morph={canMorph(g.id)} /></li>)}
        </RailSection>
      ) : null}

      <RailSection id="cities" title={<span className="two-tone">Train <em>anywhere</em></span>}>
        {CITIES.map((c) => (
          <li key={c}>
            <Link href={`/gyms?city=${c}`} transitionTypes={['nav-tab']} className="city-card">
              <Image src={`/cities/${c.toLowerCase()}.jpg`} alt="" fill sizes="190px" />
              <i className="city-card-shade" aria-hidden="true" />
              <CityMark city={c} size={30} />
              <span>{c}</span>
            </Link>
          </li>
        ))}
      </RailSection>

      {savedGyms.length ? (
        <RailSection id="saved" title={<span className="two-tone">Your <em>saved gyms</em></span>} action={<Link href="/saved">See all</Link>}>
          {savedGyms.slice(0, 12).map((g) => <li key={g.id}><PickCard gym={g} /></li>)}
        </RailSection>
      ) : null}

      <Link href="/partners" className="home-partner">
        <i className="glow-blob" aria-hidden="true" />
        <strong>Own a gym?</strong>
        <span>List it for free and set your own price. You pay 15% only when someone books.</span>
      </Link>
      <p className="fine home-fine">Student project demo. Gyms are sample data, and payments, Wallet and email are simulated. <Link href="/credits" className="link">Photo and video credits</Link></p>
      <SearchOverlay open={overlay} onClose={() => { setOverlay(false); setNote(''); }} note={note} />
    </main>
  );
}
