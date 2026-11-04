'use client';
import { useEffect, useState } from 'react';
import { IconCheck } from './Icons';
import { useFeedback } from './ui/feedback';
import { Ribbon } from './ui/Ribbon';

// Full-screen lime confirmation that lifts to reveal the pass, then a push-style banner.
export function RevealIntro({ gym }: { gym: string }) {
  const [gone, setGone] = useState(false);
  const { banner } = useFeedback();
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 2100);
    const b = setTimeout(() => banner({ title: 'Daypass', body: `Your pass for ${gym} is ready. A copy is in your inbox.`, href: '/inbox' }), 3400);
    window.history.replaceState(window.history.state, '', window.location.pathname);
    return () => {
      clearTimeout(t);
      clearTimeout(b);
    };
    // Plays once when the pass first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (gone) return null;
  return (
    <div className="reveal" role="status">
      <Ribbon tone="ink" className="reveal-ribbon" />
      <span className="reveal-check" aria-hidden="true"><IconCheck width={48} height={48} /></span>
      <p>You are in.</p>
      <small>Your visit to {gym} is confirmed.</small>
    </div>
  );
}
