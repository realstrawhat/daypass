'use client';
import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/format';
import type { PayMethod } from '@/lib/payments';
import { IconCheck, Spark } from './Icons';
import { FaceScan } from './ui/FaceScan';
import { haptic } from './ui/feedback';
import { feel } from './ui/sensory';
import { Sheet } from './ui/Sheet';

type Line = { label: string; value: string };
type Props = {
  open: boolean;
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
  { id: 'demo-card', name: 'Demo card', detail: '•••• 4242', tone: 'is-ink' },
  { id: 'demo-wallet', name: 'Demo balance', detail: '€240.00', tone: 'is-volt' },
  { id: 'demo-decline', name: 'Test decline', detail: 'Always fails', tone: 'is-alert' },
];

// A checkout sheet in the style of a phone wallet. It is a simulation: no card details are asked for.
export function WalletSheet({ open, merchant, amountCents, lines, savedCard, allowSave = true, onPay, onClose, onDone }: Props) {
  const [method, setMethod] = useState<PayMethod>('demo-card');
  const [save, setSave] = useState(false);
  const [state, setState] = useState<'idle' | 'paying' | 'done' | 'failed'>('idle');
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    if (open) {
      setMethod(savedCard?.brand === 'Demo wallet' ? 'demo-wallet' : 'demo-card');
      setSave(false);
      setState('idle');
      setError('');
      busy.current = false;
    }
  }, [open, savedCard?.brand]);

  const pay = async () => {
    if (busy.current) return;
    busy.current = true;
    setState('paying');
    setError('');
    haptic(10);
    try {
      await Promise.all([onPay(method, save), new Promise((r) => setTimeout(r, 1100))]);
      setState('done');
      feel('success');
      setTimeout(onDone, 750);
    } catch (e) {
      setState('failed');
      setError(e instanceof Error ? e.message : 'Payment did not go through.');
      feel('error');
      busy.current = false;
    }
  };

  const running = state === 'paying' || state === 'done';
  const order = METHODS.map((m) => m.id);
  const selectedIndex = order.indexOf(method);

  return (
    <Sheet open={open} onClose={onClose} title="Demo Pay" hideTitle locked={running} keepHistory={state === 'done'} className={`sheet-wallet is-${state}`}>
      <p className="wallet-brand"><Spark /> Demo Pay</p>

      <div className="wallet-stack" role="radiogroup" aria-label="Choose how to pay" style={{ '--count': METHODS.length } as React.CSSProperties}>
        {METHODS.map((m, i) => {
          // The chosen card sits in front. The others peek out behind it.
          const depth = (i - selectedIndex + METHODS.length) % METHODS.length;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              className={`wallet-card ${m.tone}`}
              style={{ '--depth': depth, zIndex: METHODS.length - depth } as React.CSSProperties}
              disabled={running}
              onClick={() => { setMethod(m.id); haptic(6); if (state === 'failed') setState('idle'); }}
            >
              <span className="wallet-card-top"><Spark width={16} height={16} /> {m.name}</span>
              <span className="wallet-card-detail">{m.detail}</span>
              {method === m.id ? <i aria-hidden="true"><IconCheck /></i> : null}
            </button>
          );
        })}
      </div>

      <dl className="wallet-lines">
        <div><dt>Pay to</dt><dd>{merchant}</dd></div>
        {lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}
        <div className="wallet-total"><dt>Total</dt><dd>{money(amountCents)}</dd></div>
      </dl>

      {allowSave ? (
        <button type="button" className="switch-row is-compact" role="switch" aria-checked={save} disabled={method === 'demo-decline' || running} onClick={() => { setSave(!save); haptic(4); }}>
          <span><strong>Save for next time</strong></span>
          <i className="switch" aria-hidden="true" />
        </button>
      ) : null}

      {state === 'failed' ? <p className="wallet-error" role="alert">{error} Choose another card to try again.</p> : null}

      <button type="button" className={`wallet-pay is-${state}`} onClick={pay} disabled={running}>
        {state === 'idle' || state === 'failed' ? <>Pay {money(amountCents)}</> : null}
        {state === 'paying' ? <><FaceScan size={30} /> Confirming</> : null}
        {state === 'done' ? <><FaceScan size={30} state="done" /> Paid</> : null}
      </button>
      <p className="wallet-fine" role="status">{state === 'done' ? 'Payment complete.' : 'Demo payment. No real money moves and no card details are collected.'}</p>
    </Sheet>
  );
}
