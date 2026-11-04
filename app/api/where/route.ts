// The person's general area, from the network they are on. Nothing is stored, and no permission is needed
// because it is only a rough city. The app uses it when exact location has not been shared.
export async function GET(req: Request) {
  const raw = req.headers.get('x-vercel-ip-city');
  let city: string | null = null;
  try {
    city = raw ? decodeURIComponent(raw) : null;
  } catch {}
  return Response.json({ city }, { headers: { 'Cache-Control': 'private, no-store' } });
}
