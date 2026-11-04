'use client';
import { type RefObject, useEffect, useState } from 'react';
import { IconBack, IconChevron } from '../Icons';

// Previous and next buttons for anything that scrolls sideways. They hide when everything already fits.
export function ScrollArrows({ target, label, className = '' }: { target: RefObject<HTMLElement | null>; label: string; className?: string }) {
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const measure = () => setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const size = new ResizeObserver(measure);
    size.observe(el);
    const content = new MutationObserver(measure);
    content.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', measure);
      size.disconnect();
      content.disconnect();
    };
  }, [target]);

  if (edge.start && edge.end) return null;

  const move = (direction: 1 | -1) => {
    const el = target.current;
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: calm ? 'auto' : 'smooth' });
  };

  return (
    <div className={`rail-arrows ${className}`} role="group" aria-label={label}>
      <button type="button" className="round round-sm rail-arrow" aria-label="Previous" disabled={edge.start} onClick={() => move(-1)}><IconBack /></button>
      <button type="button" className="round round-sm rail-arrow" aria-label="Next" disabled={edge.end} onClick={() => move(1)}><IconChevron /></button>
    </div>
  );
}
