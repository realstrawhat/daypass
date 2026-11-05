// The search a Find address asks for, in one stable form. The page and the screen use it to agree on which first
// page of gyms the server sent.
export const SEARCH_KEYS = ['city', 'country', 'sort', 'maxPrice', 'minRating', 'openNow', 'equipment'] as const;

export function searchQueryKey(get: (key: string) => string | null | undefined) {
  const out = new URLSearchParams();
  for (const k of SEARCH_KEYS) {
    const v = get(k);
    if (v) out.set(k, v);
  }
  return out.toString();
}
