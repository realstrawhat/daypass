import Image from 'next/image';
import Link from 'next/link';
import { LoginClient } from './LoginClient';
import { Spark } from './Icons';

// The first screen of the app: log in or create an account.
export function Welcome({ next, mode, title }: { next: string; mode: 'login' | 'register'; title?: string }) {
  return (
    <main className="welcome">
      <div className="welcome-art">
        <Image src="/img/g09.jpg" alt="" fill priority sizes="(max-width: 860px) 100vw, 55vw" />
        <div className="welcome-shade" aria-hidden="true" />
        <p className="welcome-logo"><Spark /> Daypass</p>
        <h1 className="welcome-title"><span>One gym.</span><span>One day.</span><span>No contract.</span></h1>
        <svg className="ribbon" viewBox="0 0 900 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path id="ribbon-path" d="M-40 210C140 300 300 90 470 150S700 290 940 40" />
          <use href="#ribbon-path" className="ribbon-band" />
          <text className="ribbon-text">
            <textPath href="#ribbon-path" startOffset="20" dominantBaseline="central">PAY PER VISIT ✦ TRAIN IN ANY CITY ✦ NO CALLS ✦ PAY PER VISIT ✦ TRAIN IN ANY CITY</textPath>
          </text>
        </svg>
      </div>
      <section className="welcome-sheet" aria-label="Log in or create an account">
        <div className="welcome-notch" aria-hidden="true" />
        <h2>{title ?? 'Log in to your passes'}</h2>
        <LoginClient next={next} initialMode={mode} />
        <div className="welcome-links">
          <Link href="/home">Keep browsing</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </section>
    </main>
  );
}
