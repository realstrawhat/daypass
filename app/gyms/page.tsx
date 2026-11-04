import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GymSearch } from '@/components/GymSearch';
import { Page } from '@/components/ui/Page';

export const metadata: Metadata = { title: 'Find a gym' };

export default function GymsPage() {
  return (
    <Page>
      <div>
        <Suspense fallback={<div className="search-fallback"><span className="sk sk-map" /></div>}>
          <GymSearch />
        </Suspense>
      </div>
    </Page>
  );
}
