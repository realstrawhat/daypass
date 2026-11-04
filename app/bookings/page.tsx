import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GymPhoto } from '@/components/GymPhoto';
import { IconArrow } from '@/components/Icons';
import { getCurrentUser } from '@/lib/auth';
import { listBookings, type BookingView } from '@/lib/bookings';
import { dateLabel, money, timeLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'My bookings' };

function Ticket({ b, past }: { b: BookingView; past?: boolean }) {
  const cancelled = b.status === 'cancelled';
  return (
    <li>
      <Link href={`/bookings/${b.id}`} className={`ticket${cancelled ? ' is-cancelled' : ''}${past ? ' is-past' : ''}`}>
        <div className="ticket-photo"><GymPhoto src={b.gym_photos[0]} name={b.gym_name} sizes="160px" /></div>
        <div className="ticket-body">
          <h3>{b.gym_name}</h3>
          <p>{dateLabel(b.starts_at, b.gym_timezone)}, {timeLabel(b.starts_at, b.gym_timezone)}</p>
          <p className="ticket-sub">{b.gym_city}{cancelled ? `. Cancelled, ${money(b.refund_cents)} refunded` : `. ${money(b.price_cents)}`}{b.is_sample ? '. Sample visit' : ''}</p>
        </div>
        <i className="ticket-go" aria-hidden="true"><IconArrow /></i>
      </Link>
    </li>
  );
}

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/bookings');
  const all = await listBookings(user.id);
  const now = Date.now();
  const upcoming = all.filter((b) => b.status === 'confirmed' && new Date(b.starts_at).getTime() > now).reverse();
  const past = all.filter((b) => b.status === 'cancelled' || new Date(b.starts_at).getTime() <= now);
  const soon = upcoming.find((b) => new Date(b.starts_at).getTime() - now < 48 * 3600 * 1000);
  const unrated = past.find((b) => b.status === 'confirmed' && b.review_stars == null);

  return (
    <main className="simple-page">
      <h1 className="page-title">My bookings</h1>

      {soon ? (
        <Link href={`/bookings/${soon.id}`} className="banner banner-volt">
          <strong>Coming up: {soon.gym_name}</strong>
          <span>{dateLabel(soon.starts_at, soon.gym_timezone)} at {timeLabel(soon.starts_at, soon.gym_timezone)}. Your pass is ready.</span>
        </Link>
      ) : null}
      {unrated ? (
        <Link href={`/bookings/${unrated.id}#rate`} className="banner">
          <strong>How was {unrated.gym_name}?</strong>
          <span>Rate your visit out of 5 to help the next person choose.</span>
        </Link>
      ) : null}

      <section className="ticket-section" aria-labelledby="up">
        <h2 id="up" className="section-title">Upcoming</h2>
        {upcoming.length ? (
          <ul className="tickets">{upcoming.map((b) => <Ticket key={b.id} b={b} />)}</ul>
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
  );
}
