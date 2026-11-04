import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountClient } from '@/components/AccountClient';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');
  const [{ n }] = (await db()`SELECT count(*)::int AS n FROM passkeys WHERE user_id = ${user.id}::uuid`) as { n: number }[];
  return (
    <main className="simple-page narrow">
      <h1 className="page-title">Hi {user.name.split(' ')[0]}</h1>
      <AccountClient
        user={{ name: user.name, email: user.email, home_city: user.home_city, default_sort: user.default_sort, max_price_cents: user.max_price_cents, saved_card: user.saved_card }}
        passkeys={n}
      />
    </main>
  );
}
