'use client';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { money } from '@/lib/format';

export type MapGym = { id: string; slug: string; name: string; lat: number; lng: number; price_cents: number };
type Bounds = [number, number, number, number];

type Props = {
  gyms: MapGym[];
  center: { lat: number; lng: number } | null;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onAreaSearch?: (bbox: Bounds) => void;
  zoom?: number;
  single?: boolean;
};

const STYLE = 'https://tiles.openfreemap.org/styles/dark';

// MapLibre loads only when a map is on screen, which keeps the list fast on mobile data.
export function GymMap({ gyms, center, activeId, onSelect, onAreaSearch, zoom = 12, single = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const lib = useRef<any>(null);
  const markers = useRef(new Map<string, { marker: any; el: HTMLButtonElement }>());
  const resizer = useRef<ResizeObserver | null>(null);
  const [moved, setMoved] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    if (!box.current || map.current) return;
    (async () => {
      try {
        const mod: any = await import('maplibre-gl');
        const maplibre = mod.default ?? mod;
        if (cancelled || !box.current) return;
        lib.current = maplibre;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const m = new maplibre.Map({
          container: box.current,
          style: STYLE,
          center: center ? [center.lng, center.lat] : [4.9041, 52.3676],
          zoom,
          attributionControl: { compact: true },
          fadeDuration: reduce ? 0 : 200,
          cooperativeGestures: single,
        });
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
        m.on('load', () => !cancelled && setReady(true));
        m.on('error', (e: { error?: { status?: number } }) => {
          if (e?.error?.status && e.error.status >= 400 && !m.isStyleLoaded()) setFailed(true);
        });
        // Only a person dragging or zooming counts. Our own fitBounds calls have no original event.
        m.on('moveend', (e: { originalEvent?: unknown }) => {
          if (e.originalEvent) setMoved(true);
        });
        map.current = m;
        // The map starts hidden on phones, so it must re-measure when it appears.
        resizer.current = new ResizeObserver(() => m.resize());
        resizer.current.observe(box.current);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      resizer.current?.disconnect();
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
    // The map is created once. Later prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const maplibre = lib.current;
    if (!m || !maplibre || !ready) return;
    const seen = new Set<string>();
    for (const g of gyms) {
      seen.add(g.id);
      if (markers.current.has(g.id)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pin';
      el.textContent = money(g.price_cents);
      el.setAttribute('aria-label', `${g.name}, ${money(g.price_cents)}`);
      el.addEventListener('click', () => selectRef.current?.(g.id));
      const marker = new maplibre.Marker({ element: el, anchor: 'bottom' }).setLngLat([g.lng, g.lat]).addTo(m);
      markers.current.set(g.id, { marker, el });
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    }
    if (gyms.length > 1 && !moved) {
      const b = new maplibre.LngLatBounds();
      gyms.forEach((g) => b.extend([g.lng, g.lat]));
      m.fitBounds(b, { padding: 56, maxZoom: 14, duration: 500 });
    } else if (gyms.length === 1 && !moved) {
      m.jumpTo({ center: [gyms[0].lng, gyms[0].lat], zoom: single ? 14.500 : 13 });
    }
  }, [gyms, ready, moved, single]);

  useEffect(() => {
    for (const [id, { el }] of markers.current) el.classList.toggle('is-active', id === activeId);
    const active = activeId ? markers.current.get(activeId) : null;
    if (active) active.el.parentElement?.appendChild(active.el);
  }, [activeId, gyms, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !center) return;
    setMoved(false);
    m.jumpTo({ center: [center.lng, center.lat] });
    // Only a new search location recentres the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng]);

  const searchArea = () => {
    const m = map.current;
    if (!m || !onAreaSearch) return;
    const b = m.getBounds();
    setMoved(false);
    onAreaSearch([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
  };

  return (
    <div className="map-wrap">
      <div ref={box} className="map" role="region" aria-label="Map of gyms" />
      {moved && onAreaSearch ? (
        <button type="button" className="map-area" onClick={searchArea}>Search this area</button>
      ) : null}
      {failed ? <p className="map-fail">The map could not load on this connection. The list still has every gym.</p> : null}
    </div>
  );
}
