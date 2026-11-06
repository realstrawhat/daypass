import type { Metadata } from 'next';
import { OwnerGate, OwnerPanel } from '@/components/OwnerPanel';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ownerSignedIn, ownerSnapshot } from '@/lib/owner';

export const metadata: Metadata = { title: 'Owner panel', robots: { index: false } };

const FALLBACK_GYM = 'iron-gym-amsterdam';

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
  if (!(await ownerSignedIn())) return <main className="owner owner-locked"><OwnerGate /></main>;

  const user = await getCurrentUser().catch(() => null);
  const gyms = await db()`SELECT slug, name, city FROM gyms WHERE is_demo ORDER BY city, name`;
  const { gym: asked } = await searchParams;
  // Opens on the gym of the person's own pass, so their check-in is there to see.
  const [own] = user && !asked
    ? await db()`
        SELECT g.slug FROM bookings b JOIN gyms g ON g.id = b.gym_id
        WHERE b.user_id = ${user.id}::uuid AND b.status = 'confirmed' AND g.is_demo
          AND (b.starts_at > now() - interval '3 hours' OR b.checked_in_at > now() - interval '6 hours')
        ORDER BY b.checked_in_at DESC NULLS LAST, b.starts_at ASC LIMIT 1`
    : [];
  const known = (slug: unknown) => gyms.some((g) => g.slug === slug);
  const slug = known(asked) ? (asked as string) : known(own?.slug) ? (own.slug as string) : known(FALLBACK_GYM) ? FALLBACK_GYM : (gyms[0].slug as string);

  return (
    <main className="owner">
      <OwnerPanel key={slug} first={await ownerSnapshot(slug, user?.id ?? null)} gyms={gyms.map((g) => ({ slug: g.slug as string, name: g.name as string, city: g.city as string }))} />
    </main>
  );
}
