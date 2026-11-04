'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, distanceLabel, money, timeLabel } from '@/lib/format';
import type { Gym, SlotDay } from '@/lib/gyms';
import type { PayMethod } from '@/lib/payments';
import { IconCalendar, IconClose, IconRoute, IconWallet, Spark } from './Icons';
import { SlotPicker } from './SlotPicker';
import { WalletSheet } from './WalletSheet';

type B = { id: string; code: string; gym_id: string; gym_name: string; gym_city: string; starts_at: string; price_cents: number; timezone: string; lat: number; lng: number; dateLabel: string; timeLabel: string };
type Props = { booking: B; directions: { google: string; apple: string; web: string }; googleCal: string; changeable: boolean; isPast: boolean };
type Sheet = 'directions' | 'calendar' | 'wallet' | 'change' | 'cancel' | null;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className="sheet-dialog" aria-labelledby="sheet-title" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="sheet-dialog-head">
        <h2 id="sheet-title">{title}</h2>
        <button type="button" className="round" aria-label="Close" onClick={onClose}><IconClose /></button>
      </div>
      <div className="sheet-dialog-body">{children}</div>
    </dialog>
  );
}

export function BookingActions({ booking: b, directions, googleCal, changeable, isPast }: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [lateNotice, setLateNotice] = useState(false);
  const close = () => setSheet(null);

  return (
    <div className="actions">
      <div className="action-grid">
        <button type="button" className="action" onClick={() => setSheet('directions')}><IconRoute /><span>Get directions</span></button>
        {!isPast ? <button type="button" className="action" onClick={() => setSheet('calendar')}><IconCalendar /><span>Add to calendar</span></button> : null}
        {!isPast ? <button type="button" className="action" onClick={() => setSheet('wallet')}><IconWallet /><span>Add to wallet</span></button> : null}
      </div>

      {!isPast ? (
        <div className="manage">
          <button type="button" className="btn btn-white btn-block" onClick={() => (changeable ? setSheet('change') : setLateNotice(true))}>Change date or gym</button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => (changeable ? setSheet('cancel') : setLateNotice(true))}>Cancel booking</button>
          {lateNotice ? <p className="form-error" role="alert">This visit is less than 24 hours away, so changes are no longer possible.</p> : <p className="fine">You can change or cancel until 24 hours before your session.</p>}
        </div>
      ) : null}

      {sheet === 'directions' ? (
        <Sheet title="Get directions" onClose={close}>
          <p className="sheet-dialog-sub">Open the route to {b.gym_name}.</p>
          <div className="link-list">
            <a className="btn btn-white btn-block" href={directions.google} target="_blank" rel="noopener noreferrer">Google Maps</a>
            <a className="btn btn-white btn-block" href={directions.apple} target="_blank" rel="noopener noreferrer">Apple Maps</a>
            <a className="btn btn-ghost btn-block" href={directions.web} target="_blank" rel="noopener noreferrer">No maps app? Open in browser</a>
          </div>
        </Sheet>
      ) : null}

      {sheet === 'calendar' ? (
        <Sheet title="Add to calendar" onClose={close}>
          <p className="sheet-dialog-sub">Both options include the gym's address. The calendar file also reminds you the day before.</p>
          <div className="link-list">
            <a className="btn btn-white btn-block" href={googleCal} target="_blank" rel="noopener noreferrer">Google Calendar</a>
            <a className="btn btn-ghost btn-block" href={`/api/bookings/${b.id}/calendar`}>Download calendar file</a>
          </div>
        </Sheet>
      ) : null}

      {sheet === 'wallet' ? <Sheet title="Wallet preview" onClose={close}><WalletPreview b={b} /></Sheet> : null}

      {sheet === 'change' ? <Sheet title="Change booking" onClose={close}><ChangeFlow b={b} onDone={() => { close(); router.push(`/bookings/${b.id}?updated=1`); router.refresh(); }} /></Sheet> : null}

      {sheet === 'cancel' ? <Sheet title="Cancel booking" onClose={close}><CancelFlow b={b} onDone={() => { close(); router.refresh(); }} /></Sheet> : null}
    </div>
  );
}

function WalletPreview({ b }: { b: B }) {
  const [added, setAdded] = useState(false);
  return (
    <div className="wprev">
      <div className={`wprev-phone${added ? ' is-added' : ''}`} aria-hidden="true">
        <div className="wprev-card wprev-a"><span>Library card</span></div>
        <div className="wprev-card wprev-b"><span>Transit</span></div>
        <div className="wprev-card wprev-pass">
          <p><Spark width={14} height={14} /> Daypass</p>
          <strong>{b.gym_name}</strong>
          <span>{b.dateLabel}, {b.timeLabel}</span>
          <i className="wprev-holo" />
        </div>
      </div>
      <p role="status" className="sheet-dialog-sub">{added ? 'Pass added to this preview.' : 'See how your pass would sit in a phone wallet.'}</p>
      <button type="button" className="btn btn-volt btn-block" disabled={added} onClick={() => setAdded(true)}>{added ? 'Added' : 'Add pass to preview'}</button>
      <p className="fine">Preview only. A real wallet pass needs Apple and Google developer accounts.</p>
    </div>
  );
}

