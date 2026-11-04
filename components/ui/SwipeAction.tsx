'use client';
import { useRef, useState } from 'react';
import { IconArrow } from '../Icons';
import { feel } from './sensory';

// Slide the thumb across to confirm. A tap or the keyboard does the same, so nobody has to drag.
export function SwipeAction({ label, ariaLabel, onConfirm }: { label: React.ReactNode; ariaLabel: string; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; id: number } | null>(null);
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const maxOffset = () => {
    const el = track.current;
    return el ? el.clientWidth - 58 : 0;
  };

  const finish = () => {
    feel('success');
    setOffset(0);
    onConfirm();
  };

  return (
    <div className={`swipe${dragging ? ' is-dragging' : ''}`} ref={track} style={{ '--x': `${offset}px` } as React.CSSProperties}>
      <i className="swipe-fill" aria-hidden="true" />
      <span className="swipe-label">{label}</span>
      <button
        type="button"
        className="swipe-thumb"
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, id: e.pointerId };
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 6) moved.current = true;
          setOffset(Math.min(maxOffset(), Math.max(0, dx)));
        }}
        onPointerUp={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          start.current = null;
          setDragging(false);
          if (!moved.current) return;
          if (e.clientX - s.x >= maxOffset() * 0.8) finish();
          else setOffset(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setOffset(0);
        }}
        onClick={() => {
          // A drag ends in a click too. That one was already handled above.
          if (moved.current) {
            moved.current = false;
            return;
          }
          finish();
        }}
      >
        <IconArrow />
      </button>
    </div>
  );
}
