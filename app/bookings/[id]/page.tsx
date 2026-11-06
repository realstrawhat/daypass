import Link from 'next/link';
import QRCode from 'qrcode';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { IconBack } from '@/components/Icons';
import { PassView, SaveForOffline } from '@/components/PassView';
import { RateVisit } from '@/components/RateVisit';
import { RevealIntro } from '@/components/RevealIntro';
import { HoloPass } from '@/components/HoloPass';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { getBookingView } from '@/lib/bookings';
import { canChange, dateLabel, directionsLinks, longDate, money, timeLabel } from '@/lib/format';
import { DOOR_CLOSES_HOURS, SESSION_RULE, stayLabel } from '@/lib/hours';

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
  const cancelled = b.status === 'cancelled';
  // A session stays current through its visit, rather than turning "past" the moment it starts.
  const isOver = start.getTime() + DOOR_CLOSES_HOURS * 3600000 <= Date.now();
  const checkedIn = !!b.checked_in_at;
  const changeable = !cancelled && !isOver && !checkedIn && canChange(b.starts_at);
  const qrSvg = await QRCode.toString(`DAYPASS:${b.code}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  const end = new Date(start.getTime() + 3600000);
  const googleCal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Gym session at ${b.gym_name}`)}&dates=${calStamp(start)}/${calStamp(end)}&location=${encodeURIComponent(b.gym_address)}&details=${encodeURIComponent(`Day pass code ${b.code}`)}`;
  const f = b.gym_facts ?? {};
  const facts = [SESSION_RULE, f.entry, f.towel, f.lock, f.shower, f.age].filter(Boolean) as string[];
  const pass = { gym: b.gym_name, city: b.gym_city, dateLabel: dateLabel(b.starts_at, tz), timeLabel: timeLabel(b.starts_at, tz), code: b.code, holder: user.name, qrSvg, facts };
  const title = cancelled ? 'Cancelled' : isOver ? 'Past visit' : b.checked_out_at ? 'Visit done' : checkedIn ? 'Checked in' : 'You are booked';

  return (
    <Page>
      <main className="pass-page">
        {isNew && !cancelled ? <RevealIntro gym={b.gym_name} /> : null}
        <SaveForOffline id={b.id} version={`${b.status}-${b.checked_in_at ?? ''}-${b.checked_out_at ?? ''}-${b.starts_at}-${b.confirmation_version}`} />
        <Link href="/bookings" transitionTypes={['nav-back']} className="round round-solid pass-back" aria-label="Back to Passes"><IconBack /></Link>

        <div className="pass-layout">
          <div className="pass-col">
            {cancelled ? (
              <>
                <HoloPass pass={{ ...pass, state: 'void' }} />
                <Link href={`/gyms/${b.gym_slug}`} transitionTypes={['nav-forward']} className="btn btn-volt btn-block pass-again">Book {b.gym_name} again</Link>
              </>
            ) : (
              <PassView
                booking={{
                  id: b.id, code: b.code, gym_id: b.gym_id, gym_name: b.gym_name, gym_city: b.gym_city, starts_at: b.starts_at, price_cents: b.price_cents, timezone: tz, lat: b.gym_lat, lng: b.gym_lng,
                  dateLabel: dateLabel(b.starts_at, tz), timeLabel: timeLabel(b.starts_at, tz), checked_in_at: b.checked_in_at, checked_out_at: b.checked_out_at, checkedInLabel: b.checked_in_at ? timeLabel(b.checked_in_at, tz) : null, in_wallet: !!b.wallet_added_at, version: b.confirmation_version,
                }}
                pass={pass}
                directions={directionsLinks(b.gym_lat, b.gym_lng, b.gym_name)}
                googleCal={googleCal}
                changeable={changeable}
                isOver={isOver}
                isNew={!!isNew}
              />
            )}
          </div>

          <div className="pass-side">
            {updated && !cancelled ? (
              <div className="banner banner-volt" role="status">
                <strong>Booking updated</strong>
                <span>Now {longDate(b.starts_at, tz)} at {timeLabel(b.starts_at, tz)}. Confirmation {b.confirmation_version}.</span>
              </div>
            ) : null}
            {cancelled ? (
              <div className="banner" role="status">
                <strong>{b.refund_reason && b.refund_reason !== 'cancelled' ? 'Refund sent' : 'Booking cancelled'}</strong>
                <span>{money(b.refund_cents)} refunded to your demo card.{start.getTime() > Date.now() ? ' The spot is free again.' : ''}</span>
              </div>
            ) : null}

            <h1 className="pass-title">{title}</h1>
            <dl className="pass-facts">
              <div><dt>When</dt><dd>{longDate(b.starts_at, tz)}, {timeLabel(b.starts_at, tz)}</dd></div>
              <div><dt>Where</dt><dd><Link href={`/gyms/${b.gym_slug}`} transitionTypes={['nav-forward']}>{b.gym_name}</Link><br />{b.gym_address}</dd></div>
              <div><dt>Paid</dt><dd>{money(b.price_cents)} demo payment</dd></div>
              {checkedIn && b.checked_in_at ? <div><dt>Checked in</dt><dd>{dateLabel(b.checked_in_at, tz)}, {timeLabel(b.checked_in_at, tz)}</dd></div> : null}
              {b.checked_in_at && b.checked_out_at ? <div><dt>Checked out</dt><dd>{timeLabel(b.checked_out_at, tz)}, after {stayLabel(new Date(b.checked_out_at).getTime() - new Date(b.checked_in_at).getTime())}</dd></div> : null}
              {b.refund_cents > 0 && !cancelled ? <div><dt>Refunded</dt><dd>{money(b.refund_cents)}</dd></div> : null}
              {b.previous_starts_at && !cancelled ? <div><dt>Moved from</dt><dd>{dateLabel(b.previous_starts_at, tz)}, {timeLabel(b.previous_starts_at, tz)}{b.previous_gym_name && b.previous_gym_id !== b.gym_id ? `, ${b.previous_gym_name}` : ''}</dd></div> : null}
              {b.is_sample ? <div><dt>Note</dt><dd>Sample visit, so you can try rating a gym. Your rating stays private.</dd></div> : null}
            </dl>

            {!cancelled && (isOver || checkedIn) ? <RateVisit bookingId={b.id} gymName={b.gym_name} initial={b.review_stars} /> : null}
          </div>
        </div>
      </main>
    </Page>
  );
}
