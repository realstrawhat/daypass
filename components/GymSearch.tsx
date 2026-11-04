'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceLabel, money, ratingLabel } from '@/lib/format';
import type { Gym, Sort } from '@/lib/gyms';
import { GymPhoto } from './GymPhoto';
import { IconArrow, IconList, IconLocate, IconMap, IconSearch, IconStar } from './Icons';

const GymMap = dynamic(() => import('./GymMap').then((m) => m.GymMap), { ssr: false, loading: () => <div className="map-wrap map-loading" /> });

type Prefs = { home_city: string | null; default_sort: string; max_price_cents: number | null } | null;
type Result = { gyms: Gym[]; total: number; page: number; pageSize: number; center: { lat: number; lng: number }; place: { name: string; country: string } | null };

const SORTS: { id: Sort; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'nearest', label: 'Nearest' },
  { id: 'price_asc', label: 'Lowest price' },
  { id: 'price_desc', label: 'Highest price' },
  { id: 'rating', label: 'Top rated' },
];
const PRICES = [{ v: null, l: 'Any price' }, { v: 1000, l: 'Up to €10' }, { v: 1500, l: 'Up to €15' }, { v: 2000, l: 'Up to €20' }];
const RATINGS = [{ v: null, l: 'Any rating' }, { v: 4, l: '4.0 and up' }, { v: 4.5, l: '4.5 and up' }];

