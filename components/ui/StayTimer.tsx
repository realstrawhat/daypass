'use client';
import { useLayoutEffect, useState } from 'react';
import { timerLabel } from '@/lib/hours';

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

// A running hh:mm:ss since someone came in. Worked out from the entry time, so it stays right offline or after a sleep.
export function StayTimer({ from, skew = 0, className = '' }: { from: string | number; skew?: number; className?: string }) {
  const now = useNow(skew);
  return <span className={`stay-timer ${className}`} role="timer">{now === null ? '--:--:--' : timerLabel(now - new Date(from).getTime())}</span>;
}
