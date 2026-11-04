import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SavedList } from '@/components/SavedList';
import { IconBack } from '@/components/Icons';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { listSavedGyms } from '@/lib/gyms';

export const metadata: Metadata = { title: 'Saved gyms' };

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/saved');
  const gyms = await listSavedGyms(user.id);
  return (
    <Page>
      <main className="simple-page saved-page">
        <div className="title-row">
          <Link href="/home" transitionTypes={['nav-back']} className="round round-solid" aria-label="Back to Home"><IconBack /></Link>
        </div>
        <h1 className="two-tone">Saved <em>gyms</em></h1>
        <SavedList gyms={JSON.parse(JSON.stringify(gyms))} />
      </main>
    </Page>
  );
}
