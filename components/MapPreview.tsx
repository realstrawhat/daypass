'use client';
import { money } from '@/lib/format';

type Pin = { id: string; name: string; lat: number; lng: number; price_cents: number };
type Pad = { top: number; bottom: number; left: number; right: number };

// Web Mercator, as the map draws it: 0 to 1 across the world.
const project = (lng: number, lat: number) => {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
};
const n = (v: number) => v.toFixed(12);

// The pins arrive with the list, in the places the map will put them, while the street map loads behind. It uses the
// map's own first framing: the 12 nearest gyms fitted inside the same padding, no closer than zoom 14 on 512 px tiles.
// The frame is worked out in CSS from this box's size, so it is right before any script runs.
export function MapPreview({ gyms, padding, done, onSelect }: { gyms: Pin[]; padding: Pad; done: boolean; onSelect: (id: string) => void }) {
  const frame = gyms.slice(0, 12).map((g) => project(g.lng, g.lat));
  if (frame.length < 2) return null;
  const xs = frame.map((p) => p.x);
  const ys = frame.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const scale = `min(calc((100cqw - ${padding.left + padding.right}px) / ${n(Math.max(maxX - minX, 1e-9))}), calc((100cqh - ${padding.top + padding.bottom}px) / ${n(Math.max(maxY - minY, 1e-9))}), ${512 * 2 ** 14}px)`;
  const style = { '--s': scale, '--ox': `${(padding.left - padding.right) / 2}px`, '--oy': `${(padding.top - padding.bottom) / 2}px` } as React.CSSProperties;
  return (
    <div className={`map-preview${done ? ' is-done' : ''}`} aria-hidden="true" style={style}>
      {gyms.map((g) => {
        const p = project(g.lng, g.lat);
        return (
          <button
            key={g.id}
            type="button"
            className="pin"
            tabIndex={-1}
            style={{ left: `calc(50cqw + var(--ox) + var(--s) * ${n(p.x - midX)})`, top: `calc(50cqh + var(--oy) + var(--s) * ${n(p.y - midY)})` }}
            onClick={() => onSelect(g.id)}
          >
            <span>{money(g.price_cents)}</span>
          </button>
        );
      })}
    </div>
  );
}
