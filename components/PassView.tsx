'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, distanceLabel, money, timeLabel } from '@/lib/format';
import { doorIsOpen, hoursUntil, refusalIsOpen, stayLabel, visitState } from '@/lib/hours';
import type { Gym, SlotDay } from '@/lib/gyms';
import type { PayMethod } from '@/lib/payments';
import { HoloPass, type PassData } from './HoloPass';
import { IconBack, IconCalendar, IconCheck, IconChevron, IconHelp, IconRoute, IconScan, IconWallet, Spark } from './Icons';
import { savePagesForOffline, useSession } from './session';
import { SlotPicker } from './SlotPicker';
import { FaceScan } from './ui/FaceScan';
import { haptic, useFeedback } from './ui/feedback';
import { feel } from './ui/sensory';
import { afterSheetClosed, Sheet } from './ui/Sheet';
import { StayTimer, useNow } from './ui/StayTimer';
import { SwipeAction } from './ui/SwipeAction';
import { WalletSheet } from './WalletSheet';

export type PassBooking = {
  id: string;
  version: number;
  code: string;
  gym_id: string;
  gym_name: string;
  gym_city: string;
  starts_at: string;
  price_cents: number;
  timezone: string;
  lat: number;
  lng: number;
  dateLabel: string;
  timeLabel: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checkedInLabel: string | null;
  in_wallet: boolean;
};

type Props = {
  booking: PassBooking;
  pass: PassData;
  directions: { google: string; apple: string; web: string };
  googleCal: string;
  changeable: boolean;
  isOver: boolean;
  isNew: boolean;
};

type SheetName = 'directions' | 'calendar' | 'wallet' | 'change' | 'cancel' | 'help' | 'desk' | null;

