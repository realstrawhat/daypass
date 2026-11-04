'use client';
import type { SlotDay } from '@/lib/gyms';

type Props = {
  days: SlotDay[];
  dayIndex: number;
  onDay: (i: number) => void;
  selected: string | null;
  onSelect: (startsAt: string) => void;
  exclude?: string | null;
};

// Dots echo how open a day is, so a busy day reads at a glance.
const dots = (free: number, total: number) => (total === 0 ? 0 : Math.ceil((free / total) * 4));

export function SlotPicker({ days, dayIndex, onDay, selected, onSelect, exclude }: Props) {
  const day = days[dayIndex];
  return (
    <div className="picker">
      <div className="day-strip" role="radiogroup" aria-label="Choose a date">
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            role="radio"
            aria-checked={i === dayIndex}
            aria-label={`${d.weekday} ${d.day} ${d.month}, ${d.free} ${d.free === 1 ? 'time' : 'times'} free`}
            className="day-pill"
            disabled={d.free === 0}
            onClick={() => onDay(i)}
          >
            <span>{d.weekday}</span>
            <strong>{d.day}</strong>
            <em aria-hidden="true">{Array.from({ length: 4 }, (_, n) => <i key={n} className={n < dots(d.free, d.total) ? 'on' : ''} />)}</em>
          </button>
        ))}
      </div>
      {day ? (
        day.slots.length ? (
          <div className="time-grid" role="radiogroup" aria-label={`Free times on ${day.weekday} ${day.day} ${day.month}`}>
            {day.slots.map((s) => {
              const isCurrent = exclude === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={selected === s.startsAt}
                  disabled={isCurrent}
                  className="time-pill"
                  onClick={() => onSelect(s.startsAt)}
                >
                  <strong>{s.label}</strong>
                  <span>{isCurrent ? 'Current' : s.spots <= 2 ? `${s.spots} left` : 'Free'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="note">No free times this day. Pick another date.</p>
        )
      ) : null}
    </div>
  );
}
