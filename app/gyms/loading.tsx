import { Page } from '@/components/ui/Page';

// Find opens at once on a tap, and the gyms fill in as the server sends them.
export default function Loading() {
  return (
    <Page>
      <div>
        <div className="search-fallback"><span className="sk sk-map" /></div>
      </div>
    </Page>
  );
}
