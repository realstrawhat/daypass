'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconClock, IconLocate, IconPin, IconSearch } from './Icons';
import { locate, placeUrl, recentCities, rememberCity } from './location';
import { Sheet } from './ui/Sheet';
import { useFeedback } from './ui/feedback';

const POPULAR = ['Amsterdam', 'Berlin', 'Lisbon', 'Barcelona', 'Paris', 'Prague', 'Vienna', 'Rome'];
type Place = { name: string; country: string; code?: string; admin?: string };

// Full-screen search with suggestions, recent places and Near me.
export function SearchOverlay({ open, onClose, note }: { open: boolean; onClose: () => void; note?: string }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (open) {
      setRecent(recentCities());
      setQ('');
      setPlaces([]);
      setMessage(note ?? '');
      setNavigating(false);
    }
  }, [open, note]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setPlaces([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setPlaces(d.places ?? []))
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (city: string, country: string | null = null) => {
    rememberCity(city);
    setNavigating(true);
    onClose();
    router.push(placeUrl({ city, country }));
  };

  const nearMe = async () => {
    setLocating(true);
    setMessage('');
    try {
      await locate();
      setNavigating(true);
      onClose();
      router.push(placeUrl({ near: '1' }));
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Location is off. Type a city instead.';
      setMessage(text);
      toast(text, 'error');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Where to?" full keepHistory={navigating} className="sheet-search">
      <form className="overlay-search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(places[0]?.name ?? q.trim(), places[0]?.code ?? null); }}>
        <IconSearch />
        <label htmlFor="overlay-q" className="sr">City</label>
        <input id="overlay-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city" autoComplete="off" enterKeyHint="search" />
      </form>
      {message ? <p className="overlay-note" role="status">{message}</p> : null}

      {places.length ? (
        <ul className="overlay-list" aria-label="Suggestions">
          {places.map((p) => (
            <li key={`${p.name}-${p.admin}-${p.country}`}>
              <button type="button" onClick={() => go(p.name, p.code ?? null)}>
                <i><IconPin /></i>
                <span><strong>{p.name}</strong><small>{[p.admin, p.country].filter(Boolean).join(', ')}</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <button type="button" className="overlay-near" onClick={nearMe} disabled={locating}>
            <i><IconLocate /></i>
            <span><strong>{locating ? 'Finding you' : 'Near me'}</strong><small>Used while you search, never saved</small></span>
          </button>
          {recent.length ? (
            <section className="overlay-section" aria-labelledby="overlay-recent">
              <h3 id="overlay-recent">Recent</h3>
              <ul className="overlay-list">
                {recent.map((c) => (
                  <li key={c}><button type="button" onClick={() => go(c)}><i><IconClock /></i><span><strong>{c}</strong></span></button></li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="overlay-section" aria-labelledby="overlay-popular">
            <h3 id="overlay-popular">Popular</h3>
            <ul className="chips">
              {POPULAR.map((c) => <li key={c}><button type="button" className="chip" onClick={() => go(c)}>{c}</button></li>)}
            </ul>
          </section>
        </>
      )}
    </Sheet>
  );
}
