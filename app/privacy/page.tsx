import Link from 'next/link';
import type { Metadata } from 'next';
import { Page } from '@/components/ui/Page';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <Page>
      <main className="simple-page narrow prose">
        <h1 className="page-title">Privacy</h1>
        <p>Daypass is a student project demo. This notice describes how the demo handles your data.</p>
        <h2 className="section-title">Your location</h2>
        <p>We use your location only while you search, to find gyms close to you. It is not saved to your account or our database. If no gyms are listed near you, your browser asks BigDataCloud for your city name so the app can open it.</p>
        <h2 className="section-title">Maps and city search</h2>
        <p>Map images come from OpenFreeMap, which sees the map area you view. City names you type are sent to Open-Meteo to find the place.</p>
        <h2 className="section-title">Your account</h2>
        <p>We keep your name, email, preferences and bookings. Passwords are stored as hashes, never as plain text. You are logged out after 30 days without a visit. Demo accounts are removed after 14 days.</p>
        <h2 className="section-title">Reviews</h2>
        <p>If you review a gym, your name and review appear publicly on its page. Reviews from demo accounts and sample visits stay private.</p>
        <h2 className="section-title">Where it lives</h2>
        <p>The app and its database run in the EU, in Frankfurt, and all traffic uses HTTPS.</p>
        <h2 className="section-title">Simulated features</h2>
        <p>Payments, the Wallet, email and push messages, and demo Face ID are simulated. We never ask for card details and no money moves.</p>
        <h2 className="section-title">Deleting your account</h2>
        <p>Request deletion from your <Link href="/account" className="link">account page</Link>. You are logged out at once, and your account is erased within 30 days of the request.</p>
      </main>
    </Page>
  );
}
