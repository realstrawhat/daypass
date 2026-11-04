import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountClient } from '@/components/AccountClient';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { listBookings } from '@/lib/bookings';
import { db } from '@/lib/db';
import { money } from '@/lib/format';
import { localParts } from '@/lib/hours';

export const metadata: Metadata = { title: 'Account' };

// Three months of visits as a dot grid, one column per weekday.
function buildMonths(visits: { y: number; m: number; d: number }[]) {
  const now = new Date();
  return [2, 1, 0].map((back) => {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth() + 1;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7;
    const seen = new Set(visits.filter((v) => v.y === y && v.m === m).map((v) => v.d));
    return {
      label: new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(first),
      lead,
      days: Array.from({ length: days }, (_, i) => ({ day: i + 1, on: seen.has(i + 1) })),
    };
  });
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');
  const [all, keys] = await Promise.all([
    listBookings(user.id),
    db()`SELECT count(*)::int AS n FROM passkeys WHERE user_id = ${user.id}::uuid`,
  ]);
  const visited = all.filter((b) => b.status === 'confirmed' && (b.checked_in_at || new Date(b.starts_at).getTime() < Date.now()));
  const cities = new Set(visited.map((b) => b.gym_city)).size;
  const spent = visited.reduce((sum, b) => sum + b.price_cents - b.refund_cents, 0);
  const months = buildMonths(visited.map((b) => localParts(new Date(b.starts_at), b.gym_timezone)));

  return (
    <Page>
      <main className="simple-page narrow">
        <header className="profile-head">
          <span className="profile-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
          <div>
            <h1>{user.name}</h1>
            {user.is_demo ? <span className="demo-tag">Demo account</span> : <p>{user.email}</p>}
          </div>
        </header>

        <dl className="stat-grid">
          <div className="stat"><dt>Visits</dt><dd>{visited.length}</dd></div>
          <div className="stat"><dt>Cities</dt><dd>{cities}</dd></div>
          <div className="stat"><dt>Spent</dt><dd>{money(spent)}</dd></div>
        </dl>

        <section className="visits" aria-labelledby="visits-title">
          <h2 id="visits-title" className="section-title">Your visits</h2>
          <div className="visits-months">
            {months.map((mo) => (
              <div key={mo.label} className="visits-month">
                <h3>{mo.label}</h3>
                <div className="dots" role="img" aria-label={`${mo.label}: ${mo.days.filter((d) => d.on).length} visits${mo.days.some((d) => d.on) ? `, on the ${mo.days.filter((d) => d.on).map((d) => d.day).join(', ')}` : ''}`}>
                  {Array.from({ length: mo.lead }, (_, i) => <span key={`b${i}`} />)}
                  {mo.days.map((d) => <i key={d.day} className={d.on ? 'on' : ''} title={d.on ? `Visit on ${mo.label} ${d.day}` : undefined} />)}
                </div>
              </div>
            ))}
          </div>
          <p className="visits-legend"><span><i aria-hidden="true" /> A day you trained</span></p>
        </section>

        <AccountClient
          user={{ name: user.name, email: user.email, home_city: user.home_city, default_sort: user.default_sort, max_price_cents: user.max_price_cents, saved_card: user.saved_card, is_demo: user.is_demo }}
          passkeys={keys[0].n as number}
        />
      </main>
    </Page>
  );
}
