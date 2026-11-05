import { Suspense } from 'react';
import { preconnect } from 'react-dom';
import type { Metadata } from 'next';
import { GymSearch } from '@/components/GymSearch';
import { Page } from '@/components/ui/Page';
import { findGyms } from '@/lib/gym-search';
import { searchQueryKey } from '@/lib/search-query';

export const metadata: Metadata = { title: 'Find a gym' };

type Query = Record<string, string | string[] | undefined>;

// A city search is the same for every guest, so its first page of gyms comes with the page and shows before the app
// has started in the browser. Searches by exact location still run in the browser, so coordinates stay there.
async function Results({ query }: { query: Promise<Query> }) {
  const q = await query;
  const get = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : null);
  let initial = null;
  if (get('city') && !get('near') && !get('area')) {
    try {
      const result = await findGyms({ city: get('city'), country: get('country'), sort: get('sort'), maxPrice: get('maxPrice'), minRating: get('minRating'), openNow: get('openNow'), equipment: get('equipment'), page: 1 }, { seed: false });
      // The same shape the browser gets from the API.
      if (result.total > 0) initial = { query: searchQueryKey(get), result: JSON.parse(JSON.stringify(result)) };
    } catch {
      // The browser asks again, and explains if it fails there too.
    }
  }
  return <GymSearch initial={initial} />;
}

export default function GymsPage({ searchParams }: { searchParams: Promise<Query> }) {
  // The map's style and tiles come from here, so the connection opens while the page loads.
  preconnect('https://tiles.openfreemap.org', { crossOrigin: 'anonymous' });
  return (
    <Page>
      <div>
        <Suspense fallback={<div className="search-fallback"><span className="sk sk-map" /></div>}>
          <Results query={searchParams} />
        </Suspense>
      </div>
    </Page>
  );
}
