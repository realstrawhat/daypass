import Link from 'next/link';
import QRCode from 'qrcode';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { IconBack, IconChevron, Spark } from '@/components/Icons';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { listBookings } from '@/lib/bookings';
import { dateLabel, timeLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Wallet' };

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/wallet');
  const all = await listBookings(user.id);
  const passes = all.filter((b) => b.wallet_added_at && b.status === 'confirmed');
  const withQr = await Promise.all(passes.map(async (b) => ({ b, qr: await QRCode.toString(`DAYPASS:${b.code}`, { type: 'svg', margin: 0, color: { dark: '#000000', light: '#ffffff' } }) })));

  return (
    <Page>
      <main className="simple-page narrow wallet-screen">
        <div className="title-row">
          <Link href="/bookings" transitionTypes={['nav-back']} className="round round-solid" aria-label="Back to Passes"><IconBack /></Link>
          <span className="demo-tag">Demo Wallet</span>
        </div>
        <h1 className="page-title">Wallet</h1>
        {withQr.length ? (
          <ul className="wstack">
            {withQr.map(({ b, qr }) => (
              <li key={b.id} className="wcard">
                <p className="wcard-brand"><Spark width={14} height={14} /> Daypass</p>
                <p className="wcard-gym">{b.gym_name}</p>
                <p className="wcard-when">{dateLabel(b.starts_at, b.gym_timezone)}, {timeLabel(b.starts_at, b.gym_timezone)}</p>
                <p className="wcard-code">{b.code}</p>
                <i className="wcard-holo" aria-hidden="true" />
                <div className="wcard-qr" aria-hidden="true"><span dangerouslySetInnerHTML={{ __html: qr }} /></div>
                <Link href={`/bookings/${b.id}`} transitionTypes={['nav-forward']} className="wcard-open">Open pass <IconChevron width={16} height={16} /></Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <h2>Your Wallet is empty</h2>
            <p>Open a pass and tap Add to Wallet to keep it here, ready for the desk.</p>
            <Link href="/bookings" className="btn btn-volt">Go to Passes</Link>
          </div>
        )}
        <p className="fine">This Wallet is a simulation inside Daypass. A real phone wallet pass needs Apple and Google developer accounts.</p>
      </main>
    </Page>
  );
}
