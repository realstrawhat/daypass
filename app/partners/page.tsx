import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { IconArrow } from '@/components/Icons';
import { PartnerClient } from '@/components/PartnerClient';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'List your gym' };

export default async function PartnersPage() {
  const user = await getCurrentUser().catch(() => null);
  const gyms = user
    ? await db()`
        SELECT g.id, g.slug, g.name, g.city, g.price_cents, g.confirmed_at,
          count(b.id) FILTER (WHERE b.status = 'confirmed')::int AS visits,
          coalesce(sum(b.price_cents) FILTER (WHERE b.status = 'confirmed'), 0)::int AS sales,
          coalesce(sum(b.commission_cents) FILTER (WHERE b.status = 'confirmed'), 0)::int AS commission
        FROM gyms g LEFT JOIN bookings b ON b.gym_id = g.id
        WHERE g.owner_user_id = ${user.id}::uuid
        GROUP BY g.id ORDER BY g.created_at DESC`
    : [];

  return (
    <Page>
      <main className="partners">
        <section className="partners-hero">
          <h1>Sell your quiet hours</h1>
          <div className="partners-photo"><Image src="/img/g16.jpg" alt="Empty gym floor with racks and benches" fill priority sizes="(max-width: 860px) 100vw, 45vw" /></div>
          <ul className="partners-points">
            <li><strong>You set the price</strong><span>Choose your own day pass price and change it any time.</span></li>
            <li><strong>15% only when booked</strong><span>Listing is free. You pay commission on each booking and nothing else.</span></li>
            <li><strong>Keep details fresh</strong><span>Confirm your details every 90 days so visitors can trust them.</span></li>
          </ul>
        </section>

        <Link href="/owner" className="owner-try">
          <span className="owner-try-copy"><strong><i className="live-dot" aria-hidden="true" /> Try the live owner panel</strong><span>Run a sample gym for a minute: who is in, when they came and how long they stayed.</span></span>
          <IconArrow />
        </Link>

        {user ? (
          <PartnerClient gyms={gyms as never} />
        ) : (
          <section className="panel partner-grid">
            <h2 className="section-title">Log in to list your gym</h2>
            <p>Your account keeps your listing and sales in one place.</p>
            <Link href="/login?next=/partners&mode=register" className="btn btn-volt">Create an account</Link>
          </section>
        )}
      </main>
    </Page>
  );
}
