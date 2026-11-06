'use client';
import { useLayoutEffect, useState } from 'react';
import { timeLeft } from '@/lib/hours';

// The clock, once a second. Empty on the server and set before the first paint, so nothing flashes.
export function useNow(skew = 0) {
  const [now, setNow] = useState<number | null>(null);
  useLayoutEffect(() => {
    const tick = () => setNow(Date.now() + skew);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [skew]);
  return now;
}

// Counts down the booked session from the moment someone is let in, then the grace period, then goes negative.
// Worked out from the entry time, so it stays right offline or after the phone sleeps.
export function TimeLeft({ from, skew = 0, className = '' }: { from: string | number; skew?: number; className?: string }) {
  const now = useNow(skew);
  const left = now === null ? null : timeLeft(from, now);
  return <span className={`stay-timer${left?.over ? ' is-over' : ''}${left?.stage === 'grace' ? ' is-grace' : ''} ${className}`} role="timer">{left?.stage === 'grace' ? <small>Grace </small> : null}{left?.label ?? '--:--:--'}</span>;
}
