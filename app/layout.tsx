import type { Metadata, Viewport } from 'next';
import { Anton, Manrope, Gochi_Hand } from 'next/font/google';
import './globals.css';
import './screens.css';
import './pages.css';
import { Nav } from '@/components/Nav';
import { getCurrentUser } from '@/lib/auth';

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Manrope({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const hand = Gochi_Hand({ weight: '400', subsets: ['latin'], variable: '--font-hand', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Daypass: book a gym for one day', template: '%s | Daypass' },
  description: 'Find a gym nearby and book a single session. No membership, no contract, no calls.',
};

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Nav user={user ? { name: user.name } : null} />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
