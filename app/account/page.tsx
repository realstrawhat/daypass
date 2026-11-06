import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountClient } from '@/components/AccountClient';
import { VisitCalendar, type CalRing, type CalVisit } from '@/components/VisitCalendar';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { listBookings } from '@/lib/bookings';
import { db } from '@/lib/db';
import { dateLabel, money, timeLabel } from '@/lib/format';
import { localParts, stayLabel, visitState } from '@/lib/hours';

export const metadata: Metadata = { title: 'Account' };

const dayKey = (iso: string, tz: string) => {
  const p = localParts(new Date(iso), tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');
  const [all, keys, noteRows] = await Promise.all([
    listBookings(user.id),
    db()`SELECT count(*)::int AS n FROM passkeys WHERE user_id = ${user.id}::uuid`,
    db()`SELECT to_char(day, 'YYYY-MM-DD') AS day, body FROM day_notes WHERE user_id = ${user.id}::uuid`,
  ]);
  // A real account's one sample visit is for trying the rating screen, so it doesn't count as training.
  const visited = all.filter((b) => b.status === 'confirmed' && (user.is_demo || !b.is_sample) && (b.checked_in_at || new Date(b.starts_at).getTime() < Date.now()));
  const cities = new Set(visited.map((b) => b.gym_city)).size;
  const spent = visited.reduce((sum, b) => sum + b.price_cents - b.refund_cents, 0);
  const now = new Date();
  const thisYear = visited.filter((b) => localParts(new Date(b.starts_at), b.gym_timezone).y === localParts(now, b.gym_timezone).y);
  const thisMonth = thisYear.filter((b) => localParts(new Date(b.starts_at), b.gym_timezone).m === localParts(now, b.gym_timezone).m);
  const ids = (list: typeof visited) => list.map((b) => b.id);
  const rings: CalRing[] = [
    { key: 'month', label: 'Visits this month', title: 'This month', goal: 4, value: thisMonth.length, color: '#d7ff3e', r: 66, ids: ids(thisMonth), groupBy: null },
    { key: 'gyms', label: 'Gyms tried this year', title: 'Gyms this year', goal: 10, value: new Set(thisYear.map((b) => b.gym_id)).size, color: '#a4c92a', r: 50, ids: ids(thisYear), groupBy: 'gym' },
    { key: 'cities', label: 'Cities this year', title: 'Cities this year', goal: 5, value: new Set(thisYear.map((b) => b.gym_city)).size, color: '#f2ffc4', r: 34, ids: ids(thisYear), groupBy: 'city' },
  ];
  const visitedIds = new Set(ids(visited));
  // The calendar also shows passes still to come. Those don't count towards the stats or rings.
  const calendar: CalVisit[] = all
    .filter((b) => visitedIds.has(b.id) || (b.status === 'confirmed' && !b.is_sample && new Date(b.starts_at).getTime() >= now.getTime()))
    .map((b) => {
      const tz = b.gym_timezone;
      return {
        id: b.id,
        day: dayKey(b.checked_in_at ?? b.starts_at, tz),
        gym: b.gym_name,
        city: b.gym_city,
        date: dateLabel(b.checked_in_at ?? b.starts_at, tz),
        start: timeLabel(b.starts_at, tz),
        upcoming: !visitedIds.has(b.id),
        state: visitState(b.checked_in_at, b.checked_out_at),
        inIso: b.checked_in_at,
        inLabel: b.checked_in_at ? timeLabel(b.checked_in_at, tz) : null,
        outLabel: b.checked_out_at ? timeLabel(b.checked_out_at, tz) : null,
        stay: b.checked_in_at && b.checked_out_at ? stayLabel(new Date(b.checked_out_at).getTime() - new Date(b.checked_in_at).getTime()) : null,
      };
    });
  const notes = Object.fromEntries(noteRows.map((n) => [n.day as string, n.body as string]));

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

        <VisitCalendar visits={calendar} rings={rings} notes={notes} thisMonth={{ y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 }} />

        <AccountClient
          user={{ name: user.name, email: user.email, home_city: user.home_city, default_sort: user.default_sort, max_price_cents: user.max_price_cents, saved_card: user.saved_card, is_demo: user.is_demo }}
          passkeys={keys[0].n as number}
        />
      </main>
    </Page>
  );
}