const postAction = async (id: string, action: string, body?: unknown) => {
  const res = await fetch(`/api/bookings/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not work. Try again.');
  return data;
};

export function PassView({ booking: b, pass, directions, googleCal, changeable, isOver, isNew }: Props) {
  const router = useRouter();
  const { refresh, user } = useSession();
  const { toast, banner } = useFeedback();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [lateNotice, setLateNotice] = useState(false);
  const [earlyHelp, setEarlyHelp] = useState(false);
  const [inWallet, setInWallet] = useState(b.in_wallet);
  const [inAt, setInAt] = useState(b.checked_in_at);
  const [outAt, setOutAt] = useState(b.checked_out_at);
  const close = () => setSheet(null);
  const used = !!inAt;
  useEffect(() => setInAt(b.checked_in_at), [b.checked_in_at]);
  useEffect(() => setOutAt(b.checked_out_at), [b.checked_out_at]);
  // Around the session, a real account can use the same door steps. Demo accounts can try them any time.
  // These follow the clock, because a pass can stay open on a phone, or come from a saved copy.
  const [door, setDoor] = useState({ help: false, scan: false, over: isOver });
  useEffect(() => {
    const check = () => {
      const hours = hoursUntil(b.starts_at);
      setDoor({ help: refusalIsOpen(b.starts_at, b.timezone), scan: doorIsOpen(hours), over: isOver || hours < -3 });
    };
    check();
    const t = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', check);
    };
  }, [b.starts_at, b.timezone, isOver]);
  const passOver = door.over;
  const canManage = !passOver && !used;

  const afterChange = () => {
    refresh();
    router.refresh();
  };

  return (
    <>
      <HoloPass pass={{ ...pass, state: used ? 'used' : passOver ? 'expired' : 'active' }} stamp={isNew} />

      <div className="pass-actions">
        {inAt ? <VisitClock id={b.id} timezone={b.timezone} inAt={inAt} outAt={outAt} onOut={(at) => { setOutAt(at); afterChange(); }} /> : null}
        {!used && !passOver ? (
          <button type="button" className="btn btn-volt btn-block pass-show" onClick={() => setSheet('desk')}><IconScan /> Show at the desk</button>
        ) : null}
        <div className="action-grid">
          <button type="button" className="action" onClick={() => setSheet('directions')}><IconRoute /><span>Directions</span></button>
          {canManage ? <button type="button" className="action" onClick={() => setSheet('calendar')}><IconCalendar /><span>Calendar</span></button> : null}
          {canManage ? (
            <button type="button" className={`action${inWallet ? ' is-done' : ''}`} onClick={() => (inWallet ? router.push('/wallet') : setSheet('wallet'))}>
              {inWallet ? <IconCheck /> : <IconWallet />}<span>{inWallet ? 'In Wallet' : 'Add to Wallet'}</span>
            </button>
          ) : null}
        </div>

        {canManage ? (
          <ul className="rows">
            <li><button type="button" onClick={() => (changeable ? setSheet('change') : setLateNotice(true))}><span>Change date or gym</span><IconChevron /></button></li>
            <li><button type="button" onClick={() => (changeable ? setSheet('cancel') : setLateNotice(true))}><span>Cancel booking</span><IconChevron /></button></li>
            <li><button type="button" onClick={() => (user?.is_demo || door.help ? setSheet('help') : setEarlyHelp(true))}><span className="row-help"><IconHelp /> I can't get in</span><IconChevron /></button></li>
          </ul>
        ) : !used && door.help ? (
          <ul className="rows">
            <li><button type="button" onClick={() => setSheet('help')}><span className="row-help"><IconHelp /> I couldn't get in</span><IconChevron /></button></li>
          </ul>
        ) : null}
        {earlyHelp ? <p className="fine" role="status">This is for problems at the door, so it opens on the day of your session.</p> : null}
        {lateNotice ? <p className="form-error" role="alert">This visit is less than 24 hours away, so changes are no longer possible.</p> : canManage ? <p className="fine">You can change or cancel until 24 hours before your session.</p> : null}
      </div>

      <Sheet open={sheet === 'directions'} onClose={close} title="Get directions">
        <p className="sheet-sub">Open the route to {b.gym_name}.</p>
        <div className="link-list">
          <a className="btn btn-white btn-block" href={directions.google} target="_blank" rel="noopener noreferrer">Google Maps</a>
          <a className="btn btn-white btn-block" href={directions.apple} target="_blank" rel="noopener noreferrer">Apple Maps</a>
          <a className="btn btn-ghost btn-block" href={directions.web} target="_blank" rel="noopener noreferrer">No maps app? Open in browser</a>
        </div>
      </Sheet>

      <Sheet open={sheet === 'calendar'} onClose={close} title="Add to calendar">
        <p className="sheet-sub">Both include the gym's address. The calendar file also reminds you the day before.</p>
        <div className="link-list">
          <a className="btn btn-white btn-block" href={googleCal} target="_blank" rel="noopener noreferrer">Google Calendar</a>
          <a className="btn btn-ghost btn-block" href={`/api/bookings/${b.id}/calendar`}>Download calendar file</a>
        </div>
      </Sheet>

      <Sheet open={sheet === 'wallet'} onClose={close} title="Add to Wallet">
        <AddToWallet b={b} onAdded={() => { setInWallet(true); router.refresh(); }} onClose={close} />
      </Sheet>

      <Sheet open={sheet === 'desk'} onClose={close} title="Show at the desk" hideTitle full className="sheet-desk">
        {sheet === 'desk' ? (
          <DeskMode
            b={b}
            qrSvg={pass.qrSvg}
            canSimulate={!!user?.is_demo || door.scan}
            onCheckedIn={(at) => {
              setInAt(at);
              afterChange();
              banner({ title: 'Daypass', body: `Checked in at ${b.gym_name}. Enjoy your session.`, href: '/inbox' });
            }}
            onClose={close}
          />
        ) : null}
      </Sheet>

      <Sheet open={sheet === 'change'} onClose={close} title="Change booking" className="sheet-change">
        {sheet === 'change' ? (
          <ChangeFlow
            b={b}
            onDone={() => {
              close();
              toast('Booking updated');
              refresh();
              afterSheetClosed(() => {
                router.replace(`/bookings/${b.id}?updated=1`);
                router.refresh();
              });
            }}
          />
        ) : null}
      </Sheet>

      <Sheet open={sheet === 'cancel'} onClose={close} title="Cancel booking">
        <CancelFlow b={b} onClose={close} onDone={() => { close(); toast(`Cancelled. ${money(b.price_cents)} refunded`); afterChange(); }} />
      </Sheet>

      <Sheet open={sheet === 'help'} onClose={close} title="Can't get in?">
        <RefusedFlow b={b} onClose={close} onDone={() => { close(); toast(`${money(b.price_cents)} refunded`); afterChange(); }} />
      </Sheet>
    </>
  );
}

// Full-screen pass for reception: bright, large and kept awake.
function DeskMode({ b, qrSvg, canSimulate, onCheckedIn, onClose }: { b: PassBooking; qrSvg: string; canSimulate: boolean; onCheckedIn: (at: string) => void; onClose: () => void }) {
  const [time, setTime] = useState('');
  const [state, setState] = useState<'show' | 'scanning' | 'done'>('show');
  const [error, setError] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()));
    tick();
    const t = setInterval(tick, 1000);
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => {
      clearInterval(t);
      lock?.release().catch(() => {});
    };
  }, []);

  const simulate = async () => {
    setState('scanning');
    setError('');
    try {
      const [done] = await Promise.all([postAction(b.id, 'checkin'), new Promise((r) => setTimeout(r, 1200))]);
      setState('done');
      feel('success');
      onCheckedIn(done.checked_in_at);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setState('show');
    }
  };

  if (state === 'done') {
    return (
      <div className="desk-done" role="status">
        <FaceScan state="done" size={110} />
        <p>Checked in</p>
        <small>{b.gym_name}, {time}</small>
      </div>
    );
  }

  return (
    <div className={`desk is-${state}`}>
      <p className="desk-gym">{b.gym_name}</p>
      <p className="desk-when">{b.dateLabel}, {b.timeLabel}</p>
      <div className="desk-qr">
        <span dangerouslySetInnerHTML={{ __html: qrSvg }} aria-hidden="true" />
        <i className="desk-beam" aria-hidden="true" />
      </div>
      <p className="desk-code" aria-label={`Pass code ${b.code.split('').join(' ')}`}>{b.code}</p>
      <p className="desk-clock">{time}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {canSimulate ? <button type="button" className="desk-sim" disabled={state === 'scanning'} onClick={simulate}>{state === 'scanning' ? 'Scanning' : 'Demo: simulate the desk scan'}</button> : <p className="fine">Check-in opens one hour before your session.</p>}
    </div>
  );
}

// From the moment someone is let in: a running timer, then the times once they have left.
function VisitClock({ id, timezone, inAt, outAt, onOut }: { id: string; timezone: string; inAt: string; outAt: string | null; onOut: (at: string | null) => void }) {
  const { toast } = useFeedback();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const state = visitState(inAt, outAt, now ?? new Date(inAt).getTime());

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { checked_out_at: at } = await postAction(id, 'exit');
      feel('success');
      onOut(at);
      toast(`Checked out after ${stayLabel(new Date(at).getTime() - new Date(inAt).getTime())}`, 'ok', {
        label: 'Undo',
        onClick: () => {
          postAction(id, 'exit-undo').then(() => onOut(null)).catch((e) => toast(e instanceof Error ? e.message : 'That did not work. Try again.', 'error'));
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not work. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'inside') {
    return (
      <section className="visit-clock is-live" aria-label="Time in the gym">
        <p className="visit-clock-head"><i className="live-dot" aria-hidden="true" /> In the gym since {timeLabel(inAt, timezone)}</p>
        <StayTimer from={inAt} className="visit-clock-time" />
        <SwipeAction label="Slide to check out" ariaLabel="Check out now" onConfirm={leave} />
      </section>
    );
  }
  return (
    <section className="visit-clock" aria-label="Your visit">
      <dl className="visit-times">
        <div><dt>In</dt><dd>{timeLabel(inAt, timezone)}</dd></div>
        <div><dt>Out</dt><dd>{outAt ? timeLabel(outAt, timezone) : 'Not recorded'}</dd></div>
        <div><dt>Time inside</dt><dd>{outAt ? stayLabel(new Date(outAt).getTime() - new Date(inAt).getTime()) : 'Unknown'}</dd></div>
      </dl>
    </section>
  );
}

function AddToWallet({ b, onAdded, onClose }: { b: PassBooking; onAdded: () => void; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [error, setError] = useState('');
  const add = async () => {
    setState('adding');
    setError('');
    try {
      await Promise.all([postAction(b.id, 'wallet'), new Promise((r) => setTimeout(r, 650))]);
      setState('added');
      feel('success');
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setState('idle');
    }
  };
  return (
    <div className="wprev">
      <div className={`wprev-phone is-${state}`} aria-hidden="true">
        <div className="wprev-card wprev-a"><span>Library card</span></div>
        <div className="wprev-card wprev-b"><span>Metro pass</span></div>
        <div className="wprev-card wprev-pass">
          <p><Spark width={14} height={14} /> Daypass</p>
          <strong>{b.gym_name}</strong>
          <span>{b.dateLabel}, {b.timeLabel}</span>
          <i className="wprev-holo" />
        </div>
      </div>
      <p role="status" className="sheet-sub">{state === 'added' ? `${b.gym_name} is in your Wallet.` : 'Keep your pass with your other cards, ready for the desk.'}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {state === 'added' ? (
        <div className="link-list">
          <Link href="/wallet" className="btn btn-volt btn-block" onClick={(e) => { e.preventDefault(); onClose(); afterSheetClosed(() => router.push('/wallet')); }}>View in Wallet</Link>
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>Done</button>
        </div>
      ) : (
        <button type="button" className="btn btn-volt btn-block" disabled={state === 'adding'} onClick={add}>{state === 'adding' ? 'Adding' : 'Add to Wallet'}</button>
      )}
      <p className="fine">Demo Wallet inside Daypass. A real phone wallet pass needs Apple and Google developer accounts.</p>
    </div>
  );
}

function RefusedFlow({ b, onClose, onDone }: { b: PassBooking; onClose: () => void; onDone: () => void }) {
  const REASONS = ['The gym would not accept my pass', 'The gym was closed', 'My code did not work', 'Something else'];
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await postAction(b.id, 'refused', { reason });
      haptic(14);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className="link-list">
      <p className="sheet-sub">First, show staff your code: <strong>{b.code}</strong>. If you still can't get in, you get your {money(b.price_cents)} back.</p>
      <div className="reasons" role="radiogroup" aria-label="What happened">
        {REASONS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => { setReason(r); haptic(4); }}><i aria-hidden="true" />{r}</button>
        ))}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-volt btn-block" disabled={busy} onClick={send}>{busy ? 'Sending' : `Refund ${money(b.price_cents)}`}</button>
      <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={onClose}>I got in after all</button>
    </div>
  );
}

function CancelFlow({ b, onClose, onDone }: { b: PassBooking; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${b.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className="link-list">
      <p className="sheet-sub">{b.gym_name}, {b.dateLabel} at {b.timeLabel}. You get {money(b.price_cents)} back and the spot opens up for someone else.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={confirm}>{busy ? 'Cancelling' : 'Cancel booking'}</button>
      <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={onClose}>Keep booking</button>
    </div>
  );
}

function ChangeFlow({ b, onDone }: { b: PassBooking; onDone: () => void }) {
  const router = useRouter();
  const [gym, setGym] = useState({ id: b.gym_id, name: b.gym_name, price_cents: b.price_cents, timezone: b.timezone });
  const [step, setStep] = useState<'time' | 'gym' | 'review'>('time');
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [others, setOthers] = useState<Gym[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState(false);
  const paidOk = useRef(false);

  useEffect(() => {
    let live = true;
    setDays(null);
    setSelected(null);
    setError('');
    fetch(`/api/gyms/${gym.id}/slots`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (!d.days) throw new Error();
        setDays(d.days);
        // Show the gym's current price, so any difference is seen before confirming.
        if (d.gym?.price_cents) setGym((g) => (g.id === d.gym.id ? { ...g, price_cents: d.gym.price_cents } : g));
        setDayIndex(Math.max(0, (d.days as SlotDay[]).findIndex((x) => x.free > 0)));
      })
      .catch(() => live && setError('Open times did not load. Close this and try again.'));
    return () => {
      live = false;
    };
  }, [gym.id]);

  const openGyms = async () => {
    setError('');
    setStep('gym');
    if (others) return;
    try {
      const r = await fetch('/api/gyms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: b.lat, lng: b.lng, sort: 'nearest' }) });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setOthers(d.gyms);
    } catch {
      setStep('time');
      setError('Nearby gyms did not load. Try again.');
    }
  };

  const difference = gym.price_cents - b.price_cents;

  const submit = async (method?: PayMethod) => {
    const res = await fetch(`/api/bookings/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt: selected, gymId: gym.id, method, version: b.version }) });
    const data = await res.json();
    // Catch up with the newer booking, so the next try starts from the right place.
    if (data.code === 'stale') router.refresh();
    if (!res.ok) throw new Error(data.error);
    paidOk.current = true;
  };

  const confirm = async () => {
    if (difference > 0) {
      setWallet(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submit();
      haptic(14);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change did not go through.');
      setBusy(false);
    }
  };

  if (step === 'gym') {
    const list = (others ?? []).filter((g) => g.id !== gym.id).slice(0, 12);
    return (
      <div className="change-step">
        <button type="button" className="back-link" onClick={() => setStep('time')}><IconBack width={18} height={18} /> Back to times</button>
        <p className="sheet-sub">Move to another gym near {b.gym_name}.</p>
        {others === null ? <p className="note">Loading gyms</p> : list.length === 0 ? <p className="note">No other gyms nearby right now.</p> : (
          <ul className="gym-pick">
            {list.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => { setGym({ id: g.id, name: g.name, price_cents: g.price_cents, timezone: g.timezone }); setStep('time'); haptic(4); }}>
                  <strong>{g.name}</strong>
                  <span>{money(g.price_cents)}{g.distance_km != null ? `, ${distanceLabel(Number(g.distance_km))} away` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (step === 'review' && selected) {
    return (
      <div className="change-step">
        <div className="compare">
          <div><span>Now</span><strong>{b.gym_name}</strong><p>{b.dateLabel}, {b.timeLabel}</p></div>
          <div className="compare-new"><span>New</span><strong>{gym.name}</strong><p>{dateLabel(selected, gym.timezone)}, {timeLabel(selected, gym.timezone)}</p></div>
        </div>
        {difference > 0 ? <p className="sheet-sub">This costs {money(difference)} more. You pay the difference.</p> : null}
        {difference < 0 ? <p className="sheet-sub">This costs less. You get {money(-difference)} back.</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="button" className="btn btn-volt btn-block" disabled={busy} onClick={confirm}>{busy ? 'Saving' : difference > 0 ? `Pay ${money(difference)} and confirm` : 'Confirm change'}</button>
        <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => { setStep('time'); setError(''); }}>Back</button>
        <WalletSheet
          open={wallet}
          merchant={gym.name}
          amountCents={difference}
          lines={[{ label: 'Price difference', value: `${money(b.price_cents)} to ${money(gym.price_cents)}` }]}
          allowSave={false}
          onPay={async (m) => submit(m)}
          onClose={() => setWallet(false)}
          onDone={() => { setWallet(false); onDone(); }}
        />
      </div>
    );
  }

  return (
    <div className="change-step">
      <p className="sheet-sub">Open times at <strong>{gym.name}</strong>.</p>
      <div className="change-picker">
        {days ? <SlotPicker days={days} dayIndex={dayIndex} onDay={(i) => { setDayIndex(i); setSelected(null); }} selected={selected} onSelect={setSelected} exclude={gym.id === b.gym_id ? new Date(b.starts_at).toISOString() : null} /> : error ? null : <p className="note">Loading open times</p>}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-volt btn-block" disabled={!selected} onClick={() => setStep('review')}>Review change</button>
      <button type="button" className="btn btn-ghost btn-block" onClick={openGyms}>Move to another gym</button>
    </div>
  );
}

// In-app links aren't full page loads, so a pass is saved for offline use whenever it is on screen.
export function SaveForOffline({ id, version }: { id: string; version: string }) {
  useEffect(() => {
    savePagesForOffline([`/bookings/${id}`, '/bookings', '/wallet']);
  }, [id, version]);
  return null;
}
