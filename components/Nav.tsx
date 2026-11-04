'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconPass, IconSearch, IconStore, IconUser, Spark } from './Icons';

export function Nav({ user }: { user: { name: string } | null }) {
  const path = usePathname();
  // The login screen is full screen, with no app navigation.
  if (path === '/login') return null;

  const isActive = (p: string) => path === p || path.startsWith(p + '/');
  const items = [
    { href: '/home', match: '/home', label: 'Home', icon: <IconHome /> },
    { href: '/gyms', match: '/gyms', label: 'Find', icon: <IconSearch /> },
    { href: '/bookings', match: '/bookings', label: 'Passes', icon: <IconPass /> },
    { href: user ? '/account' : '/login?next=/account', match: '/account', label: user ? 'Account' : 'Log in', icon: <IconUser /> },
  ];

  return (
    <>
      <nav className="rail" aria-label="Main">
        <Link href="/home" className="rail-logo" aria-label="Daypass home"><Spark /></Link>
        <div className="rail-items">
          {items.map((i) => (
            <Link key={i.label} href={i.href} aria-current={isActive(i.match) ? 'page' : undefined}>{i.icon}<span>{i.label}</span></Link>
          ))}
        </div>
        <Link href="/partners" className="rail-foot" aria-current={isActive('/partners') ? 'page' : undefined}><IconStore /><span>Gyms</span></Link>
      </nav>
      <nav className="tabbar" aria-label="Main">
        {items.map((i) => (
          <Link key={i.label} href={i.href} aria-current={isActive(i.match) ? 'page' : undefined}>{i.icon}<span>{i.label}</span></Link>
        ))}
      </nav>
    </>
  );
}
