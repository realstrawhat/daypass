'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { AuthForm } from './AuthForm';
import { useSession } from './session';
import { IconBack, Spark } from './Icons';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : '/home');

// The optional login screen. People reach it from Passes, Account or a saved link.
export function Welcome() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, refresh } = useSession();
  const next = safeNext(params.get('next'));

  useEffect(() => {
    if (user) {
      router.refresh();
      router.replace(next);
    }
  }, [user, next, router]);

  return (
    <main className="welcome">
      <div className="welcome-art">
        <Image src="/cutouts/motion.webp" alt="" fill priority sizes="(max-width: 860px) 100vw, 55vw" />
        <div className="welcome-shade" aria-hidden="true" />
        <div className="welcome-top">
          <Link href="/home" className="round round-glass" aria-label="Back to Home"><IconBack /></Link>
          <p className="welcome-logo"><Spark /> Daypass</p>
        </div>
        <h1 className="welcome-title"><span>One gym.</span><span>One day.</span><span>No contract.</span></h1>
      </div>
      <section className="welcome-sheet" aria-label="Log in or create an account">
        <i className="sheet-handle" aria-hidden="true" />
        <h2>Your passes, in one place</h2>
        <AuthForm
          initialMode={params.get('mode') === 'register' ? 'register' : 'login'}
          onDone={async () => {
            await refresh();
            router.replace(next);
          }}
        />
        <Link href="/privacy" className="welcome-privacy">Privacy</Link>
      </section>
    </main>
  );
}
