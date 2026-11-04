import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Welcome } from '@/components/Welcome';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="welcome" />}>
      <Welcome />
    </Suspense>
  );
}
