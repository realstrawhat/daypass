import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { IconBack, IconBell, IconCalendar, IconCheck, IconPass, IconWallet, Spark } from '@/components/Icons';
import { InboxRead } from '@/components/InboxRead';
import { Page } from '@/components/ui/Page';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Inbox' };

type Msg = { id: string; booking_id: string | null; kind: string; title: string; body: string; read_at: string | null; created_at: string };

const ICONS: Record<string, React.ReactNode> = {
  welcome: <Spark width={18} height={18} />,
  confirmation: <IconPass />,
  change: <IconCalendar />,
  refund: <IconWallet />,
  checkin: <IconCheck />,
  reminder: <IconBell />,
};

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days`;
};

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/inbox');
  const messages = (await db()`SELECT id, booking_id, kind, title, body, read_at, created_at FROM messages WHERE user_id = ${user.id}::uuid ORDER BY created_at DESC LIMIT 50`) as Msg[];

  return (
    <Page>
      <main className="simple-page narrow">
        <div className="title-row">
          <Link href="/home" transitionTypes={['nav-back']} className="round round-solid" aria-label="Back to Home"><IconBack /></Link>
          <span className="demo-tag">Demo email and push</span>
        </div>
        <h1 className="page-title">Inbox</h1>
        <InboxRead />
        {messages.length ? (
          <ul className="inbox">
            {messages.map((m) => {
              const inner = (
                <>
                  {!m.read_at ? <i className="msg-dot" aria-label="Unread" /> : null}
                  <span className="msg-icon" aria-hidden="true">{ICONS[m.kind] ?? <Spark width={18} height={18} />}</span>
                  <div className="msg-body">
                    <div className="msg-top"><strong>{m.title}</strong><time>{ago(m.created_at)}</time></div>
                    <p>{m.body}</p>
                  </div>
                </>
              );
              return <li key={m.id} className="reveal-in">{m.booking_id ? <Link href={`/bookings/${m.booking_id}`} transitionTypes={['nav-forward']}>{inner}</Link> : <div className="msg">{inner}</div>}</li>;
            })}
          </ul>
        ) : (
          <div className="empty"><h2>All quiet</h2><p>Booking confirmations and reminders will land here.</p></div>
        )}
        <p className="fine demo-note">In this demo, confirmations and reminders arrive here instead of by email or push.</p>
      </main>
    </Page>
  );
}
