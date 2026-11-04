import { ViewTransition } from 'react';

const slides = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', 'nav-tab': 'nav-fade', default: 'none' };

// Wrap each screen so moving deeper slides forward, going back slides back, and tabs crossfade.
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={slides} exit={slides} default="none">
      {children}
    </ViewTransition>
  );
}

// The same photo on two screens morphs from one to the other.
export function SharedPhoto({ name, className, children }: { name: string; className?: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={name} share="morph" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}
