'use client';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AuthForm } from './AuthForm';
import { FeedbackProvider, haptic, useFeedback } from './ui/feedback';
import { Sheet } from './ui/Sheet';

export type SessionUser = {
  name: string;
  email: string;
  saved_card: { brand: string; last4: string } | null;
  home_city: string | null;
  default_sort: string;
  max_price_cents: number | null;
  is_demo: boolean;
};

export type NextBooking = { id: string; code: string; starts_at: string; gym_name: string; gym_slug: string; gym_city: string; gym_timezone: string; gym_photos: string[] };

type SessionData = {
  user: SessionUser | null;
  unread: number;
  next: NextBooking | null;
  toRate: { id: string; gym_name: string } | null;
  saved: string[];
};

type Ctx = SessionData & {
  ready: boolean;
  refresh: () => Promise<SessionData | null>;
  /** Opens the login sheet if needed. Resolves true once the person has a session. */
  requireLogin: (title?: string, subtitle?: string) => Promise<boolean>;
  toggleSaved: (gymId: string, gymName?: string) => Promise<void>;
  markRead: () => void;
};

const EMPTY: SessionData = { user: null, unread: 0, next: null, toRate: null, saved: [] };
const KEY = 'daypass-session';

const SessionContext = createContext<Ctx>({
  ...EMPTY,
  ready: false,
  refresh: async () => null,
  requireLogin: async () => false,
  toggleSaved: async () => {},
  markRead: () => {},
});

export const useSession = () => useContext(SessionContext);

const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SessionData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<{ title: string; subtitle?: string } | null>(null);
  const authResolve = useRef<((ok: boolean) => void) | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const { toast } = useFeedback();

  // Show the last known session straight away, then check it in the background.
  useIsoLayout(() => {
    try {
      const cached = sessionStorage.getItem(KEY);
      if (cached) {
        setData({ ...EMPTY, ...JSON.parse(cached) });
        setReady(true);
      }
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const body = await res.json();
      const next: SessionData = body.user ? { ...EMPTY, ...body } : EMPTY;
      setData(next);
      try {
        sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    } catch {
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    let last = Date.now();
    const onFocus = () => {
      if (Date.now() - last > 60000) {
        last = Date.now();
        refresh();
      }
    };
    window.addEventListener('focus', onFocus);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const requireLogin = useCallback<Ctx['requireLogin']>(async (title = 'Log in to continue', subtitle) => {
    if (dataRef.current.user) return true;
    const fresh = await refresh();
    if (fresh?.user) return true;
    return new Promise<boolean>((resolve) => {
      authResolve.current = resolve;
      setAuth({ title, subtitle });
    });
  }, [refresh]);

  const finishAuth = useCallback((ok: boolean) => {
    setAuth(null);
    authResolve.current?.(ok);
    authResolve.current = null;
  }, []);

  const toggleSaved = useCallback<Ctx['toggleSaved']>(async (gymId, gymName) => {
    const ok = await requireLogin('Log in to save gyms', gymName ? `Keep ${gymName} on your Home screen.` : undefined);
    if (!ok) return;
    const was = dataRef.current.saved.includes(gymId);
    haptic();
    setData((d) => ({ ...d, saved: was ? d.saved.filter((s) => s !== gymId) : [...d.saved, gymId] }));
    try {
      const res = await fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId, saved: !was }) });
      if (!res.ok) throw new Error();
    } catch {
      setData((d) => ({ ...d, saved: was ? [...d.saved, gymId] : d.saved.filter((s) => s !== gymId) }));
      toast('That did not save. Try again.', 'error');
    }
  }, [requireLogin, toast]);

  const markRead = useCallback(() => setData((d) => ({ ...d, unread: 0 })), []);

  const value = useMemo<Ctx>(() => ({ ...data, ready, refresh, requireLogin, toggleSaved, markRead }), [data, ready, refresh, requireLogin, toggleSaved, markRead]);

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Sheet open={!!auth} onClose={() => finishAuth(false)} title={auth?.title} className="sheet-auth">
        {auth?.subtitle ? <p className="sheet-sub">{auth.subtitle}</p> : null}
        <AuthForm onDone={async () => { await refresh(); finishAuth(true); }} />
      </Sheet>
    </SessionContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FeedbackProvider>
      <SessionProvider>{children}</SessionProvider>
    </FeedbackProvider>
  );
}
