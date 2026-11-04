// The flowing lime ribbon from the brand references. Scrolling shifts it slightly, run by the browser's compositor.
export function Ribbon({ tone = 'volt', className = '' }: { tone?: 'volt' | 'ink'; className?: string }) {
  const id = `ribbon-${tone}`;
  return (
    <div className={`ribbon-band is-${tone} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1400 150" preserveAspectRatio="xMidYMid slice">
        <path id={id} d="M-40 96C150 16 300 136 500 86S820 8 1010 74 1290 128 1440 54" />
        <use href={`#${id}`} className="ribbon-stroke" />
        <text className="ribbon-words">
          <textPath href={`#${id}`} startOffset="10" dominantBaseline="central">
            PAY PER VISIT ✦ NO CONTRACT ✦ ANY CITY ✦ NO CALLS ✦ PAY PER VISIT ✦ NO CONTRACT ✦ ANY CITY ✦ NO CALLS ✦ PAY PER VISIT
          </textPath>
        </text>
      </svg>
    </div>
  );
}
