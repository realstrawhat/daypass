import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <main className="simple-page narrow prose">
      <h1 className="page-title">Privacy</h1>
      <p>Daypass is a student project demo. This notice describes how the demo handles your data.</p>
      <h2 className="section-title">Your location</h2>
      <p>We use your location only while you search, to find gyms close to you. It is not saved to your account or our database.</p>
      <h2 className="section-title">Your account</h2>
      <p>We keep your name, email, preferences and bookings. Passwords are stored as hashes, never as plain text. You are logged out after 30 days without a visit.</p>
      <h2 className="section-title">Where it lives</h2>
      <p>The app and its database run in the EU, in Frankfurt, and all traffic uses HTTPS.</p>
      <h2 className="section-title">Payments</h2>
      <p>Payments are simulated. We never ask for card details and no money moves.</p>
      <h2 className="section-title">Deleting your account</h2>
      <p>Request deletion from your <Link href="/account" className="link">account page</Link>. Your account is erased within 30 days of the request.</p>
    </main>
  );
}
