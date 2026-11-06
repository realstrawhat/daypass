'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, money, timeLabel } from '@/lib/format';
import { SESSION_RULE } from '@/lib/hours';
import type { SlotDay } from '@/lib/gyms';
import type { PayMethod } from '@/lib/payments';
import { useSession } from './session';
import { SlotPicker } from './SlotPicker';
import { haptic, useFeedback } from './ui/feedback';
import { SwipeAction } from './ui/SwipeAction';
import { WalletSheet } from './WalletSheet';

type Props = { gym: { id: string; name: string; price_cents: number; timezone: string } };

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function GymBooking({ gym }: Props) {
  const router = useRouter();
  const { user, requireLogin, refresh } = useSession();
  const { toast } = useFeedback();
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const key = useRef(newKey());
  const holdId = useRef<string | null>(null);
  const bookedId = useRef<string | null>(null);
  const section = useRef<HTMLElement>(null);

  const load = () => {
    setLoadError('');
    return fetch(`/api/gyms/${gym.id}/slots`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.days) throw new Error();
        setDays(d.days);
        setDayIndex((cur) => (d.days[cur]?.free ? cur : Math.max(0, d.days.findIndex((x: SlotDay) => x.free > 0))));
      })
      .catch(() => setLoadError('Open times did not load.'));
  };

  useEffect(() => {
    load();
    // Times load once for this gym.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym.id]);

  // The sticky bar steps aside while the booking card is on screen, so only one button shows.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPickerVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Each selection is its own checkout attempt, so an old hold can never be paid for a new slot.
  const resetCheckout = () => {
    key.current = newKey();
    holdId.current = null;
  };

  const hold = async (startsAt: string) => {
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId: gym.id, startsAt, key: key.current }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    holdId.current = data.booking.id;
  };

  const selectedLabel = selected ? `${dateLabel(selected, gym.timezone)}, ${timeLabel(selected, gym.timezone)}` : null;

  // Browsing is open to everyone. Login happens here, at the moment of booking.
  const book = async () => {
    if (!selected) return;
    haptic(8);
    const ok = await requireLogin('Log in to book', `${gym.name}, ${selectedLabel}, ${money(gym.price_cents)}. Your time stays selected.`);
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await hold(selected);
      setWalletOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That time could not be held. Pick another one.');
      load();
    } finally {
      setBusy(false);
    }
  };

  const pay = async (method: PayMethod, saveCard: boolean) => {
    if (!selected) throw new Error('Pick a time first.');
    if (!holdId.current) {
      key.current = newKey();
      await hold(selected);
    }
    const res = await fetch(`/api/checkout/${holdId.current}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, saveCard }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (['declined', 'hold_expired', 'hold_ended'].includes(data.code)) holdId.current = null;
      throw new Error(data.error || 'Payment did not go through.');
    }
    bookedId.current = data.booking.id;
  };

  const scrollToPicker = () => section.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });

  return (
    <>
      <section className="book" id="book" aria-labelledby="book-title" ref={section}>
        <div className="book-head">
          <h2 id="book-title">Book a session</h2>
          <p><strong>{money(gym.price_cents)}</strong> one visit</p>
        </div>
        {days ? (
          <SlotPicker days={days} dayIndex={dayIndex} onDay={(i) => { setDayIndex(i); setSelected(null); setError(''); resetCheckout(); }} selected={selected} onSelect={(s) => { setSelected(s); setError(''); resetCheckout(); }} />
        ) : loadError ? (
          <div className="book-retry"><p className="form-error" role="alert">{loadError}</p><button type="button" className="btn btn-ink" onClick={load}>Try again</button></div>
        ) : (
          <div className="picker" aria-hidden="true">
            <div className="day-strip">{Array.from({ length: 6 }, (_, i) => <span key={i} className="sk sk-day" />)}</div>
            <div className="time-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} className="sk sk-time" />)}</div>
          </div>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {selected && !busy ? (
          <SwipeAction key={selected} label={<><span>Swipe to book <em>{money(gym.price_cents)}</em></span><small>{selectedLabel}</small></>} ariaLabel={`Swipe to book ${money(gym.price_cents)} ${selectedLabel}`} onConfirm={book} />
        ) : (
          <button type="button" className="book-cta" disabled>
            <span key={selected ?? 'none'} className="book-cta-label">{busy ? 'Holding your spot' : 'Pick a time'}</span>
          </button>
        )}
        <p className="fine">{SESSION_RULE}. Free to change or cancel until 24 hours before. Refunded if the gym can't let you in.</p>
      </section>

      <div className={`book-bar${pickerVisible ? ' is-hidden' : ''}`} aria-hidden={pickerVisible}>
        {selected ? (
          <>
            <p><strong>{selectedLabel}</strong><small>{money(gym.price_cents)} one visit</small></p>
            <button type="button" className="btn btn-volt" tabIndex={pickerVisible ? -1 : 0} disabled={busy} onClick={book}>Book</button>
          </>
        ) : (
          <>
            <p><strong>{money(gym.price_cents)}</strong><small>one visit</small></p>
            <button type="button" className="btn btn-volt" tabIndex={pickerVisible ? -1 : 0} onClick={scrollToPicker}>Choose a time</button>
          </>
        )}
      </div>

      {selected ? (
        <WalletSheet
          open={walletOpen}
          merchant={gym.name}
          amountCents={gym.price_cents}
          lines={[{ label: 'Session', value: selectedLabel ?? '' }]}
          savedCard={user?.saved_card}
          onPay={pay}
          onClose={() => { setWalletOpen(false); resetCheckout(); load(); }}
          onDone={() => {
            setWalletOpen(false);
            refresh().catch(() => {});
            router.refresh();
            if (bookedId.current) router.push(`/bookings/${bookedId.current}?new=1`, { transitionTypes: ['nav-forward'] });
            else toast('Your booking is in Passes.');
          }}
        />
      ) : null}
    </>
  );
}
