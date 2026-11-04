'use client';
import { useEffect, useRef } from 'react';

export type PassData = {
  gym: string;
  city: string;
  dateLabel: string;
  timeLabel: string;
  code: string;
  holder?: string;
  qrSvg?: string;
};

// The day pass. Pointer and device tilt drive the foil through CSS variables, so React never re-renders on move.
export function HoloPass({ pass, compact = false }: { pass: PassData; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const apply = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
        el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
        el.style.setProperty('--ry', `${(x - 0.5) * 20}deg`);
        el.style.setProperty('--shift', `${(x + y) * 100}%`);
      });
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      apply(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
    };
    const reset = () => apply(0.5, 0.42);
    const orient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      apply(Math.min(1, Math.max(0, (e.gamma + 30) / 60)), Math.min(1, Math.max(0, (e.beta - 15) / 60)));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    window.addEventListener('deviceorientation', orient);
    reset();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      window.removeEventListener('deviceorientation', orient);
    };
  }, []);

  return (
    <div className={`holo-stage${compact ? ' is-compact' : ''}`}>
      <div className="holo" ref={ref} role="group" aria-label={`Day pass for ${pass.gym} on ${pass.dateLabel} at ${pass.timeLabel}, code ${pass.code}`}>
        <div className="holo-top">
          <span className="holo-brand">Daypass</span>
          <span className="holo-kind">One visit</span>
        </div>
        <p className="holo-gym">{pass.gym}</p>
        <p className="holo-city">{pass.city}</p>
        <dl className="holo-meta">
          <div><dt>Date</dt><dd>{pass.dateLabel}</dd></div>
          <div><dt>Time</dt><dd>{pass.timeLabel}</dd></div>
          {pass.holder ? <div><dt>Name</dt><dd>{pass.holder}</dd></div> : null}
        </dl>
        <div className="holo-foot">
          <div className="holo-qr" aria-hidden="true">
            {pass.qrSvg ? <span dangerouslySetInnerHTML={{ __html: pass.qrSvg }} /> : <FauxQr />}
          </div>
          <div className="holo-code"><span>Show at the desk</span><strong>{pass.code}</strong></div>
        </div>
        <div className="sticker" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <defs><path id="sticker-ring" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0" /></defs>
            <text><textPath href="#sticker-ring">VALID ONE DAY  ✦  NO CONTRACT  ✦  </textPath></text>
            <path d="M60 32c1.800 17.600 10.400 26.200 28 28-17.600 1.800-26.200 10.400-28 28-1.800-17.600-10.400-26.200-28-28 17.600-1.800 26.200-10.400 28-28Z" />
          </svg>
        </div>
        <div className="holo-sheen" aria-hidden="true" />
      </div>
    </div>
  );
}

function FauxQr() {
  const cells = Array.from({ length: 121 }, (_, i) => ((i * 7 + (i % 11) * 13 + (i % 5)) % 3 !== 0));
  return (
    <svg viewBox="0 0 11 11" shapeRendering="crispEdges">
      {cells.map((on, i) => (on ? <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" /> : null))}
    </svg>
  );
}
