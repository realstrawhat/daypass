'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateLabel, money, timeLabel } from '@/lib/format';
import type { SlotDay } from '@/lib/gyms';
import type { PayMethod } from '@/lib/payments';
import { AuthForm } from './AuthForm';
import { IconClose } from './Icons';
import { SlotPicker } from './SlotPicker';
import { WalletSheet } from './WalletSheet';

type Props = {
  gym: { id: string; name: string; price_cents: number; timezone: string };
  days: SlotDay[];
  loggedIn: boolean;
  savedCard: { brand: string; last4: string } | null;
};

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function BookingPanel({ gym, days, loggedIn, savedCard }: Props) {
  const router = useRouter();
  const firstOpen = Math.max(0, days.findIndex((d) => d.free > 0));
  const [dayIndex, setDayIndex] = useState(firstOpen);
  const [selected, setSelected] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(loggedIn);
  const key = useRef(newKey());
  const holdId = useRef<string | null>(null);
  const bookedId = useRef<string | null>(null);
  const authDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = authDialog.current;
    if (!d) return;
    if (authOpen && !d.open) d.showModal();
    if (!authOpen && d.open) d.close();
  }, [authOpen]);

  // Each selection is its own checkout attempt, so an old hold can never be paid for a new slot.
  const resetCheckout = () => {
    key.current = newKey();
    holdId.current = null;
  };

  const hold = async () => {
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymId: gym.id, startsAt: selected, key: key.current }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    holdId.current = data.booking.id;
  };

  const startCheckout = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await hold();
      setWalletOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That time could not be held. Pick another slot.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // Browsing is open to everyone. Login happens here, at the moment of booking.
  const book = () => {
    if (!selected) return;
    if (!signedIn) setAuthOpen(true);
    else startCheckout();
  };

  const pay = async (method: PayMethod, saveCard: boolean) => {
    if (!holdId.current) {
      key.current = newKey();
      await hold();
    }
    const res = await fetch(`/api/checkout/${holdId.current}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, saveCard }) });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === 'declined') holdId.current = null;
      throw new Error(data.error);
    }
    bookedId.current = data.booking.id;
  };

  const selectedLabel = selected ? `${dateLabel(selected, gym.timezone)}, ${timeLabel(selected, gym.timezone)}` : null;

  return (
    <section className="book" id="book" aria-labelledby="book-title">
      <div className="book-head">
        <h2 id="book-title">Book a session</h2>
        <p><strong>{money(gym.price_cents)}</strong> one visit</p>
      </div>
      <SlotPicker days={days} dayIndex={dayIndex} onDay={(i) => { setDayIndex(i); setSelected(null); setError(''); resetCheckout(); }} selected={selected} onSelect={(s) => { setSelected(s); setError(''); resetCheckout(); }} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="book-summary" aria-live="polite">{selectedLabel ?? 'Pick a free time to continue.'}</p>
      <button type="button" className="btn btn-volt btn-block book-cta" disabled={!selected || busy} onClick={book}>
        {busy ? 'Holding your spot' : selected ? `Book for ${money(gym.price_cents)}` : 'Book'}
      </button>
      <p className="fine">Free to change or cancel until 24 hours before.</p>

      <dialog ref={authDialog} className="sheet-dialog" aria-labelledby="auth-title" onCancel={() => setAuthOpen(false)}>
        <div className="sheet-dialog-head">
          <h2 id="auth-title">Log in to book</h2>
          <button type="button" className="round" aria-label="Close" onClick={() => setAuthOpen(false)}><IconClose /></button>
        </div>
        <p className="sheet-dialog-sub">Your booking is saved to your account{selectedLabel ? `. ${selectedLabel} stays selected` : ''}.</p>
        {authOpen ? (
          <AuthForm onDone={() => { setSignedIn(true); setAuthOpen(false); router.refresh(); startCheckout(); }} />
        ) : null}
      </dialog>

      {walletOpen && selected ? (
        <WalletSheet
          merchant={gym.name}
          amountCents={gym.price_cents}
          lines={[{ label: 'Session', value: selectedLabel ?? '' }]}
          savedCard={savedCard}
          onPay={pay}
          onClose={() => { setWalletOpen(false); resetCheckout(); router.refresh(); }}
          onDone={() => { router.push(`/bookings/${bookedId.current}?new=1`); }}
        />
      ) : null}
    </section>
  );
}