export function GymSearch({ prefs }: { prefs: Prefs }) {
  const params = useSearchParams();
  const router = useRouter();
  const cityParam = params.get('city');
  const near = params.get('near') === 'me';

  const [mode, setMode] = useState<'ask' | 'ready'>(cityParam || near || prefs?.home_city ? 'ready' : 'ask');
  const [cityInput, setCityInput] = useState(cityParam ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState<string | null>(cityParam ?? (near ? null : prefs?.home_city ?? null));
  const [sort, setSort] = useState<Sort>((prefs?.default_sort as Sort) || 'recommended');
  const [maxPrice, setMaxPrice] = useState<number | null>(prefs?.max_price_cents ?? null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const listRef = useRef<HTMLDivElement>(null);
  const request = useRef(0);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setMode('ask');
      setNote('This browser cannot share your location. Type a city instead.');
      return;
    }
    setNote('Finding your location');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setNote('');
        setCity(null);
        setCityInput('');
        setBbox(null);
        setPage(1);
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setMode('ready');
      },
      () => {
        setMode('ask');
        setNote('Location is off. Type a city instead.');
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (!near || city) return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem('daypass-loc');
      sessionStorage.removeItem('daypass-loc');
    } catch {}
    if (stored) setCoords(JSON.parse(stored));
    else locate();
  }, [near, city, locate]);

  useEffect(() => {
    if (mode !== 'ready' || (!city && !coords)) return;
    const id = ++request.current;
    const q = new URLSearchParams({ sort, page: String(page) });
    if (city && !bbox) q.set('city', city);
    else if (coords || result?.center) {
      const c = coords ?? result!.center;
      q.set('lat', String(c.lat));
      q.set('lng', String(c.lng));
    }
    if (bbox) q.set('bbox', bbox.join(','));
    if (maxPrice != null) q.set('maxPrice', String(maxPrice));
    if (minRating != null) q.set('minRating', String(minRating));
    setLoading(true);
    setError('');
    fetch(`/api/gyms?${q}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data as Result;
      })
      .then((data) => {
        if (id !== request.current) return;
        setResult(data);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (id !== request.current) return;
        setError(e.message || 'Search did not finish. Try again.');
        setResult(null);
        setLoading(false);
      });
    // result.center is only a fallback for area searches, so it must not retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, city, coords, sort, page, maxPrice, minRating, bbox]);

  const submitCity = (e: React.FormEvent) => {
    e.preventDefault();
    const value = cityInput.trim();
    if (!value) return;
    setCoords(null);
    setBbox(null);
    setPage(1);
    setCity(value);
    setNote('');
    setMode('ready');
    router.replace(`/gyms?city=${encodeURIComponent(value)}`, { scroll: false });
  };

  const selectFromMap = (id: string) => {
    setActiveId(id);
    setView('list');
    requestAnimationFrame(() => document.getElementById(`gym-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const searchBar = (
    <form className="search-bar" onSubmit={submitCity} role="search">
      <IconSearch />
      <label htmlFor="city" className="sr">City</label>
      <input id="city" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="Type a city" autoComplete="address-level2" />
      <button type="button" className="search-locate" onClick={locate} aria-label="Use my location"><IconLocate /><span>Near me</span></button>
      <button type="submit" className="search-go">Search</button>
    </form>
  );

  if (mode === 'ask') {
    return (
      <main className="ask">
        <h1>Where do you want to train?</h1>
        <p>Share your location to see the closest gyms. It is used for this search only and never saved.</p>
        <button type="button" className="btn btn-volt ask-btn" onClick={locate}><IconLocate /> Use my location</button>
        <p className="ask-or">or type a city</p>
        {searchBar}
        {note ? <p className="note" role="status">{note}</p> : null}
        <ul className="chips ask-chips">
          {['Amsterdam', 'Berlin', 'Lisbon', 'Barcelona', 'Paris', 'Prague', 'Vienna', 'Rome'].map((c) => (
            <li key={c}><button type="button" className="chip" onClick={() => { setCityInput(c); setCity(c); setMode('ready'); router.replace(`/gyms?city=${c}`, { scroll: false }); }}>{c}</button></li>
          ))}
        </ul>
      </main>
    );
  }

  const heading = bbox ? 'Gyms in this area' : result?.place ? `Gyms in ${result.place.name}` : 'Gyms near you';
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <main className="search" data-view={view}>
      <div className="search-list" ref={listRef}>
        <i className="search-handle" aria-hidden="true" />
        <div className="search-head">
          <h1>{heading}</h1>
          {searchBar}
          {note ? <p className="note" role="status">{note}</p> : null}
          <div className="filters">
            <div className="filter-sort" role="group" aria-label="Sort gyms">
              {SORTS.map((s) => (
                <button key={s.id} type="button" className="chip" aria-pressed={sort === s.id} onClick={() => { setSort(s.id); setPage(1); }}>{s.label}</button>
              ))}
            </div>
            <div className="filter-selects">
              <label><span className="sr">Maximum price</span>
                <select value={maxPrice ?? ''} onChange={(e) => { setMaxPrice(e.target.value ? Number(e.target.value) : null); setPage(1); }}>
                  {PRICES.map((p) => <option key={p.l} value={p.v ?? ''}>{p.l}</option>)}
                </select>
              </label>
              <label><span className="sr">Minimum rating</span>
                <select value={minRating ?? ''} onChange={(e) => { setMinRating(e.target.value ? Number(e.target.value) : null); setPage(1); }}>
                  {RATINGS.map((p) => <option key={p.l} value={p.v ?? ''}>{p.l}</option>)}
                </select>
              </label>
            </div>
          </div>
          <p className="result-count" role="status" aria-live="polite">
            {loading ? 'Searching' : error ? '' : result ? `${result.total} ${result.total === 1 ? 'gym' : 'gyms'}${pages > 1 ? `, page ${result.page} of ${pages}` : ''}` : ''}
          </p>
        </div>

        {error ? (
          <div className="empty"><h2>No results</h2><p>{error}</p></div>
        ) : !loading && result && result.gyms.length === 0 ? (
          <div className="empty">
            <h2>No gyms match</h2>
            <p>{coords && !bbox ? 'Nothing within 25 km of you yet. Type a city to look elsewhere.' : 'Widen your filters, or move the map and search that area.'}</p>
            {maxPrice != null || minRating != null ? <button type="button" className="btn btn-ghost" onClick={() => { setMaxPrice(null); setMinRating(null); }}>Clear filters</button> : null}
          </div>
        ) : (
          <ul className={`gym-grid${loading ? ' is-loading' : ''}`}>
            {result?.gyms.map((g, i) => (
              <li key={g.id} id={`gym-${g.id}`}>
                <Link
                  href={`/gyms/${g.slug}`}
                  className={`gym-card${activeId === g.id ? ' is-active' : ''}${i % 5 === 1 ? ' is-volt' : ''}`}
                  onMouseEnter={() => setActiveId(g.id)}
                  onFocus={() => setActiveId(g.id)}
                >
                  <div className="gym-card-photo">
                    <GymPhoto src={g.photos[0]} name={g.name} priority={i < 2} sizes="(max-width: 520px) 92vw, (max-width: 1200px) 45vw, 24vw" />
                    <span className="gym-price">{money(g.price_cents)}</span>
                  </div>
                  <div className="gym-card-body">
                    <h2>{g.name}</h2>
                    <p className="gym-meta">
                      <span className="gym-rate"><IconStar /> {ratingLabel(g.rating)}</span>
                      {g.distance_km != null ? <span>{distanceLabel(Number(g.distance_km))} away</span> : null}
                    </p>
                    <i className="gym-go" aria-hidden="true"><IconArrow /></i>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && !error ? (
          <nav className="pager" aria-label="Result pages">
            <button type="button" className="btn btn-ghost" disabled={page <= 1 || loading} onClick={() => { setPage(page - 1); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>Previous page</button>
            <button type="button" className="btn btn-white" disabled={page >= pages || loading} onClick={() => { setPage(page + 1); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>Next page</button>
          </nav>
        ) : null}
        <p className="fine">Listings are sample data for this demo.</p>
      </div>

      <aside className="search-map" aria-label="Map">
        <GymMap
          gyms={result?.gyms ?? []}
          center={result?.center ?? coords}
          activeId={activeId}
          onSelect={selectFromMap}
          onAreaSearch={(b) => { setBbox(b); setPage(1); }}
        />
      </aside>

      <button type="button" className="view-toggle" onClick={() => setView(view === 'list' ? 'map' : 'list')}>
        {view === 'list' ? <><IconMap /> Show map</> : <><IconList /> Show list</>}
      </button>
    </main>
  );
}
