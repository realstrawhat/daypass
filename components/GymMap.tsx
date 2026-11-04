'use client';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { money } from '@/lib/format';
import { IconLocate } from './Icons';

export type MapGym = { id: string; slug: string; name: string; lat: number; lng: number; price_cents: number };
type Bounds = [number, number, number, number];

type Props = {
  gyms: MapGym[];
  center: { lat: number; lng: number } | null;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onBackground?: () => void;
  onAreaSearch?: (bbox: Bounds) => void;
  zoom?: number;
  single?: boolean;
  padding?: { top: number; bottom: number; left: number; right: number };
  /** The person's own position, shown as a dot. Held in memory only. */
  me?: { lat: number; lng: number } | null;
  onLocate?: () => void;
  locating?: boolean;
};

const STYLE = 'https://tiles.openfreemap.org/styles/dark';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lifts streets and labels on the dark base map so it stays readable on a phone in daylight.
function tuneStyle(m: any) {
  for (const layer of m.getStyle()?.layers ?? []) {
    try {
      if (layer.type === 'background') m.setPaintProperty(layer.id, 'background-color', '#101112');
      else if (layer.type === 'line' && /road|highway|street|path|transport|bridge|tunnel/i.test(layer.id)) m.setPaintProperty(layer.id, 'line-color', '#3f4246');
      else if (layer.type === 'fill' && /water/i.test(layer.id)) m.setPaintProperty(layer.id, 'fill-color', '#1b2a33');
      else if (layer.type === 'symbol') {
        m.setPaintProperty(layer.id, 'text-color', '#c6c8c2');
        m.setPaintProperty(layer.id, 'text-halo-color', '#101112');
      }
    } catch {}
  }
}

// MapLibre loads only when a map is on screen, which keeps the list fast on mobile data.
export function GymMap({ gyms, center, activeId, onSelect, onBackground, onAreaSearch, zoom = 12.5, single = false, padding, me, onLocate, locating }: Props) {
  const meMarker = useRef<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const lib = useRef<any>(null);
  const markers = useRef(new Map<string, { marker: any; el: HTMLButtonElement }>());
  const resizer = useRef<ResizeObserver | null>(null);
  const [moved, setMoved] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!single);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const backgroundRef = useRef(onBackground);
  backgroundRef.current = onBackground;
  const padRef = useRef(padding);
  padRef.current = padding;

  // A map further down a page waits until it is nearly on screen.
  useEffect(() => {
    if (visible || !box.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '400px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    let cancelled = false;
    if (!visible || !box.current || map.current) return;
    (async () => {
      try {
        const mod: any = await import('maplibre-gl');
        const maplibre = mod.default ?? mod;
        if (cancelled || !box.current) return;
        lib.current = maplibre;
        const m = new maplibre.Map({
          container: box.current,
          style: STYLE,
          center: center ? [center.lng, center.lat] : [4.9041, 52.3676],
          zoom,
          attributionControl: { compact: true },
          fadeDuration: reduced() ? 0 : 150,
          cooperativeGestures: single,
          pitchWithRotate: false,
          dragRotate: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        m.on('load', () => {
          if (cancelled) return;
          tuneStyle(m);
          setReady(true);
        });
        m.on('error', (e: { error?: { status?: number } }) => {
          if (!m.isStyleLoaded() && !m.loaded() && e?.error) setFailed(true);
        });
        // Only a person dragging or zooming counts. Our own camera moves have no original event.
        m.on('moveend', (e: { originalEvent?: unknown }) => {
          if (e.originalEvent) setMoved(true);
        });
        m.on('click', () => backgroundRef.current?.());
        map.current = m;
        // The map can start hidden on phones, so it must re-measure when it appears.
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
      meMarker.current = null;
      markers.current.clear();
    };
    // The map is created once. Later prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const m = map.current;
    const maplibre = lib.current;
    if (!m || !maplibre || !ready) return;
    const seen = new Set<string>();
    gyms.forEach((g, i) => {
      seen.add(g.id);
      if (markers.current.has(g.id)) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pin';
      el.setAttribute('aria-label', `${g.name}, ${money(g.price_cents)}`);
      const label = document.createElement('span');
      label.textContent = money(g.price_cents);
      label.style.animationDelay = `${Math.min(i, 14) * 22}ms`;
      el.appendChild(label);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectRef.current?.(g.id);
      });
      const marker = new maplibre.Marker({ element: el, anchor: 'bottom' }).setLngLat([g.lng, g.lat]).addTo(m);
      markers.current.set(g.id, { marker, el });
    });
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    }
    if (moved) return;
    if (gyms.length > 1) {
      // Frame the closest gyms, so the map opens at street level rather than a whole region.
      const near = gyms.slice(0, 12);
      const b = new maplibre.LngLatBounds();
      near.forEach((g) => b.extend([g.lng, g.lat]));
      // If you are in this area, keep yourself in the frame too.
      if (me && Math.abs(me.lat - near[0].lat) < 0.35 && Math.abs(me.lng - near[0].lng) < 0.5) b.extend([me.lng, me.lat]);
      m.fitBounds(b, { padding: padRef.current ?? 56, maxZoom: 14, duration: reduced() ? 0 : 500 });
    } else if (gyms.length === 1) {
      m.jumpTo({ center: [gyms[0].lng, gyms[0].lat], zoom: single ? 14.5 : 13 });
    }
    // me only widens the frame when gyms change. Its own effect below moves the dot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gyms, ready, moved, single]);

  // The "you are here" dot.
  useEffect(() => {
    const m = map.current;
    const maplibre = lib.current;
    if (!m || !maplibre || !ready) return;
    if (!me) {
      meMarker.current?.remove();
      meMarker.current = null;
      return;
    }
    if (meMarker.current) {
      meMarker.current.setLngLat([me.lng, me.lat]);
      return;
    }
    const el = document.createElement('div');
    el.className = 'me-dot';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'You are here');
    meMarker.current = new maplibre.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(m);
  }, [me, ready]);

  useEffect(() => {
    for (const [id, { el, marker }] of markers.current) {
      el.classList.toggle('is-active', id === activeId);
      marker.getElement().style.zIndex = id === activeId ? '5' : '';
    }
    const m = map.current;
    const active = activeId ? markers.current.get(activeId) : null;
    if (m && active && !single) {
      m.easeTo({ center: active.marker.getLngLat(), duration: reduced() ? 0 : 420, padding: padRef.current ?? undefined });
    }
  }, [activeId, gyms, ready, single]);

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
      <div ref={box} className={`map${ready ? ' is-ready' : ''}`} role="region" aria-label="Map of gyms. The list has the same gyms." />
      {moved && onAreaSearch ? <button type="button" className="map-area" onClick={searchArea}>Search this area</button> : null}
      {onLocate ? (
        <button type="button" className={`map-locate${me ? ' is-on' : ''}${locating ? ' is-busy' : ''}`} aria-label="Show my location" disabled={locating} onClick={onLocate}>
          <IconLocate />
        </button>
      ) : null}
      {failed ? <p className="map-fail">The map could not load on this connection. The list still has every gym.</p> : null}
    </div>
  );
}
