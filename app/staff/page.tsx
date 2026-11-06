import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { IconBack } from '@/components/Icons';
import { StaffScanner } from '@/components/StaffScanner';
import { getCurrentUser } from '@/lib/auth';
import { ownerSignedIn } from '@/lib/owner';

export const metadata: Metadata = { title: 'Door scanner' };

export default async function StaffPage() {
  const admin = await ownerSignedIn();
  const user = await getCurrentUser();
  if (!user && !admin) redirect('/login?next=/staff');
  return (
    <main className="staff">
      <header className="staff-top">
        <Link href={admin ? '/owner' : '/account'} className="round round-solid" aria-label={admin ? 'Back to the front desk' : 'Back to Account'}><IconBack /></Link>
        <h1>Door scanner</h1>
      </header>
      <StaffScanner admin={admin} />
    </main>
  );
}
