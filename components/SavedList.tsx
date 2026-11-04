'use client';
import Link from 'next/link';
import { GymCard, type CardGym } from './GymCard';
import { IconHeart } from './Icons';
import { useSession } from './session';

// Follows the heart buttons live, so a gym leaves this list the moment it is removed.
export function SavedList({ gyms }: { gyms: CardGym[] }) {
  const { saved, ready } = useSession();
  const shown = ready ? gyms.filter((g) => saved.includes(g.id)) : gyms;

  if (!shown.length) {
    return (
      <div className="saved-empty">
        <i className="glow-blob" aria-hidden="true" />
        <span className="saved-empty-heart" aria-hidden="true"><IconHeart width={26} height={26} /></span>
        <h2>Nothing saved yet</h2>
        <p>Tap the heart on any gym and it stays here, ready for your next trip.</p>
        <Link href="/gyms" transitionTypes={['nav-tab']} className="btn btn-volt">Find a gym</Link>
      </div>
    );
  }

  return (
    <>
      <p className="saved-count">{shown.length} {shown.length === 1 ? 'gym' : 'gyms'}</p>
      <ul className="gym-grid">
        {shown.map((g) => <li key={g.id}><GymCard gym={g} /></li>)}
      </ul>
    </>
  );
}
