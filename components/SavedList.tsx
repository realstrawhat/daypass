'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { GymCard, type CardGym } from './GymCard';
import { IconHeart } from './Icons';
import { useSession } from './session';

// Follows the heart buttons live: a gym leaves the moment it is removed, and one saved a moment ago shows up
// even when this screen comes from memory. It only filters once the person is known, so a failed session
// check can't blank a full list.
export function SavedList({ gyms }: { gyms: (CardGym & { id: string })[] }) {
  const { saved, user } = useSession();
  const [list, setList] = useState(gyms);
  const askedFor = useRef('');

  useEffect(() => {
    const ids = saved.join();
    if (!user || askedFor.current === ids || !saved.some((id) => !list.some((g) => g.id === id))) return;
    askedFor.current = ids;
    let live = true;
    fetch('/api/saved').then((r) => r.json()).then((d) => {
      if (live && d.gyms) setList(d.gyms);
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [user, saved, list]);

  const shown = user ? list.filter((g) => saved.includes(g.id)) : list;

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
