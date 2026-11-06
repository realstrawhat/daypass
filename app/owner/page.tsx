import type { Metadata } from 'next';
import { OwnerGate, OwnerPanel } from '@/components/OwnerPanel';
import { db } from '@/lib/db';
import { ownerSignedIn, ownerSnapshot } from '@/lib/owner';

export const metadata: Metadata = { title: 'Front desk', robots: { index: false } };

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
  if (!(await ownerSignedIn())) return <main className="owner owner-locked"><OwnerGate /></main>;

  const gyms = await db()`SELECT slug, name, city FROM gyms ORDER BY city, name`;
  const { gym: asked } = await searchParams;
  const slug = gyms.some((g) => g.slug === asked) ? (asked as string) : null;

  return (
    <main className="owner">
      <OwnerPanel key={slug ?? 'all'} first={await ownerSnapshot(slug)} gyms={gyms.map((g) => ({ slug: g.slug as string, name: g.name as string, city: g.city as string }))} />
    </main>
  );
}
