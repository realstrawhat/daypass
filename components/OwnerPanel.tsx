'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { money, timeLabel } from '@/lib/format';
import { stayLabel } from '@/lib/hours';
import type { OwnerSnapshot } from '@/lib/owner';
import { IconBack, IconScan } from './Icons';
import { DESK_COPY, type DeskResult } from './StaffScanner';
import { useFeedback } from './ui/feedback';
import { feel } from './ui/sensory';
import { StayTimer, useNow } from './ui/StayTimer';

const REFRESH_MS = 4000;
type Visit = OwnerSnapshot['inside'][number];
type GymChoice = { slug: string; name: string; city: string };
type Desk = DeskResult | { result: 'other_gym'; gym: string };

export function OwnerGate() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/owner/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      feel('success');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };

  return (
    <form className="owner-gate" onSubmit={submit}>
      <Link href="/partners" className="round round-solid" aria-label="Back to Daypass"><IconBack /></Link>
      <h1 className="two-tone">Front <em>desk</em></h1>
      <p>See who is in, when they came and how long they stayed. Every entry comes from a real pass being scanned.</p>
      <div className="field">
        <label htmlFor="owner-password">Admin password</label>
        <input id="owner-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoCapitalize="none" autoFocus />
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-volt btn-block" disabled={busy || !password}>{busy ? 'Checking' : 'Open the panel'}</button>
    </form>
  );
}

function deskMessage(desk: Desk) {
  if (desk.result === 'other_gym') return { text: `That pass is for ${desk.gym}, not this gym.`, good: false };
  if (desk.inside) return { text: `${desk.holder} is already in. Scan again when they leave.`, good: false };
  const copy = DESK_COPY[desk.result];
  return { text: `${copy.title}. ${copy.line(desk)}`, good: desk.result === 'valid' || desk.result === 'out' };
}

