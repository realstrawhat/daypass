import { networkArea } from '@/lib/where';

// The person's general area, from the network they are on. Nothing is stored, and no permission is needed
// because it is only a rough city. The app uses it when exact location has not been shared.
export async function GET(req: Request) {
  return Response.json(networkArea(req.headers), { headers: { 'Cache-Control': 'private, no-store' } });
}
