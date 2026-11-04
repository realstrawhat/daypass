'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Spark } from './Icons';

type Props = { src?: string; name: string; sizes: string; priority?: boolean; tone?: 'mono' | 'color' };

// Photos fade in as they arrive. A gym without photos still gets a deliberate placeholder.
export function GymPhoto({ src, name, sizes, priority, tone = 'color' }: Props) {
  const [loaded, setLoaded] = useState(false);
  if (!src) {
    return (
      <div className="photo-empty" role="img" aria-label={`${name} has no photos yet`}>
        <Spark width="34%" height="34%" />
      </div>
    );
  }
  return (
    <Image
      className={`photo is-${tone}${loaded ? ' is-loaded' : ''}`}
      src={src}
      alt={`Inside ${name}`}
      fill
      sizes={sizes}
      priority={priority}
      onLoad={() => setLoaded(true)}
    />
  );
}
