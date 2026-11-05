'use client';
import { useRef, useState } from 'react';
import { IconArrow } from '../Icons';
import { feel } from './sensory';

// Slide the thumb across to confirm. A tap or the keyboard does the same, so nobody has to drag.
export function SwipeAction({ label, ariaLabel, onConfirm }: { label: React.ReactNode; ariaLabel: string; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; id: number } | null>(null);
  const moved = useRef(false);
  const armed = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const maxOffset = () => {
    const el = track.current;
    return el ? el.clientWidth - 58 : 0;
  };

  const finish = () => {
    // Only a tick here. The success sound waits until the booking has really gone through.
    feel('select');
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
        data-feel="none"
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          start.current = { x: e.clientX, id: e.pointerId };
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          // The release was lost, for example to a context menu, so the thumb stops following.
          if (e.pointerType === 'mouse' && !e.buttons) {
            start.current = null;
            setDragging(false);
            setOffset(0);
            return;
          }
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 6) moved.current = true;
          const max = maxOffset();
          const ready = dx >= max * 0.8;
          if (ready !== armed.current) {
            armed.current = ready;
            if (ready) feel('select');
          }
          setOffset(Math.min(max, Math.max(0, dx)));
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
        onClick={(e) => {
          // A drag ends in a click too, and that one was handled above. Keyboard clicks have detail 0.
          const afterDrag = e.detail !== 0 && moved.current;
          moved.current = false;
          if (!afterDrag) finish();
        }}
      >
        <IconArrow />
      </button>
    </div>
  );
}
