'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { distanceLabel, money } from '@/lib/format';
import { gymStatus } from '@/lib/hours';
import type { Gym, Sort } from '@/lib/gyms';
import { CityMark } from './CityMark';
import { ScrollArrows } from './ui/Rail';
import { FilterSheet, filterCount, NO_FILTERS, type Filters } from './FilterSheet';
import { GymCard, RatingLine } from './GymCard';
import { GymPhoto } from './GymPhoto';
import { IconClose, IconExpand, IconList, IconLocate, IconMap, IconSearch, IconSliders } from './Icons';
import { type Area, getLastCoords, getResolvedCity, kmBetween, locate, locationAllowed, nearestCity, watchLocation, generalArea, placeUrl } from './location';
import { SearchOverlay } from './SearchOverlay';
import { useSession } from './session';
import { haptic, useFeedback } from './ui/feedback';

const GymMap = dynamic(() => import('./GymMap').then((m) => m.GymMap), { ssr: false, loading: () => <div className="map-wrap map-loading" /> });

type Result = { gyms: Gym[]; total: number; page: number; pageSize: number; center: { lat: number; lng: number }; place: { name: string; country: string } | null };

const SORTS: { id: Sort; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'nearest', label: 'Nearest' },
  { id: 'price_asc', label: 'Lowest price' },
  { id: 'rating', label: 'Top rated' },
  { id: 'price_desc', label: 'Highest price' },
];

// Results stay in memory for the visit, so going back to a search is instant and keeps its place.
const cache = new Map<string, { result: Result; gyms: Gym[]; page: number }>();

const validNumber = (v: string | null) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

