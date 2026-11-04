import { Spark } from '@/components/Icons';

export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading">
      <Spark width={44} height={44} />
    </div>
  );
}
