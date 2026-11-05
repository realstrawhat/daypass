// The person's general area, from the headers Vercel adds to each request. Nothing here is stored.
export function networkArea(headers: Headers) {
  const read = (name: string) => {
    const raw = headers.get(name);
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  };
  return { city: read('x-vercel-ip-city'), country: read('x-vercel-ip-country') };
}
