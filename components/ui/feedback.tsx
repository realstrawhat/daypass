'use client';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, Spark } from '../Icons';

// A light tap on phones that support it. Silent everywhere else.
export const haptic = (ms = 8) => {
  try {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(ms);
  } catch {}
};

type Banner = { title: string; body: string; href?: string };
type Toast = { id: number; text: string; tone?: 'ok' | 'error' };
type Ctx = { toast: (text: string, tone?: Toast['tone']) => void; banner: (b: Banner) => void };

const FeedbackContext = createContext<Ctx>({ toast: () => {}, banner: () => {} });
export const useFeedback = () => useContext(FeedbackContext);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [banner, setBanner] = useState<(Banner & { id: number }) | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const next = useRef(1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismissBanner = useCallback(() => {
    setLeaving(true);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      setBanner(null);
      setLeaving(false);
    }, 260);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      toast: (text, tone) => {
        clearTimeout(toastTimer.current);
        setToast({ id: next.current++, text, tone });
        haptic(tone === 'error' ? 20 : 8);
        toastTimer.current = setTimeout(() => setToast(null), 3200);
      },
      banner: (b) => {
        clearTimeout(bannerTimer.current);
        setLeaving(false);
        setBanner({ ...b, id: next.current++ });
        haptic(12);
        bannerTimer.current = setTimeout(dismissBanner, 5000);
      },
    }),
    [dismissBanner],
  );

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const startY = useRef<number | null>(null);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="feedback-layer">
        {offline ? <p className="offline-pill" role="status">You are offline. Saved passes still open.</p> : null}
        {banner ? (
          <div
            key={banner.id}
            className={`push${leaving ? ' is-leaving' : ''}`}
            role="status"
            onPointerDown={(e) => { startY.current = e.clientY; }}
            onPointerUp={(e) => { if (startY.current !== null && e.clientY - startY.current < -14) dismissBanner(); startY.current = null; }}
          >
            <span className="push-icon" aria-hidden="true"><Spark width={18} height={18} /></span>
            {banner.href ? (
              <Link href={banner.href} className="push-body" onClick={dismissBanner}>
                <span className="push-top"><strong>{banner.title}</strong><small>now</small></span>
                <span>{banner.body}</span>
              </Link>
            ) : (
              <div className="push-body">
                <span className="push-top"><strong>{banner.title}</strong><small>now</small></span>
                <span>{banner.body}</span>
              </div>
            )}
          </div>
        ) : null}
        {toast ? (
          <p key={toast.id} className={`toast${toast.tone === 'error' ? ' is-error' : ''}`} role="status">
            {toast.tone !== 'error' ? <IconCheck width={16} height={16} /> : null}
            <span>{toast.text}</span>
          </p>
        ) : null}
      </div>
    </FeedbackContext.Provider>
  );
}
