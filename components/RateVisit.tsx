'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconStar } from './Icons';
import { useSession } from './session';
import { haptic, useFeedback } from './ui/feedback';

export function RateVisit({ bookingId, gymName, initial }: { bookingId: string; gymName: string; initial: number | null }) {
  const router = useRouter();
  const { refresh } = useSession();
  const { toast } = useFeedback();
  const [stars, setStars] = useState(initial ?? 0);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>(initial ? 'done' : 'idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stars) {
      setError('Choose from 1 to 5 stars.');
      return;
    }
    setState('busy');
    setError('');
    try {
      const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, stars, body: text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState('done');
      toast('Thanks for rating your visit');
      refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your rating did not save. Try again.');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <div className="rate-done" id="rate" role="status">
        <span className="rate-done-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, n) => <IconStar key={n} width={20} height={20} className={n < stars ? 'on' : ''} />)}</span>
        <p>You rated {gymName} {stars} out of 5.</p>
      </div>
    );
  }

  return (
    <form className="rate-form" id="rate" onSubmit={submit}>
      <h2>How was {gymName}?</h2>
      <div className="rate-stars" role="radiogroup" aria-label="Your rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} className={n <= stars ? 'on' : ''} onClick={() => { setStars(n); haptic(6); }}><IconStar width={32} height={32} /></button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="rate-text">Add a review (optional)</label>
        <textarea id="rate-text" rows={3} maxLength={800} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-white btn-block" disabled={state === 'busy'}>{state === 'busy' ? 'Saving' : 'Submit rating'}</button>
    </form>
  );
}
