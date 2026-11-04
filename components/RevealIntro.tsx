'use client';
import { useEffect, useState } from 'react';
import { IconCheck } from './Icons';

// Full-screen lime confirmation that lifts to reveal the pass.
export function RevealIntro({ gym }: { gym: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 2100);
    window.history.replaceState(null, '', window.location.pathname);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className="reveal" role="status">
      <span className="reveal-check" aria-hidden="true"><IconCheck width={48} height={48} /></span>
      <p>You are in.</p>
      <small>Your visit to {gym} is confirmed.</small>
    </div>
  );
}
