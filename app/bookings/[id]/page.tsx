import Link from 'next/link';
import QRCode from 'qrcode';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BookingActions } from '@/components/BookingActions';
import { HoloPass } from '@/components/HoloPass';
import { IconBack } from '@/components/Icons';
import { RateVisit } from '@/components/RateVisit';
import { RevealIntro } from '@/components/RevealIntro';
import { getCurrentUser } from '@/lib/auth';
import { getBookingView } from '@/lib/bookings';
import { canChange, dateLabel, directionsLinks, longDate, money, timeLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Your day pass' };

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; updated?: string }> };

const calStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export default async function BookingPage({ params, searchParams }: P) {
  const { id } = await params;
  const { new: isNew, updated } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/bookings/${id}`);
  const b = await getBookingView(user.id, id);
  if (!b) notFound();

  const tz = b.gym_timezone;
  const start = new Date(b.starts_at);
  const isPast = start.getTime() <= Date.now();
  const cancelled = b.status === 'cancelled';
  const changeable = !cancelled && !isPast && canChange(b.starts_at);
  const qrSvg = await QRCode.toString(`DAYPASS:${b.code}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  const end = new Date(start.getTime() + 3600000);
  const googleCal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Gym session at ${b.gym_name}`)}&dates=${calStamp(start)}/${calStamp(end)}&location=${encodeURIComponent(b.gym_address)}&details=${encodeURIComponent(`Day pass code ${b.code}`)}`;

  return (
    <main className="pass-page">
      {isNew && !cancelled ? <RevealIntro gym={b.gym_name} /> : null}
      <Link href="/bookings" className="round pass-back" aria-label="Back to my bookings"><IconBack /></Link>

      <div className="pass-layout">
        <div className={`pass-col${cancelled ? ' is-void' : ''}`}>
          <HoloPass pass={{ gym: b.gym_name, city: b.gym_city, dateLabel: dateLabel(b.starts_at, tz), timeLabel: timeLabel(b.starts_at, tz), code: b.code, holder: user.name, qrSvg }} />
          {cancelled ? <p className="void-stamp">Cancelled</p> : null}
        </div>

        <div className="pass-side">
          {updated && !cancelled ? (
            <div className="banner banner-volt" role="status">
              <strong>Booking updated</strong>
              <span>
                Now {longDate(b.starts_at, tz)} at {timeLabel(b.starts_at, tz)}{b.previous_gym_name && b.previous_gym_id !== b.gym_id ? `, at ${b.gym_name}` : ''}.
                {' '}Confirmation {b.confirmation_version}.
              </span>
            </div>
          ) : null}
          {cancelled ? (
            <div className="banner" role="status"><strong>Booking cancelled</strong><span>{money(b.refund_cents)} refunded to your demo card. The spot is free again.</span></div>
          ) : null}

          <h1 className="pass-title">{isPast && !cancelled ? 'Past visit' : cancelled ? 'Cancelled visit' : 'You are booked'}</h1>
          <dl className="pass-facts">
            <div><dt>When</dt><dd>{longDate(b.starts_at, tz)}, {timeLabel(b.starts_at, tz)}</dd></div>
            <div><dt>Where</dt><dd><Link href={`/gyms/${b.gym_slug}`}>{b.gym_name}</Link><br />{b.gym_address}</dd></div>
            <div><dt>Paid</dt><dd>{money(b.price_cents)} demo payment</dd></div>
            {b.refund_cents > 0 && !cancelled ? <div><dt>Refunded</dt><dd>{money(b.refund_cents)}</dd></div> : null}
            {b.previous_starts_at && !cancelled ? <div><dt>Moved from</dt><dd>{dateLabel(b.previous_starts_at, tz)}, {timeLabel(b.previous_starts_at, tz)}{b.previous_gym_name && b.previous_gym_id !== b.gym_id ? `, ${b.previous_gym_name}` : ''}</dd></div> : null}
            {b.is_sample ? <div><dt>Note</dt><dd>Sample visit added to your new account so you can try rating a gym.</dd></div> : null}
          </dl>

          {isPast && !cancelled ? (
            <RateVisit bookingId={b.id} gymName={b.gym_name} initial={b.review_stars} />
          ) : null}

          {!cancelled ? (
            <BookingActions
              booking={{ id: b.id, code: b.code, gym_id: b.gym_id, gym_name: b.gym_name, gym_city: b.gym_city, starts_at: b.starts_at, price_cents: b.price_cents, timezone: tz, lat: b.gym_lat, lng: b.gym_lng, dateLabel: dateLabel(b.starts_at, tz), timeLabel: timeLabel(b.starts_at, tz) }}
              directions={directionsLinks(b.gym_lat, b.gym_lng, b.gym_name)}
              googleCal={googleCal}
              changeable={changeable}
              isPast={isPast}
            />
          ) : (
            <Link href={`/gyms/${b.gym_slug}`} className="btn btn-volt btn-block">Book {b.gym_name} again</Link>
          )}
        </div>
      </div>
    </main>
  );
}
