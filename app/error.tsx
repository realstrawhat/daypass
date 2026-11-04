'use client';
import { Spark } from '@/components/Icons';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="simple-page center state-page">
      <Spark width={56} height={56} className="state-spark" />
      <h1 className="page-title">That did not load</h1>
      <p>The screen hit a problem. Your bookings are safe. Try loading it again.</p>
      <button type="button" className="btn btn-volt" onClick={reset}>Try again</button>
    </main>
  );
}
