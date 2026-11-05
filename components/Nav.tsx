'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from './session';
import { IconHome, IconPass, IconSearch, IconStore, IconUser, Spark } from './Icons';
import { haptic } from './ui/feedback';

const HIDE_ON = ['/login', '/staff'];

export function Nav() {
  const path = usePathname();
  const { user, ready, unread } = useSession();
  if (HIDE_ON.includes(path)) return null;

  const items = [
    { href: '/home', match: ['/home'], label: 'Home', icon: <IconHome /> },
    { href: '/gyms', match: ['/gyms'], label: 'Find', icon: <IconSearch /> },
    { href: '/bookings', match: ['/bookings', '/wallet'], label: 'Passes', icon: <IconPass /> },
    { href: user || !ready ? '/account' : '/login?next=/account', match: ['/account', '/inbox', '/partners', '/saved'], label: user || !ready ? 'Account' : 'Log in', icon: <IconUser />, badge: unread },
  ];
  const activeIndex = items.findIndex((i) => i.match.some((m) => path === m || path.startsWith(m + '/')));
  const style = { '--active': activeIndex } as React.CSSProperties;

  return (
    <>
      <nav className="rail" aria-label="Main">
        <Link href="/home" className="rail-logo" aria-label="Daypass home"><Spark /></Link>
        <div className="rail-items" style={style}>
          {activeIndex >= 0 ? <i className="nav-thumb" aria-hidden="true" /> : null}
          {items.map((i, n) => (
            <Link key={i.label} href={i.href} aria-current={n === activeIndex ? 'page' : undefined} onClick={() => haptic(6)}>
              {i.icon}<span>{i.label}</span>
              {i.badge ? <b className="nav-badge" aria-label={`${i.badge} unread`}>{i.badge}</b> : null}
            </Link>
          ))}
        </div>
        <Link href="/partners" className="rail-foot"><IconStore /><span>Gyms</span></Link>
      </nav>
      <i className="tabbar-fade" aria-hidden="true" />
      <nav className="tabbar" aria-label="Main" style={style}>
        {activeIndex >= 0 ? <i className="nav-thumb" aria-hidden="true" /> : null}
        {items.map((i, n) => (
          <Link key={i.label} href={i.href} aria-current={n === activeIndex ? 'page' : undefined} onClick={() => haptic(6)}>
            {i.icon}<span>{i.label}</span>
            {i.badge ? <b className="nav-badge" aria-label={`${i.badge} unread`}>{i.badge}</b> : null}
          </Link>
        ))}
      </nav>
    </>
  );
}
