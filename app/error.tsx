'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="simple-page center">
      <h1 className="page-title">That did not load</h1>
      <p>The page hit a problem. Your bookings are safe. Try loading it again.</p>
      <button type="button" className="btn btn-volt" onClick={reset}>Try again</button>
    </main>
  );
}
