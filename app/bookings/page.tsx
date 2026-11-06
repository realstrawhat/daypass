import Link from 'next/link';
import { DOOR_CLOSES_HOURS, daysUntil, hoursUntil } from '@/lib/hours';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GymPhoto } from '@/components/GymPhoto';
import { IconChevron, IconWallet } from '@/components/Icons';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { inWalletNow, listBookings, type BookingView } from '@/lib/bookings';
import { dateLabel, money, timeLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Passes' };

const untilLabel = (iso: string, tz: string) => {
  const hours = hoursUntil(iso);
  if (hours < 0) return 'Happening now';
  const days = daysUntil(iso, tz);
  if (days === 0) return `In ${Math.max(1, Math.round(hours))} ${Math.round(hours) <= 1 ? 'hour' : 'hours'}`;
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
};

function Ticket({ b, next, past }: { b: BookingView; next?: boolean; past?: boolean }) {
  const cancelled = b.status === 'cancelled';
  return (
    <li className="reveal-in">
      <Link href={`/bookings/${b.id}`} transitionTypes={['nav-forward']} className={`ticket${cancelled ? ' is-cancelled' : ''}${next ? ' is-next' : ''}`}>
        {next ? <i className="foil-sweep" aria-hidden="true" /> : null}
        <div className="ticket-photo"><GymPhoto src={b.gym_photos[0]} name={b.gym_name} sizes="120px" /></div>
        <div className="ticket-body">
          {next ? <span className="ticket-tag">{untilLabel(b.starts_at, b.gym_timezone)}</span> : null}
          <h3>{b.gym_name}</h3>
          <p>{dateLabel(b.starts_at, b.gym_timezone)}, {timeLabel(b.starts_at, b.gym_timezone)}</p>
          <p className="ticket-sub">
            {cancelled ? `Refunded ${money(b.refund_cents)}` : past ? (b.review_stars ? `${b.gym_city}, rated ${b.review_stars} of 5` : `${b.gym_city}, not rated yet`) : `${b.gym_city}, ${money(b.price_cents)}`}
          </p>
        </div>
        <i className="ticket-go" aria-hidden="true"><IconChevron width={18} height={18} /></i>
      </Link>
    </li>
  );
}

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/bookings');
  const all = await listBookings(user.id);
  const now = Date.now();
  const isCurrent = (b: BookingView) => b.status === 'confirmed' && !b.checked_in_at && new Date(b.starts_at).getTime() + DOOR_CLOSES_HOURS * 3600000 > now;
  const upcoming = all.filter(isCurrent).reverse();
  const past = all.filter((b) => !isCurrent(b));
  const hasWallet = all.some((b) => inWalletNow(b));

  return (
    <Page>
      <main className="simple-page">
        <div className="title-row">
          <h1 className="page-title">Passes</h1>
          <Link href="/wallet" className="title-link"><IconWallet width={18} height={18} /> Wallet{hasWallet ? <b className="title-dot" aria-label="has passes" /> : null}</Link>
        </div>

        <section className="ticket-section" aria-labelledby="up">
          <h2 id="up" className="section-title">Upcoming</h2>
          {upcoming.length ? (
            <ul className="tickets">{upcoming.map((b, i) => <Ticket key={b.id} b={b} next={i === 0} />)}</ul>
          ) : (
            <div className="empty">
              <h2>Nothing booked</h2>
              <p>Find a gym and book one session. It takes a couple of minutes.</p>
              <Link href="/gyms" className="btn btn-volt">Find a gym</Link>
            </div>
          )}
        </section>

        {past.length ? (
          <section className="ticket-section" aria-labelledby="pa">
            <h2 id="pa" className="section-title">Past and cancelled</h2>
            <ul className="tickets">{past.map((b) => <Ticket key={b.id} b={b} past />)}</ul>
          </section>
        ) : null}
      </main>
    </Page>
  );
}
