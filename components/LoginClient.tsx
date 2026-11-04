'use client';
import { AuthForm } from './AuthForm';

// A full page load so the navigation picks up the new session straight away.
export function LoginClient({ next, initialMode }: { next: string; initialMode: 'login' | 'register' }) {
  return <AuthForm initialMode={initialMode} onDone={() => window.location.assign(next)} />;
}
