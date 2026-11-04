'use client';
import { useEffect, useRef, useState } from 'react';
import { IconFlip } from './Icons';
import { haptic } from './ui/feedback';

export type PassData = {
  gym: string;
  city: string;
  dateLabel: string;
  timeLabel: string;
  code: string;
  holder?: string;
  qrSvg: string;
  facts?: string[];
  state?: 'active' | 'used' | 'void';
};

// The day pass. Pointer and device tilt drive the foil through CSS variables, so React never re-renders on move.
export function HoloPass({ pass, stamp = false }: { pass: PassData; stamp?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const askedMotion = useRef(false);

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
        el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
        el.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
        el.style.setProperty('--shift', `${(x + y) * 100}%`);
        el.style.setProperty('--turn', `${(x + y) * 100}`);
      });
    };
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      apply(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
    };
    const reset = () => apply(0.5, 0.42);
    const orient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      apply(clamp((e.gamma + 30) / 60), clamp((e.beta - 15) / 60));
    };
    // iPhones only share tilt after a tap and a yes from the person.
    const askMotion = async () => {
      if (askedMotion.current) return;
      askedMotion.current = true;
      const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof D?.requestPermission === 'function') {
        try {
          if ((await D.requestPermission()) === 'granted') window.addEventListener('deviceorientation', orient);
        } catch {}
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointerdown', askMotion);
    window.addEventListener('deviceorientation', orient);
    reset();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('pointerdown', askMotion);
      window.removeEventListener('deviceorientation', orient);
    };
  }, []);

  const flip = () => {
    setFlipped((f) => !f);
    haptic(6);
  };

  return (
    <div className={`holo-stage${stamp ? ' is-new' : ''}${pass.state === 'used' ? ' is-used' : ''}${pass.state === 'void' ? ' is-void' : ''}`}>
      <div className={`holo${flipped ? ' is-flipped' : ''}`} ref={ref}>
        <div className="holo-face holo-front" role="group" aria-hidden={flipped} aria-label={`Day pass for ${pass.gym} on ${pass.dateLabel} at ${pass.timeLabel}, code ${pass.code}`}>
          <div className="holo-foil" aria-hidden="true" />
          <div className="holo-top">
            <span className="holo-brand">Daypass</span>
            <span className="holo-kind">{pass.state === 'used' ? 'Checked in' : pass.state === 'void' ? 'Cancelled' : 'One visit'}</span>
          </div>
          <p className="holo-gym">{pass.gym}</p>
          <p className="holo-city">{pass.city}</p>
          <dl className="holo-meta">
            <div><dt>Date</dt><dd>{pass.dateLabel}</dd></div>
            <div><dt>Time</dt><dd>{pass.timeLabel}</dd></div>
            {pass.holder ? <div><dt>Name</dt><dd>{pass.holder}</dd></div> : null}
          </dl>
          <div className="holo-foot">
            <div className="holo-qr" aria-hidden="true"><span dangerouslySetInnerHTML={{ __html: pass.qrSvg }} /></div>
            <div className="holo-code"><span>Show at the desk</span><strong>{pass.code}</strong></div>
          </div>
          <div className="sticker" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs><path id="sticker-ring" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0" /></defs>
              <text><textPath href="#sticker-ring">VALID ONE DAY  ✦  NO CONTRACT  ✦  </textPath></text>
              <path className="sticker-spark" d="M60 32c1.800 17.600 10.400 26.200 28 28-17.600 1.800-26.200 10.400-28 28-1.800-17.600-10.400-26.200-28-28 17.600-1.800 26.200-10.400 28-28Z" />
            </svg>
          </div>
          <div className="holo-sheen" aria-hidden="true" />
          {stamp ? <div className="holo-sweep" aria-hidden="true" /> : null}
        </div>

        <div className="holo-face holo-back" aria-hidden={!flipped}>
          <p className="holo-back-title">Good to know</p>
          <ul className="holo-facts">
            {(pass.facts ?? []).map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className="holo-back-note">Show this pass once at reception. Daypass is a student demo, so the gym and this pass are samples.</p>
          <div className="holo-sheen" aria-hidden="true" />
        </div>
      </div>
      {stamp ? (
        <div className="holo-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': `${i * 30}deg`, '--d': `${70 + (i % 3) * 34}px` } as React.CSSProperties} />)}
        </div>
      ) : null}
      <button type="button" className="holo-flip" onClick={flip} aria-pressed={flipped}>
        <IconFlip width={16} height={16} /> {flipped ? 'Show pass' : 'What your pass includes'}
      </button>
    </div>
  );
}
