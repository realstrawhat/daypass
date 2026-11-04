'use client';
import { useEffect, useState } from 'react';
import { money } from '@/lib/format';
import { haptic } from './ui/feedback';
import { Sheet } from './ui/Sheet';

export type Filters = { maxPrice: number | null; minRating: number | null; openNow: boolean; equipment: string[] };
export const NO_FILTERS: Filters = { maxPrice: null, minRating: null, openNow: false, equipment: [] };

const KIT = ['Squat racks', 'Olympic platforms', 'Dumbbells to 50 kg', 'Cable machines', 'Treadmills', 'Rowers', 'Assault bikes', 'Sled track', 'Kettlebells', 'Boxing bags', 'Sauna', 'Showers', 'Lockers', 'Towel service', 'Yoga room', 'Pilates reformers', 'Climbing wall', 'Leg press'];
const RATINGS = [{ v: null, l: 'Any' }, { v: 4, l: '4.0+' }, { v: 4.5, l: '4.5+' }];
const MIN = 800;
const MAX = 3000;

export function filterCount(f: Filters) {
  return (f.maxPrice != null ? 1 : 0) + (f.minRating != null ? 1 : 0) + (f.openNow ? 1 : 0) + f.equipment.length;
}

type Props = {
  open: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (f: Filters) => void;
  /** Counts the gyms a draft would show, so the button can say so before applying. */
  countFor: (f: Filters) => Promise<number | null>;
};

export function FilterSheet({ open, onClose, value, onApply, countFor }: Props) {
  const [draft, setDraft] = useState<Filters>(value);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => {
      countFor(draft).then((n) => {
        if (live) setCount(n);
      });
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // countFor changes with the search location, which can't change while this is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, open]);

  const price = draft.maxPrice ?? MAX;

  return (
    <Sheet open={open} onClose={onClose} title="Filters" className="sheet-filters">
      <section className="filter-group">
        <div className="filter-label">
          <label htmlFor="f-price">Day pass price</label>
          <output htmlFor="f-price">{draft.maxPrice == null ? 'Any price' : `Up to ${money(price)}`}</output>
        </div>
        <input
          id="f-price"
          className="range"
          type="range"
          min={MIN}
          max={MAX}
          step={100}
          value={price}
          style={{ '--fill': `${((price - MIN) / (MAX - MIN)) * 100}%` } as React.CSSProperties}
          onChange={(e) => {
            const v = Number(e.target.value);
            setDraft({ ...draft, maxPrice: v >= MAX ? null : v });
            if (v % 500 === 0) haptic(4);
          }}
        />
      </section>

      <section className="filter-group">
        <div className="filter-label"><span id="f-rating">Rating</span></div>
        <div className="segmented is-three" role="group" aria-labelledby="f-rating" data-index={RATINGS.findIndex((r) => r.v === draft.minRating)}>
          <i className="segmented-thumb" aria-hidden="true" />
          {RATINGS.map((r) => (
            <button key={r.l} type="button" aria-pressed={draft.minRating === r.v} onClick={() => { setDraft({ ...draft, minRating: r.v }); haptic(4); }}>{r.l}</button>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <button type="button" className="switch-row" role="switch" aria-checked={draft.openNow} onClick={() => { setDraft({ ...draft, openNow: !draft.openNow }); haptic(6); }}>
          <span><strong>Open now</strong><small>Only gyms you can walk into right now</small></span>
          <i className="switch" aria-hidden="true" />
        </button>
      </section>

      <section className="filter-group">
        <div className="filter-label"><span>Equipment and extras</span></div>
        <ul className="chips">
          {KIT.map((k) => {
            const on = draft.equipment.includes(k);
            return (
              <li key={k}>
                <button type="button" className="chip" aria-pressed={on} onClick={() => { setDraft({ ...draft, equipment: on ? draft.equipment.filter((e) => e !== k) : [...draft.equipment, k] }); haptic(4); }}>{k}</button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="filter-actions">
        <button type="button" className="btn btn-ghost" disabled={filterCount(draft) === 0} onClick={() => setDraft(NO_FILTERS)}>Clear</button>
        <button type="button" className="btn btn-volt" onClick={() => { onApply(draft); onClose(); }}>
          {count === null ? 'Show gyms' : count === 0 ? 'No gyms match' : `Show ${count} ${count === 1 ? 'gym' : 'gyms'}`}
        </button>
      </div>
    </Sheet>
  );
}
