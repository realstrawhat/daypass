'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconStar } from './Icons';

export function RateVisit({ bookingId, gymName, initial }: { bookingId: string; gymName: string; initial: number | null }) {
  const router = useRouter();
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
    const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, stars, body: text }) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setState('idle');
      return;
    }
    setState('done');
    router.refresh();
  };

  if (state === 'done') {
    return <div className="banner banner-volt" id="rate" role="status"><strong>You rated {gymName} {stars} out of 5</strong><span>Thanks. It now counts towards the gym's rating.</span></div>;
  }

  return (
    <form className="rate" id="rate" onSubmit={submit}>
      <h2 className="section-title">Rate {gymName}</h2>
      <div className="rate-stars" role="radiogroup" aria-label="Your rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}><IconStar width={30} height={30} /></button>
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
