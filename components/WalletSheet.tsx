'use client';
import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/format';
import type { PayMethod } from '@/lib/payments';
import { IconCheck, IconClose, Spark } from './Icons';

type Line = { label: string; value: string };
type Props = {
  merchant: string;
  amountCents: number;
  lines: Line[];
  savedCard?: { brand: string; last4: string } | null;
  allowSave?: boolean;
  onPay: (method: PayMethod, saveCard: boolean) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
};

const METHODS: { id: PayMethod; name: string; detail: string; tone: string }[] = [
  { id: 'demo-card', name: 'Demo card', detail: '•••• 4242', tone: 'is-paper' },
  { id: 'demo-wallet', name: 'Demo wallet', detail: 'Balance', tone: 'is-volt' },
  { id: 'demo-decline', name: 'Declined test card', detail: 'Always fails', tone: 'is-alert' },
];

// A checkout sheet in the style of a phone wallet. It is a simulation: no card details are asked for.
export function WalletSheet({ merchant, amountCents, lines, savedCard, allowSave = true, onPay, onClose, onDone }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [method, setMethod] = useState<PayMethod>(savedCard?.brand === 'Demo wallet' ? 'demo-wallet' : 'demo-card');
  const [save, setSave] = useState(false);
  const [state, setState] = useState<'idle' | 'paying' | 'done' | 'failed'>('idle');
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const pay = async () => {
    if (busy.current) return;
    busy.current = true;
    setState('paying');
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 900));
      await onPay(method, save);
      setState('done');
      setTimeout(onDone, 1000);
    } catch (e) {
      setState('failed');
      setError(e instanceof Error ? e.message : 'Payment did not go through.');
      busy.current = false;
    }
  };

  return (
    <dialog
      ref={dialog}
      className="wallet"
      aria-labelledby="wallet-title"
      onCancel={(e) => {
        e.preventDefault();
        if (state !== 'paying' && state !== 'done') onClose();
      }}
    >
      <div className="wallet-top">
        <p className="wallet-brand" id="wallet-title"><Spark /> Demo Pay</p>
        <button type="button" className="round" aria-label="Close payment" disabled={state === 'paying' || state === 'done'} onClick={onClose}><IconClose /></button>
      </div>

      <div className="wallet-cards" role="radiogroup" aria-label="Choose how to pay">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={method === m.id}
            className={`wallet-card ${m.tone}`}
            disabled={state === 'paying' || state === 'done'}
            onClick={() => { setMethod(m.id); if (state === 'failed') setState('idle'); }}
          >
            <span className="wallet-card-name">{m.name}</span>
            <span className="wallet-card-detail">{m.detail}</span>
            {method === m.id ? <i aria-hidden="true"><IconCheck /></i> : null}
          </button>
        ))}
      </div>

      <dl className="wallet-lines">
        <div><dt>Pay to</dt><dd>{merchant}</dd></div>
        {lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}
        <div className="wallet-total"><dt>Total</dt><dd>{money(amountCents)}</dd></div>
      </dl>

      {allowSave ? (
        <label className="wallet-save">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} disabled={method === 'demo-decline'} />
          <span>Save this for next time</span>
        </label>
      ) : null}

      {state === 'failed' ? <p className="wallet-error" role="alert">{error} Choose another card to try again.</p> : null}

      <button type="button" className={`wallet-pay is-${state}`} onClick={pay} disabled={state === 'paying' || state === 'done'}>
        {state === 'idle' || state === 'failed' ? <>Pay {money(amountCents)}</> : null}
        {state === 'paying' ? <><span className="wallet-ring" aria-hidden="true" /> Confirming</> : null}
        {state === 'done' ? <><IconCheck /> Paid</> : null}
      </button>
      <p className="wallet-fine" role="status">{state === 'done' ? 'Payment complete.' : 'Demo payment. No real money moves and no card details are collected.'}</p>
    </dialog>
  );
}
