import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';
import { Page } from '@/components/ui/Page';
import { searchGyms } from '@/lib/gyms';

export const metadata: Metadata = { title: 'Home' };

// Shown only when we can't tell where someone is, so it draws from several cities and assumes none.
const SPREAD = [
  { lat: 52.52, lng: 13.405 },
  { lat: 48.8566, lng: 2.3522 },
  { lat: 38.7223, lng: -9.1393 },
  { lat: 41.9028, lng: 12.4964 },
];

// A static screen, refreshed every few minutes, so the app opens instantly. Personal details load on top.
export const revalidate = 300;

export default async function HomePage() {
  const sets = await Promise.all(SPREAD.map((c) => searchGyms({ ...c, sort: 'recommended' }).then((r) => r.gyms.slice(0, 3)).catch(() => [])));
  const picks = sets.flat();
  return (
    <Page>
      <div>
        <HomeClient picks={JSON.parse(JSON.stringify(picks))} />
      </div>
    </Page>
  );
}
