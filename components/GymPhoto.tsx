import Image from 'next/image';
import { Spark } from './Icons';

// A gym without photos still gets a deliberate placeholder.
export function GymPhoto({ src, name, sizes, priority }: { src?: string; name: string; sizes: string; priority?: boolean }) {
  if (!src) {
    return (
      <div className="photo-empty" role="img" aria-label={`${name} has no photos yet`}>
        <Spark width="34%" height="34%" />
      </div>
    );
  }
  return <Image className="photo" src={src} alt={`Inside ${name}`} fill sizes={sizes} priority={priority} />;
}