export function OwnerPanel({ first, gyms }: { first: OwnerSnapshot; gyms: GymChoice[] }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [snap, setSnap] = useState(first);
  const [skew, setSkew] = useState(0);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const newest = useRef(0);
  const slug = first.gym?.slug ?? null;

  const take = useCallback((data: OwnerSnapshot) => {
    setSnap(data);
    // Timers follow the server's clock, so a phone set a little wrong still shows the right time inside.
    setSkew(Math.round((data.now - Date.now()) / 1000) * 1000);
    setOffline(false);
  }, []);

  const pull = useCallback(async () => {
    const ask = ++newest.current;
    try {
      const res = await fetch(slug ? `/api/owner?gym=${encodeURIComponent(slug)}` : '/api/owner');
      if (res.status === 401) return router.refresh();
      if (!res.ok) throw new Error();
      const data = await res.json();
      // An answer that comes back after a newer one is out of date.
      if (ask === newest.current) take(data);
    } catch {
      if (ask === newest.current) setOffline(true);
    }
  }, [slug, take, router]);

  useEffect(() => {
    void pull();
    const t = setInterval(() => {
      if (!document.hidden) void pull();
    }, REFRESH_MS);
    const onShow = () => {
      if (!document.hidden) void pull();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [pull]);

  const act = async (key: string, body: Record<string, unknown>): Promise<Desk | null | undefined> => {
    setBusy(key);
    const ask = ++newest.current;
    try {
      const res = await fetch('/api/owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gym: slug, ...body }) });
      const data = await res.json();
      if (res.status === 401) router.refresh();
      if (!res.ok) throw new Error(data.error);
      if (ask === newest.current) take(data.snapshot);
      return data.desk;
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : 'That did not work. Try again.', 'error');
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const door = async (v: Visit, action: 'in' | 'out') => {
    const desk = await act(v.id, { id: v.id, action });
    if (desk === undefined) return;
    if (desk) {
      const { text, good } = deskMessage(desk);
      toast(text, good ? 'ok' : 'error');
    } else toast(action === 'in' ? `${v.name} checked in` : `${v.name} checked out`);
  };

  const typed = async (e: React.FormEvent) => {
    e.preventDefault();
    const desk = await act('code', { code });
    if (!desk) return;
    const { text, good } = deskMessage(desk);
    toast(text, good ? 'ok' : 'error');
    if (good) setCode('');
  };

  const leave = async () => {
    await fetch('/api/owner/session', { method: 'DELETE' }).catch(() => {});
    router.refresh();
  };

  const { gym, stats, inside, arriving, log } = snap;

  return (
    <>
      <header className="owner-top">
        <Link href="/partners" className="round round-solid" aria-label="Back to Daypass"><IconBack /></Link>
        <div className="owner-title">
          <h1>Front desk</h1>
          <p>{offline ? <span className="owner-offline">Reconnecting</span> : <><i className="live-dot" aria-hidden="true" /> Live</>} <LiveClock tz={gym?.timezone} skew={skew} /></p>
        </div>
      </header>

      <div className="field owner-gym">
        <label htmlFor="owner-gym">Gym</label>
        <select id="owner-gym" value={slug ?? ''} onChange={(e) => router.replace(e.target.value ? `/owner?gym=${encodeURIComponent(e.target.value)}` : '/owner')}>
          <option value="">All gyms</option>
          {[...new Set(gyms.map((g) => g.city))].map((city) => (
            <optgroup key={city} label={city}>
              {gyms.filter((g) => g.city === city).map((g) => <option key={g.slug} value={g.slug}>{g.name}, {g.city}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <dl className="owner-stats">
        <div className="stat is-main"><dt>In the gym now</dt><dd aria-live="polite">{stats.inside}</dd></div>
        <div className="stat"><dt>Entries today</dt><dd>{stats.entries}</dd></div>
        <div className="stat"><dt>Average stay</dt><dd>{stats.averageStay === null ? 'None yet' : stayLabel(stats.averageStay)}</dd></div>
        <div className="stat"><dt>{gym ? 'You keep today' : 'Gyms keep today'}</dt><dd>{money(stats.keep)}</dd><small>{money(stats.gross)} in passes, less commission</small></div>
      </dl>

      <HourChart hours={snap.hours} latest={snap.latestHour} />

      <div className="owner-columns">
        <section className="owner-card" aria-labelledby="owner-in">
          <h2 id="owner-in" className="section-title">In the gym <small>{inside.length}</small></h2>
          {inside.length === 0 ? <p className="note">Nobody is checked in right now. Scan a pass and they appear here.</p> : (
            <ul className="owner-list">
              {inside.map((v) => (
                <li key={v.id} className="owner-row">
                  <span className="owner-avatar" aria-hidden="true">{v.name.charAt(0)}</span>
                  <span className="owner-who">
                    <strong>{v.name}</strong>
                    <small>In at {timeLabel(new Date(v.in as number), v.tz)}, <span className="owner-code">{v.code}</span></small>
                    {gym ? null : <small>{v.gym}</small>}
                  </span>
                  <StayTimer from={v.in as number} skew={skew} />
                  <button type="button" className="btn btn-ghost owner-btn" disabled={busy === v.id} aria-label={`Check out ${v.name}`} onClick={() => door(v, 'out')}>Out</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="owner-side">
          <section className="owner-card" aria-labelledby="owner-door">
            <h2 id="owner-door" className="section-title">At the door</h2>
            <Link href="/staff" className="btn btn-volt btn-block"><IconScan width={18} height={18} /> Scan a pass</Link>
            <form className="staff-form" onSubmit={typed}>
              <div className="field"><label htmlFor="owner-code">Or type the code</label><input id="owner-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DP-XXXXX" autoCapitalize="characters" autoComplete="off" /></div>
              <button type="submit" className="btn btn-white" disabled={busy === 'code' || !code.trim()}>{busy === 'code' ? 'Checking' : 'Check'}</button>
            </form>
            <p className="fine">The first scan lets someone in, and a later scan lets them out.</p>
          </section>

          <section className="owner-card" aria-labelledby="owner-next">
            <h2 id="owner-next" className="section-title">Booked for today</h2>
            {arriving.length === 0 ? <p className="note">No more bookings today.</p> : (
              <ul className="owner-list">
                {arriving.map((v) => (
                  <li key={v.id} className="owner-row">
                    <span className="owner-avatar" aria-hidden="true">{v.name.charAt(0)}</span>
                    <span className="owner-who">
                      <strong>{v.name}</strong>
                      <small><Arrival at={v.planned} tz={v.tz} skew={skew} />, <span className="owner-code">{v.code}</span></small>
                      {gym ? null : <small>{v.gym}</small>}
                    </span>
                    <button type="button" className="btn btn-white owner-btn" disabled={busy === v.id} aria-label={`Check in ${v.name}`} onClick={() => door(v, 'in')}>In</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="owner-card" aria-labelledby="owner-log">
        <h2 id="owner-log" className="section-title">Today's log</h2>
        {log.length === 0 ? <p className="note">Nothing yet today.</p> : (
          <ol className="owner-log">
            {log.map((e) => (
              <li key={e.key} className="owner-event">
                <time>{timeLabel(new Date(e.at), e.tz)}</time>
                <i className={e.type === 'in' ? 'is-in' : 'is-out'} aria-hidden="true" />
                <span><strong>{e.name}</strong> {e.type === 'in' ? 'came in' : `left after ${stayLabel(e.stay as number)}`}</span>
                <small>{e.code}{gym ? '' : `, ${e.gym}`}</small>
              </li>
            ))}
          </ol>
        )}
        {snap.logTotal > log.length ? <p className="fine">Showing the latest {log.length} of {snap.logTotal} events today.</p> : null}
      </section>

      <p className="fine owner-fine">Every number here comes from real bookings and real scans. Times are each gym's local time. <button type="button" className="link" onClick={leave}>Lock the panel</button></p>
    </>
  );
}

function LiveClock({ tz, skew }: { tz?: string; skew: number }) {
  const now = useNow(skew);
  return <span className="owner-clock">{now === null ? '--:--:--' : new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(now))}</span>;
}

function Arrival({ at, tz, skew }: { at: number; tz: string; skew: number }) {
  const now = useNow(skew);
  if (now === null) return <>{timeLabel(new Date(at), tz)}</>;
  const minutes = Math.round((at - now) / 60000);
  if (minutes > 60 || minutes < 0) return <>Booked for {timeLabel(new Date(at), tz)}</>;
  return <>{minutes === 0 ? 'Due now' : `In ${minutes} min`}</>;
}

// One bar per hour of the gym's day. One series, so the title names it and a tap reads out the exact number.
function HourChart({ hours, latest }: { hours: number[]; latest: number | null }) {
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? latest;
  const peak = Math.max(1, ...hours);
  const label = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return (
    <section className="owner-card owner-chart" aria-labelledby="owner-chart">
      <div className="owner-chart-head">
        <h2 id="owner-chart" className="section-title">Entries by hour</h2>
        <p role="status">{shown === null ? 'No entries yet today' : <><strong>{hours[shown]}</strong> {hours[shown] === 1 ? 'entry' : 'entries'} from {label(shown)}</>}</p>
      </div>
      <div className="hour-bars">
        {hours.map((n, h) => (
          <button key={h} type="button" data-no-cover="" className={`hour-bar${h === shown ? ' is-picked' : ''}`} aria-label={`${label(h)}: ${n} ${n === 1 ? 'entry' : 'entries'}`} aria-pressed={h === shown} onClick={() => setPicked(h)} onMouseEnter={() => setPicked(h)}>
            <i style={{ height: `${(n / peak) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="hour-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </section>
  );
}
