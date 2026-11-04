'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, distanceLabel, money, timeLabel } from '@/lib/format';
import type { Gym, SlotDay } from '@/lib/gyms';
import type { PayMethod } from '@/lib/payments';
import { HoloPass, type PassData } from './HoloPass';
import { IconBack, IconCalendar, IconCheck, IconChevron, IconHelp, IconRoute, IconScan, IconWallet, Spark } from './Icons';
import { useSession } from './session';
import { SlotPicker } from './SlotPicker';
import { FaceScan } from './ui/FaceScan';
import { haptic, useFeedback } from './ui/feedback';
import { Sheet } from './ui/Sheet';
import { WalletSheet } from './WalletSheet';

export type PassBooking = {
  id: string;
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
  const { refresh } = useSession();
  const { toast, banner } = useFeedback();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [lateNotice, setLateNotice] = useState(false);
  const [inWallet, setInWallet] = useState(b.in_wallet);
  const [checkedIn, setCheckedIn] = useState(!!b.checked_in_at);
  const close = () => setSheet(null);
  const used = checkedIn;
  const canManage = !isOver && !used;

  const afterChange = () => {
    refresh();
    router.refresh();
  };

  return (
    <>
      <HoloPass pass={{ ...pass, state: used ? 'used' : 'active' }} stamp={isNew} />

      <div className="pass-actions">
        {!used && !isOver ? (
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
            <li><button type="button" onClick={() => setSheet('help')}><span className="row-help"><IconHelp /> I can't get in</span><IconChevron /></button></li>
          </ul>
        ) : null}
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
            onCheckedIn={() => {
              setCheckedIn(true);
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
              router.replace(`/bookings/${b.id}?updated=1`);
              router.refresh();
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
function DeskMode({ b, qrSvg, onCheckedIn, onClose }: { b: PassBooking; qrSvg: string; onCheckedIn: () => void; onClose: () => void }) {
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
      await Promise.all([postAction(b.id, 'checkin'), new Promise((r) => setTimeout(r, 1200))]);
      setState('done');
      haptic(20);
      onCheckedIn();
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
      <button type="button" className="desk-sim" disabled={state === 'scanning'} onClick={simulate}>{state === 'scanning' ? 'Scanning' : 'Demo: simulate the desk scan'}</button>
    </div>
  );
}

function AddToWallet({ b, onAdded, onClose }: { b: PassBooking; onAdded: () => void; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [error, setError] = useState('');
  const add = async () => {
    setState('adding');
    setError('');
    try {
      await Promise.all([postAction(b.id, 'wallet'), new Promise((r) => setTimeout(r, 650))]);
      setState('added');
      haptic(14);
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
          <Link href="/wallet" className="btn btn-volt btn-block" onClick={onClose}>View in Wallet</Link>
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
      <p className="sheet-sub">First, show staff your code: <strong>{b.code}</strong>. If you still can't get in, you get your {money(b.price_cents)} back. We let the gym know.</p>
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
    setStep('gym');
    if (others) return;
    try {
      const r = await fetch('/api/gyms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: b.lat, lng: b.lng, sort: 'nearest' }) });
      const d = await r.json();
      setOthers(r.ok ? d.gyms : []);
    } catch {
      setOthers([]);
    }
  };

  const difference = gym.price_cents - b.price_cents;

  const submit = async (method?: PayMethod) => {
    const res = await fetch(`/api/bookings/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt: selected, gymId: gym.id, method }) });
    const data = await res.json();
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
