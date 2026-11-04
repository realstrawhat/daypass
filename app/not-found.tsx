import Link from 'next/link';
import { Spark } from '@/components/Icons';

export default function NotFound() {
  return (
    <main className="simple-page center state-page">
      <Spark width={56} height={56} className="state-spark" />
      <h1 className="page-title">Wrong turn</h1>
      <p>This page does not exist. There are plenty of gyms that do.</p>
      <Link href="/gyms" className="btn btn-volt">Find a gym</Link>
    </main>
  );
}
