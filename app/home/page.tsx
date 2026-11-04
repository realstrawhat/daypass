import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';
import { Page } from '@/components/ui/Page';
import { searchGyms } from '@/lib/gyms';

export const metadata: Metadata = { title: 'Home' };

// A static screen, refreshed every few minutes, so the app opens instantly. Personal details load on top.
export const revalidate = 300;

export default async function HomePage() {
  const picks = await searchGyms({ lat: 52.3676, lng: 4.9041, sort: 'recommended' }).then((r) => r.gyms.slice(0, 12)).catch(() => []);
  return (
    <Page>
      <div>
        <HomeClient picks={JSON.parse(JSON.stringify(picks))} city="Amsterdam" />
      </div>
    </Page>
  );
}
