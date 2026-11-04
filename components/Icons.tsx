type P = React.SVGProps<SVGSVGElement>;
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Spark = (p: P) => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M12 0c.7 6.9 4.1 10.6 12 12-7.9 1.4-11.3 5.1-12 12-.7-6.9-4.1-10.6-12-12C7.9 10.600 11.300 6.900 12 0Z" />
  </svg>
);
export const IconHeart = (p: P & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return <svg {...base} {...rest} fill={filled ? 'currentColor' : 'none'}><path d="M12 20.500s-8-4.800-8-10.700A4.600 4.600 0 0 1 12 7a4.600 4.600 0 0 1 8 2.800c0 5.900-8 10.700-8 10.700Z" /></svg>;
};
export const IconBell = (p: P) => <svg {...base} {...p}><path d="M6 10a6 6 0 1 1 12 0c0 5 2 6.500 2 6.500H4S6 15 6 10Z" /><path d="M10 20a2.200 2.200 0 0 0 4 0" /></svg>;
export const IconSliders = (p: P) => <svg {...base} {...p}><path d="M4 7h9M18 7h2M4 17h2M11 17h9" /><circle cx="15.500" cy="7" r="2.500" /><circle cx="8.500" cy="17" r="2.500" /></svg>;
export const IconExpand = (p: P) => <svg {...base} {...p}><path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" /></svg>;
export const IconClock = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></svg>;
export const IconKey = (p: P) => <svg {...base} {...p}><circle cx="8" cy="15" r="4.500" /><path d="m11.500 11.500 8-8M16 7l3 3" /></svg>;
export const IconTowel = (p: P) => <svg {...base} {...p}><path d="M7 4h10a3 3 0 0 1 3 3v13H7V4Z" /><path d="M7 4a3 3 0 0 0-3 3v6h3M7 16h13" /></svg>;
export const IconDrop = (p: P) => <svg {...base} {...p}><path d="M12 3s6.500 6.800 6.500 11a6.500 6.500 0 0 1-13 0C5.500 9.800 12 3 12 3Z" /></svg>;
export const IconAccess = (p: P) => <svg {...base} {...p}><path d="M4 20h4v-4h4v-4h4V8h4" /></svg>;
export const IconIdCard = (p: P) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.500 1.700-2 3-2s2.400.5 3 2M15 10h3M15 14h3" /></svg>;
export const IconHelp = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="8.500" /><path d="M9.500 9.500a2.500 2.500 0 1 1 3.700 2.200c-.8.450-1.200 1-1.200 1.800M12 16.500h.01" /></svg>;
export const IconScan = (p: P) => <svg {...base} {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" /></svg>;
export const IconChevron = (p: P) => <svg {...base} {...p}><path d="m9 5 7 7-7 7" /></svg>;
export const IconFlip = (p: P) => <svg {...base} {...p}><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4" /></svg>;
export const IconHome =(p: P) => <svg {...base} {...p}><path d="M4 11.500 12 4l8 7.500V19a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 19v-7.500Z" /><path d="M10 20.500V15h4v5.500" /></svg>;
export const IconStore = (p: P) => <svg {...base} {...p}><path d="M4 10v9.500h16V10" /><path d="M3 10l2-5.500h14l2 5.500a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" /></svg>;
export const IconSearch = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.800-3.800" /></svg>;
export const IconPass = (p: P) => <svg {...base} {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.500a1.500 1.500 0 0 0 0 3V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.500a1.500 1.500 0 0 0 0-3V8Z" /><path d="M14 6v12" strokeDasharray="2 2.500" /></svg>;
export const IconUser = (p: P) => <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.200-4 4.200-6 8-6s6.800 2 8 6" /></svg>;
export const IconArrow = (p: P) => <svg {...base} {...p}><path d="M7 17 17 7M8 7h9v9" /></svg>;
export const IconBack = (p: P) => <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconClose = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconPin = (p: P) => <svg {...base} {...p}><path d="M12 22s7-6.500 7-12a7 7 0 1 0-14 0c0 5.500 7 12 7 12Z" /><circle cx="12" cy="10" r="2.500" /></svg>;
export const IconLocate = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
export const IconStar = (p: P) => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}><path d="m12 2 3 6.600 7 .8-5.200 4.800 1.400 7L12 17.700 5.800 21.200l1.400-7L2 9.400l7-.8L12 2Z" /></svg>;
export const IconCheck = (p: P) => <svg {...base} strokeWidth={2.400} {...p}><path d="m5 12.500 4.500 4.500L19 7.500" /></svg>;
export const IconCalendar = (p: P) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const IconRoute = (p: P) => <svg {...base} {...p}><circle cx="6" cy="19" r="2.500" /><circle cx="18" cy="5" r="2.500" /><path d="M8.500 19H15a3.500 3.500 0 0 0 0-7H9a3.500 3.500 0 0 1 0-7h6.500" /></svg>;
export const IconWallet = (p: P) => <svg {...base} {...p}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2" /></svg>;
export const IconList = (p: P) => <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01" /></svg>;
export const IconMap = (p: P) => <svg {...base} {...p}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6ZM9 4v14M15 6v14" /></svg>;
