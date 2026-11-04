import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="simple-page center">
      <h1 className="page-title">Wrong turn</h1>
      <p>This page does not exist. Find a gym to get back on track.</p>
      <Link href="/gyms" className="btn btn-volt">Find a gym</Link>
    </main>
  );
}
