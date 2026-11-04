import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GymSearch } from '@/components/GymSearch';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Find a gym' };

export default async function GymsPage() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <Suspense fallback={<div className="search-fallback" />}>
      <GymSearch prefs={user ? { home_city: user.home_city, default_sort: user.default_sort, max_price_cents: user.max_price_cents } : null} />
    </Suspense>
  );
}
