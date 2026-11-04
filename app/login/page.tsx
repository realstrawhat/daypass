import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Welcome } from '@/components/Welcome';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in' };

// Only paths inside this app. Browsers treat a backslash like a slash, so "/\site.com" would leave the app.
const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : '/home');

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(safeNext(next));
  return <Welcome next={safeNext(next)} mode={mode === 'register' ? 'register' : 'login'} />;
}
