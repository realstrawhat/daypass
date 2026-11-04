'use client';
import { ScrollArrows } from './ui/Rail';
import { useEffect, useRef } from 'react';
import type { SlotDay } from '@/lib/gyms';
import { haptic } from './ui/feedback';

type Props = {
  days: SlotDay[];
  dayIndex: number;
  onDay: (i: number) => void;
  selected: string | null;
  onSelect: (startsAt: string) => void;
  exclude?: string | null;
};

export function SlotPicker({ days, dayIndex, onDay, selected, onSelect, exclude }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const day = days[dayIndex];

  // Keep the chosen date in view as the strip scrolls.
  useEffect(() => {
    const box = strip.current;
    const el = box?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!box || !el) return;
    // Only the strip moves. The page itself must stay where the person left it.
    const left = box.scrollLeft + el.getBoundingClientRect().left - box.getBoundingClientRect().left - (box.clientWidth - el.offsetWidth) / 2;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ left, behavior: calm || !settled.current ? 'auto' : 'smooth' });
    settled.current = true;
  }, [dayIndex]);

  return (
    <div className="picker">
      <div className="day-head">
        <p>Choose a date</p>
        <ScrollArrows target={strip} label="Scroll dates" />
      </div>
      <div className="day-strip" role="radiogroup" aria-label="Choose a date" ref={strip}>
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            role="radio"
            aria-checked={i === dayIndex}
            aria-label={`${d.weekday} ${d.day} ${d.month}, ${d.free} ${d.free === 1 ? 'time' : 'times'} open`}
            className="day-pill"
            disabled={d.free === 0}
            onClick={() => { onDay(i); haptic(4); }}
          >
            <span>{i === 0 ? 'Today' : d.weekday}</span>
            <strong>{d.day}</strong>
            <small>{d.month}</small>
          </button>
        ))}
      </div>
      {day ? (
        day.slots.length ? (
          <div key={day.date} className="time-grid" role="radiogroup" aria-label={`Open times on ${day.weekday} ${day.day} ${day.month}`}>
            {day.slots.map((s, i) => {
              const isCurrent = exclude === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={selected === s.startsAt}
                  disabled={isCurrent}
                  className="time-pill"
                  style={{ animationDelay: `${Math.min(i, 10) * 18}ms` }}
                  onClick={() => { onSelect(s.startsAt); haptic(6); }}
                >
                  <strong>{s.label}</strong>
                  <span>{isCurrent ? 'Your booking' : s.spots <= 2 ? `${s.spots} ${s.spots === 1 ? 'space' : 'spaces'} left` : 'Open'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="note">No open times this day. Pick another date.</p>
        )
      ) : null}
    </div>
  );
}
