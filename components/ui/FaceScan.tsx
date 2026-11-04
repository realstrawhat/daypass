// A generic face-scan animation for the simulated Face ID and payment confirmation.
export function FaceScan({ state = 'scanning', size = 72 }: { state?: 'scanning' | 'done'; size?: number }) {
  return (
    <svg className={`facescan is-${state}`} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g className="facescan-corners" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
        <path d="M6 20V12a6 6 0 0 1 6-6h8" />
        <path d="M44 6h8a6 6 0 0 1 6 6v8" />
        <path d="M58 44v8a6 6 0 0 1-6 6h-8" />
        <path d="M20 58h-8a6 6 0 0 1-6-6v-8" />
      </g>
      <g className="facescan-face" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
        <path d="M23 24v5" />
        <path d="M41 24v5" />
        <path d="M32 24v10h-3" />
        <path d="M24 43c4.500 3.500 11.500 3.500 16 0" />
      </g>
      <path className="facescan-tick" d="M18 33l10 10 18-20" stroke="currentColor" strokeWidth="4.500" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}