async function fetchPage(params: URLSearchParams, coords: { lat: number; lng: number } | null): Promise<Result> {
  const res = await (coords
    ? fetch('/api/gyms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(params), ...coords }) })
    : fetch(`/api/gyms?${params}`)).catch(() => {
    throw new Error('No connection. Check your signal and try again.');
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || 'Search did not finish. Try again.');
  return data;
}

const apiParams = (q: { city: string | null; country: string | null; sort: Sort; filters: Filters; area: string | null }, page = 1) => {
  const p = new URLSearchParams({ sort: q.sort, page: String(page) });
  if (q.city) p.set('city', q.city);
  if (q.country) p.set('country', q.country);
  if (q.area) p.set('bbox', q.area);
  if (q.filters.maxPrice != null) p.set('maxPrice', String(q.filters.maxPrice));
  if (q.filters.minRating != null) p.set('minRating', String(q.filters.minRating));
  if (q.filters.openNow) p.set('openNow', '1');
  if (q.filters.equipment.length) p.set('equipment', q.filters.equipment.join('|'));
  return p;
};

export function GymSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, ready } = useSession();
  const { toast } = useFeedback();

  const near = params.get('near') === '1';
  const urlCity = params.get('city');
  const area = params.get('area');
  const country = params.get('country');
  // A saved home city is the default when no search was asked for.
  const city = urlCity ?? (!near && ready ? user?.home_city ?? null : null);
  const sort = (params.get('sort') as Sort) || (user?.default_sort as Sort) || 'recommended';
  const paramEquipment = params.get('equipment');
  const filters = useMemo<Filters>(() => ({
    // "any" means the person cleared their saved price limit for this search.
    maxPrice: params.get('maxPrice') === 'any' ? null : validNumber(params.get('maxPrice')) ?? user?.max_price_cents ?? null,
    minRating: validNumber(params.get('minRating')),
    openNow: params.get('openNow') === '1',
    equipment: paramEquipment ? paramEquipment.split('|') : [],
  }), [params, paramEquipment, user?.max_price_cents]);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() => (near ? getLastCoords() : null));
  const [locError, setLocError] = useState('');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(() => getLastCoords());
  const [locating, setLocating] = useState(false);
  const hasSearch = !!city || (near && !!coords);
  const key = useMemo(() => JSON.stringify({ city, country, area, sort, filters, coords: near ? coords : null }), [city, country, area, sort, filters, coords, near]);

  const cached = cache.get(key);
  const [result, setResult] = useState<Result | null>(cached?.result ?? null);
  const [gyms, setGyms] = useState<Gym[]>(cached?.gyms ?? []);
  const [page, setPage] = useState(cached?.page ?? 1);
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [overlay, setOverlay] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const request = useRef(0);
  const keyRef = useRef(key);
  keyRef.current = key;
  const sentinel = useRef<HTMLDivElement>(null);
  const topMark = useRef<HTMLDivElement>(null);
  const sortRow = useRef<HTMLDivElement>(null);
  const [roughCity, setRoughCity] = useState<Area | null>(null);
  const moreLock = useRef(false);

  // Update the address bar rather than navigate, so Back returns to this exact search.
  const setQuery = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    // Passing null is what makes the router see the new address. Passing the current state hides it.
    window.history.replaceState(null, '', `/gyms?${next}`);
  }, []);

  const applyFilters = (f: Filters) => {
    setQuery({
      maxPrice: f.maxPrice != null ? String(f.maxPrice) : user?.max_price_cents != null ? 'any' : null,
      minRating: f.minRating != null ? String(f.minRating) : null,
      openNow: f.openNow ? '1' : null,
      equipment: f.equipment.length ? f.equipment.join('|') : null,
    });
  };

  // Once location is allowed the app never asks again: it finds you, then keeps up as you move.
  // Before that it opens the person's general area from their network, and offers exact location after.
  const [autoChecked, setAutoChecked] = useState(false);
  const [locFailed, setLocFailed] = useState(false);
  // The city opened from the network. The note about it only applies while that city is showing.
  const [areaCity, setAreaCity] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let stop = () => {};
    locationAllowed().then(async (ok) => {
      if (!live) return;
      if (!ok) {
        setMe(null);
        const rough = !urlCity && !near && !area && !user?.home_city ? await generalArea() : null;
        if (!live) return;
        const current = new URLSearchParams(window.location.search);
        if (rough && !current.get('city') && !current.get('near') && !current.get('area')) {
          setAreaCity(rough.city);
          router.replace(placeUrl({ city: rough.city, country: rough.country }));
          // The ask screen must not flash while the address changes.
          return;
        }
        setAutoChecked(true);
        return;
      }
      try {
        const c = await locate();
        if (!live) return;
        setMe(c);
        stop = watchLocation((moved) => {
          setMe(moved);
          // In near-me mode, refresh the gyms after moving a real distance.
          setCoords((cur) => (cur && kmBetween(cur, moved) > 0.8 ? moved : cur));
        });
        // Check the address again: the person may have picked a city while we were locating them.
        const current = new URLSearchParams(window.location.search);
        if (!current.get('city') && !current.get('near') && !current.get('area')) {
          const known = getResolvedCity();
          setCoords(c);
          router.replace(placeUrl(known ? { city: known } : { near: '1' }));
        }
      } catch {
        if (live) setLocFailed(true);
      } finally {
        if (live) setAutoChecked(true);
      }
    });
    return () => {
      live = false;
      stop();
    };
    // Runs once when Find opens and the session is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Without exact location, the network still gives a rough city to offer.
  useEffect(() => {
    generalArea().then(setRoughCity);
  }, []);

  useEffect(() => {
    if (!near || coords) return;
    let live = true;
    locate().then((c) => {
      if (!live) return;
      setCoords(c);
      setMe(c);
    }).catch((e: Error) => {
      if (!live) return;
      setLocError(e.message);
      setLocFailed(true);
      setOverlay(true);
    });
    return () => {
      live = false;
    };
  }, [near, coords]);

  useEffect(() => {
    if (!hasSearch) return;
    const hit = cache.get(key);
    if (hit) {
      // A slower, older search must not replace this one when it lands.
      request.current += 1;
      setResult(hit.result);
      setGyms(hit.gyms);
      setPage(hit.page);
      setLoading(false);
      setError('');
      return;
    }
    const id = ++request.current;
    setLoading(true);
    setError('');
    fetchPage(apiParams({ city, country, sort, filters, area }), near ? coords : null)
      .then(async (data) => {
        if (id !== request.current) return;
        // Nothing listed near you yet: open your city, which fills in sample gyms.
        if (near && coords && !area && data.total === 0 && filterCount(filters) === 0) {
          const found = await nearestCity(coords);
          if (id !== request.current) return;
          if (found) {
            toast(`Showing gyms in ${found}`);
            router.replace(`/gyms?city=${encodeURIComponent(found)}`);
            return;
          }
        }
        cache.set(key, { result: data, gyms: data.gyms, page: 1 });
        setResult(data);
        setGyms(data.gyms);
        setPage(1);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (id !== request.current) return;
        // The person typed nothing, so "check the spelling" would make no sense. Ask them instead.
        if (areaCity && urlCity === areaCity) {
          setAreaCity(null);
          setAutoChecked(true);
          setLoading(false);
          router.replace('/gyms');
          return;
        }
        setError(e.message || 'Search did not finish. Try again.');
        setResult(null);
        setGyms([]);
        setLoading(false);
      });
    // key already covers every input to this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hasSearch, retry]);

  useEffect(() => {
    if (!hasSearch) return;
    try {
      sessionStorage.setItem('daypass-last-search', window.location.search);
    } catch {}
  }, [key, hasSearch]);

  const total = result?.total ?? 0;
  const hasMore = gyms.length < total;

  const loadMore = useCallback(async () => {
    if (moreLock.current || !hasMore || loading) return;
    moreLock.current = true;
    setLoadingMore(true);
    const startedFor = key;
    try {
      const nextPage = page + 1;
      const data = await fetchPage(apiParams({ city, country, sort, filters, area }, nextPage), near ? coords : null);
      if (keyRef.current !== startedFor) return;
      if (!data.gyms.length) {
        setResult((r) => (r ? { ...r, total: gyms.length } : r));
        return;
      }
      setGyms((prev) => {
        const seen = new Set(prev.map((g) => g.id));
        const merged = [...prev, ...data.gyms.filter((g) => !seen.has(g.id))];
        if (result) cache.set(key, { result, gyms: merged, page: nextPage });
        return merged;
      });
      setPage(nextPage);
    } catch {
      toast('More gyms did not load. Scroll to try again.', 'error');
    } finally {
      moreLock.current = false;
      setLoadingMore(false);
    }
    // Same inputs as the search above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, page, key, result]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  // The Map button only appears once the map has scrolled out of sight.
  useEffect(() => {
    const el = topMark.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowPill(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [hasSearch]);

  const countFor = useCallback(async (f: Filters) => {
    try {
      const data = await fetchPage(apiParams({ city, country, sort, filters: f, area }), near ? coords : null);
      return data.total;
    } catch {
      return null;
    }
    // Reads the current search location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, country, sort, area, near, coords]);

  const nearMe = async () => {
    setLocating(true);
    try {
      const c = await locate();
      setLocFailed(false);
      setAreaCity(null);
      setCoords(c);
      setMe(c);
      haptic(8);
      router.replace(placeUrl({ near: '1' }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Location is off. Type a city instead.', 'error');
    } finally {
      setLocating(false);
    }
  };

  const selectPin = (id: string) => {
    haptic(6);
    setActiveId(id);
    setSelected(id);
    if (window.matchMedia('(max-width: 860px)').matches) setView('map');
  };

  const heading = area ? 'This area' : result?.place?.name ?? (near ? 'Near you' : city ?? 'Finding you');
  const selectedGym = gyms.find((g) => g.id === selected) ?? null;
  const count = filterCount(filters);
  const removeEquipment = (k: string) => applyFilters({ ...filters, equipment: filters.equipment.filter((e) => e !== k) });

  const overlays = (
    <>
      <SearchOverlay open={overlay} onClose={() => { setOverlay(false); setLocError(''); }} note={locError} />
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filters} onApply={applyFilters} countFor={countFor} />
    </>
  );

  if (!hasSearch && ready && autoChecked && (locFailed || (!near && !me))) {
    return (
      <main className="ask">
        <span className="ask-glow" aria-hidden="true" />
        <h1>Where do you want to train?</h1>
        <p>Share your location to see the closest gyms. It is used while you search and never saved.</p>
        <button type="button" className="btn btn-volt ask-btn" onClick={nearMe}><IconLocate /> Use my location</button>
        {roughCity ? <button type="button" className="btn btn-white ask-btn" onClick={() => { setAreaCity(roughCity.city); router.replace(placeUrl({ city: roughCity.city, country: roughCity.country })); }}>Gyms in {roughCity.city}, my general area</button> : null}
        <button type="button" className="btn btn-ghost ask-btn" onClick={() => setOverlay(true)}><IconSearch /> Search a city</button>
        {overlays}
      </main>
    );
  }

  return (
    <main
      className="search"
      data-view={view}
      onClickCapture={(e) => {
        // Tells the gym page its back arrow can step back to this exact place in the list.
        if (!(e.target as Element).closest?.('a[href^="/gyms/"]')) return;
        try {
          sessionStorage.setItem('daypass-from-search', '1');
        } catch {}
      }}
    >
      <aside className="search-map" aria-label="Map">
        <GymMap
          gyms={gyms}
          center={result?.center ?? coords}
          activeId={activeId}
          onSelect={selectPin}
          onBackground={() => setSelected(null)}
          onAreaSearch={(b) => setQuery({ area: b.join(','), city: urlCity })}
          padding={{ top: 72, bottom: view === 'map' ? 200 : 72, left: 40, right: 40 }}
          me={me}
          onLocate={nearMe}
          locating={locating}
        />
        {view === 'list' ? (
          <button type="button" className="round round-glass map-expand" aria-label="Show full map" onClick={() => { setView('map'); haptic(6); }}><IconExpand /></button>
        ) : (
          <div className="map-topbar">
            <button type="button" className="search-pill" onClick={() => setOverlay(true)}>
              <IconSearch /> <span>{heading}</span>
            </button>
            <button type="button" className="round round-solid" aria-label={`Filters${count ? `, ${count} on` : ''}`} onClick={() => setFiltersOpen(true)}>
              <IconSliders />{count ? <b className="count-badge">{count}</b> : null}
            </button>
          </div>
        )}
        {selectedGym ? <PinPreview key={selectedGym.id} gym={selectedGym} onClose={() => setSelected(null)} /> : null}
      </aside>

      <div className="search-list">
        <div ref={topMark} className="search-top-mark" aria-hidden="true" />
        <i className="sheet-handle" aria-hidden="true" />
        <div className="search-head">
          <div className="search-bar-row">
            <button type="button" className="search-pill" onClick={() => setOverlay(true)}>
              <IconSearch /> <span>{heading}</span>
            </button>
            <button type="button" className="round round-solid" aria-label={`Filters${count ? `, ${count} on` : ''}`} onClick={() => setFiltersOpen(true)}>
              <IconSliders />{count ? <b className="count-badge">{count}</b> : null}
            </button>
          </div>
          <div className="chips-row">
            <div className="filter-sort" role="group" aria-label="Sort gyms" ref={sortRow}>
              {SORTS.map((s) => (
                <button key={s.id} type="button" className="chip" aria-pressed={sort === s.id} onClick={() => { setQuery({ sort: s.id }); haptic(4); }}>{s.label}</button>
              ))}
            </div>
            <ScrollArrows target={sortRow} label="Scroll sort options" />
          </div>
          {count ? (
            <ul className="applied" aria-label="Active filters">
              {filters.maxPrice != null ? <li><button type="button" onClick={() => applyFilters({ ...filters, maxPrice: null })}>Up to {money(filters.maxPrice)} <IconClose width={14} height={14} /></button></li> : null}
              {filters.minRating != null ? <li><button type="button" onClick={() => applyFilters({ ...filters, minRating: null })}>{filters.minRating.toFixed(1)}+ <IconClose width={14} height={14} /></button></li> : null}
              {filters.openNow ? <li><button type="button" onClick={() => applyFilters({ ...filters, openNow: false })}>Open now <IconClose width={14} height={14} /></button></li> : null}
              {filters.equipment.map((k) => <li key={k}><button type="button" onClick={() => removeEquipment(k)}>{k} <IconClose width={14} height={14} /></button></li>)}
            </ul>
          ) : null}
        </div>
        {areaCity && urlCity === areaCity ? <button type="button" className="where-note" onClick={nearMe}><IconLocate /> <span>{urlCity} is your general area. Use my exact location</span></button> : null}
        <h1 className="search-title" aria-live="polite">
          {loading ? <span className="sk sk-line" /> : <>{result?.place?.name ? <CityMark city={result.place.name} size={34} /> : null}<span>{error ? heading : `${total} ${total === 1 ? 'gym' : 'gyms'} ${near && !result?.place ? 'near you' : area ? 'in this area' : `in ${heading}`}`}</span></>}
        </h1>

        {error ? (
          <div className="empty"><h2>No results</h2><p>{error}</p><button type="button" className="btn btn-volt" onClick={() => setRetry((r) => r + 1)}>Try again</button><button type="button" className="btn btn-ghost" onClick={() => setOverlay(true)}>Search another city</button></div>
        ) : loading ? (
          <ul className="gym-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <li key={i} className="gym-skeleton"><span className="sk sk-photo" /><span className="sk sk-line" /><span className="sk sk-line is-short" /></li>)}</ul>
        ) : gyms.length === 0 ? (
          <div className="empty">
            <h2>No gyms match</h2>
            <p>{count ? 'Try removing a filter.' : 'Move the map and search that area, or try another city.'}</p>
            {count ? <button type="button" className="btn btn-ghost" onClick={() => applyFilters(NO_FILTERS)}>Clear filters</button> : <button type="button" className="btn btn-ghost" onClick={() => setOverlay(true)}>Search another city</button>}
          </div>
        ) : (
          <ul className="gym-grid">
            {gyms.map((g, i) => (
              <li key={g.id} id={`gym-${g.id}`} className="reveal-in">
                <GymCard gym={g} active={activeId === g.id} priority={i < 2} onHover={() => setActiveId(g.id)} />
              </li>
            ))}
          </ul>
        )}
        <div ref={sentinel} className="load-more" aria-live="polite">{loadingMore ? <span className="spinner" aria-label="Loading more gyms" /> : null}</div>
        {!loading && !hasMore && gyms.length > 0 ? <p className="fine end-note">That is every gym here. Listings are sample data for this demo.</p> : null}
      </div>

      <button type="button" className={`view-toggle${view === 'map' || showPill ? ' is-on' : ''}`} tabIndex={view === 'map' || showPill ? 0 : -1} onClick={() => { const v = view === 'list' ? 'map' : 'list'; setView(v); setSelected(null); haptic(6); if (v === 'map') window.scrollTo({ top: 0 }); }}>
        {view === 'list' ? <><IconMap /> Map</> : <><IconList /> List</>}
      </button>
      {overlays}
    </main>
  );
}

function PinPreview({ gym, onClose }: { gym: Gym; onClose: () => void }) {
  const status = gymStatus(gym);
  return (
    <div className="pin-preview">
      <Link href={`/gyms/${gym.slug}`} transitionTypes={['nav-forward']} className="pin-preview-link">
        <div className="pin-preview-photo"><GymPhoto src={gym.photos[0]} name={gym.name} sizes="120px" /></div>
        <div className="pin-preview-copy">
          <strong>{gym.name}</strong>
          <span className="pin-preview-meta"><RatingLine rating={gym.rating} count={gym.rating_count} />{gym.distance_km != null ? <span>{distanceLabel(Number(gym.distance_km))}</span> : null}</span>
          <span className={`status-dot${status.open ? ' is-open' : ''}`}>{status.line}</span>
          <b>{money(gym.price_cents)} <small>one visit</small></b>
        </div>
      </Link>
      <button type="button" className="round round-sm" aria-label="Close preview" onClick={onClose}><IconClose /></button>
    </div>
  );
}
