import type { Metadata, Viewport } from 'next';
import { Anton, Manrope } from 'next/font/google';
import './globals.css';
import './screens.css';
import './pages.css';
import { Nav } from '@/components/Nav';
import { Providers } from '@/components/session';

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Manrope({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Daypass: book a gym for one day', template: '%s | Daypass' },
  description: 'Find a gym nearby and book a single session. No membership, no contract, no calls.',
  applicationName: 'Daypass',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Daypass' },
  formatDetection: { telephone: false },
  icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// No cookies are read here, so browsing screens stay static, prefetchable and instant.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Providers>
          <Nav />
          <div id="main" tabIndex={-1}>{children}</div>
        </Providers>
      </body>
    </html>
  );
}