function CancelFlow({ b, onDone }: { b: B; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/bookings/${b.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    onDone();
  };
  return (
    <div className="link-list">
      <p className="sheet-dialog-sub">{b.gym_name}, {b.dateLabel} at {b.timeLabel}. You get {money(b.price_cents)} back and the spot goes back on sale.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={confirm}>{busy ? 'Cancelling' : 'Cancel booking'}</button>
      <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={onDone}>Keep booking</button>
    </div>
  );
}

function ChangeFlow({ b, onDone }: { b: B; onDone: () => void }) {
  const [gym, setGym] = useState({ id: b.gym_id, name: b.gym_name, price_cents: b.price_cents, timezone: b.timezone });
  const [step, setStep] = useState<'time' | 'gym' | 'review'>('time');
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [others, setOthers] = useState<Gym[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState(false);

  useEffect(() => {
    let live = true;
    setDays(null);
    setSelected(null);
    fetch(`/api/gyms/${gym.id}/slots`).then((r) => r.json()).then((d) => {
      if (!live) return;
      setDays(d.days);
      setDayIndex(Math.max(0, (d.days as SlotDay[]).findIndex((x) => x.free > 0)));
    }).catch(() => live && setError('Free times did not load. Close this and try again.'));
    return () => { live = false; };
  }, [gym.id]);

  const openGyms = async () => {
    setStep('gym');
    if (others) return;
    const r = await fetch(`/api/gyms?lat=${b.lat}&lng=${b.lng}&sort=nearest`);
    const d = await r.json();
    setOthers(r.ok ? d.gyms : []);
  };

  const difference = gym.price_cents - b.price_cents;

  const submit = async (method?: PayMethod) => {
    const res = await fetch(`/api/bookings/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt: selected, gymId: gym.id, method }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
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
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change did not go through.');
      setBusy(false);
    }
  };

  if (step === 'gym') {
    return (
      <div>
        <p className="sheet-dialog-sub">Move to another gym near {b.gym_name}.</p>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep('time')}>Back to times</button>
        <ul className="gym-pick">
          {others === null ? <li className="note">Loading gyms</li> : others.filter((g) => g.id !== gym.id).slice(0, 12).map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => { setGym({ id: g.id, name: g.name, price_cents: g.price_cents, timezone: g.timezone }); setStep('time'); }}>
                <strong>{g.name}</strong>
                <span>{money(g.price_cents)}{g.distance_km != null ? `, ${distanceLabel(Number(g.distance_km))} from your booked gym` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (step === 'review' && selected) {
    return (
      <div className="link-list">
        <div className="compare">
          <div><span>Now</span><strong>{b.gym_name}</strong><p>{b.dateLabel}, {b.timeLabel}</p></div>
          <div className="compare-new"><span>New</span><strong>{gym.name}</strong><p>{dateLabel(selected, gym.timezone)}, {timeLabel(selected, gym.timezone)}</p></div>
        </div>
        {difference > 0 ? <p className="sheet-dialog-sub">This gym costs {money(difference)} more. You pay the difference.</p> : null}
        {difference < 0 ? <p className="sheet-dialog-sub">This gym costs less. You get {money(-difference)} back.</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="button" className="btn btn-volt btn-block" disabled={busy} onClick={confirm}>{busy ? 'Saving' : difference > 0 ? `Pay ${money(difference)} and confirm` : 'Confirm change'}</button>
        <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => { setStep('time'); setError(''); }}>Back</button>
        {wallet ? (
          <WalletSheet
            merchant={gym.name}
            amountCents={difference}
            lines={[{ label: 'Price difference', value: `${money(b.price_cents)} to ${money(gym.price_cents)}` }]}
            allowSave={false}
            onPay={async (m) => submit(m)}
            onClose={() => setWallet(false)}
            onDone={onDone}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="change-time">
      <p className="sheet-dialog-sub">Free times at <strong>{gym.name}</strong>.</p>
      <div className="change-picker">
        {days ? <SlotPicker days={days} dayIndex={dayIndex} onDay={(i) => { setDayIndex(i); setSelected(null); }} selected={selected} onSelect={setSelected} exclude={gym.id === b.gym_id ? new Date(b.starts_at).toISOString() : null} /> : <p className="note">Loading free times</p>}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-volt btn-block" disabled={!selected} onClick={() => setStep('review')}>Review change</button>
      <button type="button" className="btn btn-ghost btn-block" onClick={openGyms}>Move to another gym</button>
    </div>
  );
}
