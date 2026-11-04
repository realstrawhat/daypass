// Small line drawings of each city's landmark, drawn for Daypass. These are not official city logos.
const MARKS: Record<string, React.ReactNode> = {
  // Fernsehturm, the TV tower
  Berlin: (
    <>
      <path d="M24 3v16" />
      <circle cx="24" cy="23" r="5.500" />
      <path d="M19 23h10" />
      <path d="M22.500 28.500 21 45M25.500 28.500 27 45" />
      <path d="M15 45h18" />
    </>
  ),
  // A canal house with a stepped gable
  Amsterdam: (
    <>
      <path d="M12 45V24h3v-5h4v-5h3V9h4v5h3v5h4v5h3v21Z" />
      <path d="M24 9V5" />
      <path d="M20 25h3v5h-3ZM25 25h3v5h-3ZM21 45v-8h6v8" />
    </>
  ),
  // Eiffel Tower
  Paris: (
    <>
      <path d="M24 3v7" />
      <path d="M21.500 10h5l2 13h-9Z" />
      <path d="M18.500 23h11" />
      <path d="M19.500 23C19 33 14 41 10 45M28.500 23C29 33 34 41 38 45" />
      <path d="M15 34h18" />
      <path d="M19 45a5 6 0 0 1 10 0" />
    </>
  ),
  // Tram 28
  Lisbon: (
    <>
      <rect x="9" y="14" width="30" height="24" rx="5" />
      <path d="M9 26h30" />
      <path d="M17 14v12M31 14v12M24 14v12" />
      <path d="M24 14V7l6-3" />
      <circle cx="16" cy="42" r="3" />
      <circle cx="32" cy="42" r="3" />
    </>
  ),
  // Sagrada Familia's spires
  Barcelona: (
    <>
      <path d="M13 45V20l3-15 3 15v25" />
      <path d="M19 45V14l5-11 5 11v31" />
      <path d="M29 45V20l3-15 3 15v25" />
      <path d="M21 45v-9a3 3 0 0 1 6 0v9" />
      <path d="M8 45h32" />
    </>
  ),
  // Old Town tower with its pointed turrets
  Prague: (
    <>
      <path d="M15 45V19h18v26" />
      <path d="M15 19 24 4l9 15" />
      <path d="M15 19l-3-7-3 7v8h6M33 19l3-7 3 7v8h-6" />
      <circle cx="24" cy="28" r="4.500" />
      <path d="M24 25.500V28l2 1" />
      <path d="M21 45v-7a3 3 0 0 1 6 0v7" />
    </>
  ),
  // The Riesenrad wheel
  Vienna: (
    <>
      <circle cx="24" cy="20" r="16" />
      <circle cx="24" cy="20" r="2.500" />
      <path d="M24 4v32M8 20h32M12.700 8.700l22.600 22.600M35.300 8.700 12.700 31.300" />
      <path d="M24 22 15 45M24 22l9 23M12 45h24" />
    </>
  ),
  // Colosseum
  Rome: (
    <>
      <path d="M5 40V17c5-5 12-8 19-8s14 3 19 8v23Z" />
      <path d="M5 26c12-4 26-4 38 0" />
      <path d="M12 40v-7a2.500 2.500 0 0 1 5 0v7M21.500 40v-7a2.500 2.500 0 0 1 5 0v7M31 40v-7a2.500 2.500 0 0 1 5 0v7" />
      <path d="M13 22v-4M24 21v-5M35 22v-4" />
      <path d="M3 45h42" />
    </>
  ),
};

export const hasCityMark = (city: string) => city in MARKS;

export function CityMark({ city, size = 40 }: { city: string; size?: number }) {
  const mark = MARKS[city];
  if (!mark) return null;
  return (
    <svg className="city-mark" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {mark}
    </svg>
  );
}
