'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { VisitState } from '@/lib/hours';
import { IconArrow, IconChevron } from './Icons';
import { useFeedback } from './ui/feedback';
import { ScrollArrows } from './ui/Rail';
import { afterSheetClosed, Sheet } from './ui/Sheet';
import { StayTimer } from './ui/StayTimer';

export type CalVisit = {
  id: string;
  day: string;
  gym: string;
  city: string;
  date: string;
  start: string;
  upcoming: boolean;
  state: VisitState;
  inIso: string | null;
  inLabel: string | null;
  outLabel: string | null;
  stay: string | null;
};
export type CalRing = { key: string; label: string; goal: number; value: number; color: string; r: number; title: string; ids: string[]; groupBy: 'gym' | 'city' | null };

const MAX_NOTE = 500;
const MONTHS_BACK = 24;
const dayName = (key: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const monthName = (y: number, m: number) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function visitLine(v: CalVisit) {
  if (v.upcoming) return `Booked for ${v.start}`;
  if (v.state === 'not_in') return `Booked for ${v.start}, no check-in recorded`;
  if (v.state === 'no_exit') return `In ${v.inLabel}, exit not recorded`;
  if (v.state === 'inside') return `In ${v.inLabel}, still inside`;
  return `In ${v.inLabel}, out ${v.outLabel}, ${v.stay}`;
}

type View = { type: 'day'; day: string; ring: string | null } | { type: 'ring'; key: string };

// The calendar and the rings share one sheet, so moving from a ring's history into a day never leaves two open.
export function VisitCalendar({ visits, rings, notes: initialNotes, thisMonth }: { visits: CalVisit[]; rings: CalRing[]; notes: Record<string, string>; thisMonth: { y: number; m: number } }) {
  const { toast } = useFeedback();
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [view, setView] = useState<View | null>(null);
  const [lastTitle, setLastTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLElement>(null);

  useEffect(() => {
    const now = new Date();
    setToday(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  }, []);

  // Opens on this month, with earlier months a swipe away.
  useLayoutEffect(() => {
    if (track.current && current.current) track.current.scrollLeft = current.current.offsetLeft - track.current.offsetLeft;
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, CalVisit[]>();
    for (const v of visits) map.set(v.day, [...(map.get(v.day) ?? []), v]);
    return map;
  }, [visits]);

  const months = useMemo(() => {
    const index = (y: number, m: number) => y * 12 + (m - 1);
    const known = [...visits.map((v) => v.day), ...Object.keys(notes)].map((k) => index(Number(k.slice(0, 4)), Number(k.slice(5, 7))));
    const now = index(thisMonth.y, thisMonth.m);
    const first = Math.max(now - MONTHS_BACK, Math.min(now - 2, ...known));
    const last = Math.max(now, ...known);
    return Array.from({ length: last - first + 1 }, (_, n) => {
      const i = first + n;
      const y = Math.floor(i / 12);
      const m = (i % 12) + 1;
      const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const days = Array.from({ length: count }, (_, d) => `${y}-${pad(m)}-${pad(d + 1)}`);
      return { key: `${y}-${m}`, label: monthName(y, m), isNow: i === now, lead: (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, days };
    });
  }, [visits, notes, thisMonth]);

  const saveNote = async (day: string, text: string) => {
    const clean = text.trim();
    if (clean === (notes[day] ?? '')) return true;
    setSaving(true);
    try {
      const res = await fetch('/api/notes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day, body: clean }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotes((all) => {
        const next = { ...all };
        if (data.body) next[day] = data.body;
        else delete next[day];
        return next;
      });
      setSaved(true);
      return true;
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : 'Your note did not save. Try again.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openDay = (day: string, ring: string | null = null) => {
    setDraft(notes[day] ?? '');
    setSaved(false);
    setView({ type: 'day', day, ring });
  };

  // Nothing typed is ever lost by closing or going back.
  const leaveDay = (then: () => void) => {
    if (view?.type === 'day') void saveNote(view.day, draft);
    then();
  };
  const close = () => leaveDay(() => setView(null));

  const activeRing = view?.type === 'ring' ? rings.find((r) => r.key === view.key) : null;
  const title = view?.type === 'day' ? dayName(view.day) : activeRing?.title ?? null;
  // The sheet keeps its title while it slides away.
  useEffect(() => {
    if (title) setLastTitle(title);
  }, [title]);

  const openRing = (key: string) => setView({ type: 'ring', key });

  return (
    <>
      <section className="rings" aria-labelledby="rings-title">
        <h2 id="rings-title" className="section-title">Your rings</h2>
        <ul className="rings-list">
          {rings.map((ring) => (
            <li key={ring.key}>
              <button type="button" onClick={() => openRing(ring.key)} aria-label={`${ring.label}: ${ring.value} of ${ring.goal}. Open history`}>
                <span className="rings-label" style={{ '--c': ring.color } as React.CSSProperties}><i aria-hidden="true" />{ring.label}</span>
                <span className="rings-value">{ring.value} <small>of {ring.goal}</small><IconChevron aria-hidden="true" /></span>
              </button>
            </li>
          ))}
        </ul>
        <svg className="rings-art" viewBox="0 0 160 160" aria-hidden="true">
          {rings.map((ring) => {
            const length = 2 * Math.PI * ring.r;
            return (
              <g key={ring.key}>
                <circle className="track" cx="80" cy="80" r={ring.r} />
                {ring.value > 0 ? <circle cx="80" cy="80" r={ring.r} stroke={ring.color} strokeDasharray={`${Math.min(1, ring.value / ring.goal) * length} ${length}`} /> : null}
                {/* Wider than the ring you can see, so it can be hit with a finger. */}
                <circle className="rings-hit" cx="80" cy="80" r={ring.r} onClick={() => openRing(ring.key)} />
              </g>
            );
          })}
        </svg>
      </section>

      <section className="visits" aria-labelledby="visits-title">
        <div className="rail-head">
          <h2 id="visits-title" className="section-title">Your visits</h2>
          <ScrollArrows target={track} label="Change month" />
        </div>
        <div className="cal-track" ref={track} tabIndex={0} role="group" aria-label="Months">
          {months.map((mo) => {
            const trained = mo.days.filter((d) => byDay.get(d)?.some((v) => !v.upcoming)).length;
            return (
              <section key={mo.key} className="cal-month" ref={mo.isNow ? current : undefined} aria-label={`${mo.label}: ${plural(trained, 'day')} trained`}>
                <h3>{mo.label} <small>{plural(trained, 'day')} trained</small></h3>
                <div className="cal-week" aria-hidden="true">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
                <div className="dots">
                  {Array.from({ length: mo.lead }, (_, i) => <span key={`b${i}`} />)}
                  {mo.days.map((d) => {
                    const list = byDay.get(d) ?? [];
                    const on = list.some((v) => !v.upcoming);
                    const booked = !on && list.length > 0;
                    const note = !!notes[d];
                    const words = [dayName(d), on ? plural(list.length, 'visit') : booked ? 'booked' : 'no visit', note ? 'has a note' : null].filter(Boolean).join(', ');
                    return (
                      <button key={d} type="button" className={`dot${on ? ' on' : ''}${booked ? ' is-booked' : ''}${note ? ' has-note' : ''}${d === today ? ' is-today' : ''}`} aria-label={words} onClick={() => openDay(d)}>
                        <i aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <p className="visits-legend">
          <span><i className="is-on" aria-hidden="true" /> Trained</span>
          <span><i className="is-booked" aria-hidden="true" /> Booked</span>
          <span><i className="is-note" aria-hidden="true" /> Note</span>
        </p>
      </section>

      <Sheet open={!!view} onClose={close} title={title ?? lastTitle} className="sheet-log">
        {view?.type === 'day' ? (
          <div className="log-day">
            {view.ring ? <button type="button" className="back-link" onClick={() => leaveDay(() => setView({ type: 'ring', key: view.ring as string }))}><IconChevron className="back-chevron" width={18} height={18} /> Back to {rings.find((r) => r.key === view.ring)?.label.toLowerCase()}</button> : null}
            {byDay.get(view.day)?.length ? (
              <ul className="log-list">
                {byDay.get(view.day)?.map((v) => (
                  <li key={v.id}>
                    <Link href={`/bookings/${v.id}`} className="log-visit" onClick={(e) => { e.preventDefault(); close(); afterSheetClosed(() => router.push(`/bookings/${v.id}`)); }}>
                      <span className="log-visit-copy">
                        <strong>{v.gym}</strong>
                        <span>{v.city}</span>
                        {v.state === 'inside' && v.inIso ? <span className="log-visit-live"><i className="live-dot" aria-hidden="true" /> In the gym <StayTimer from={v.inIso} /></span> : <span>{visitLine(v)}</span>}
                      </span>
                      <IconArrow />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="sheet-sub">No visit on this day. You can still leave a note, such as a rest day or a plan.</p>}
            <div className="field">
              <label htmlFor="day-note">Note</label>
              <textarea id="day-note" rows={3} maxLength={MAX_NOTE} value={draft} placeholder="How it felt, what you lifted, what to try next" onChange={(e) => { setDraft(e.target.value); setSaved(false); }} onBlur={() => void saveNote(view.day, draft)} />
              <small className="log-note-foot" role="status">{saved && draft.trim() === (notes[view.day] ?? '') ? (draft.trim() ? 'Saved' : 'Note removed') : `${draft.length} of ${MAX_NOTE}`}</small>
            </div>
            <button type="button" className="btn btn-volt btn-block" disabled={saving} onClick={() => { void saveNote(view.day, draft).then((ok) => { if (ok) setView(null); }); }}>{saving ? 'Saving' : 'Done'}</button>
          </div>
        ) : activeRing ? (
          <RingLog ring={activeRing} visits={visits} notes={notes} onDay={(day) => openDay(day, activeRing.key)} />
        ) : null}
      </Sheet>
    </>
  );
}

function RingLog({ ring, visits, notes, onDay }: { ring: CalRing; visits: CalVisit[]; notes: Record<string, string>; onDay: (day: string) => void }) {
  const list = ring.ids.map((id) => visits.find((v) => v.id === id)).filter((v): v is CalVisit => !!v);
  const groups = ring.groupBy
    ? [...new Set(list.map((v) => v[ring.groupBy as 'gym' | 'city']))].map((name) => ({ name, rows: list.filter((v) => v[ring.groupBy as 'gym' | 'city'] === name) }))
    : [{ name: null as string | null, rows: list }];
  return (
    <div className="log-ring">
      <p className="sheet-sub">{ring.value} of {ring.goal}{ring.value >= ring.goal ? '. Goal reached.' : `. ${plural(ring.goal - ring.value, ring.groupBy ?? 'visit').replace('citys', 'cities')} to go.`}</p>
      {list.length === 0 ? <p className="note">Nothing here yet. Your visits will show up after your first check-in.</p> : groups.map((g) => (
        <section key={g.name ?? 'all'} className="log-group">
          {g.name ? <h3>{g.name} <small>{plural(g.rows.length, 'visit')}</small></h3> : null}
          <ul className="log-list">
            {g.rows.map((v) => (
              <li key={v.id}>
                <button type="button" className="log-visit" onClick={() => onDay(v.day)}>
                  <span className="log-visit-copy">
                    <strong>{v.date}</strong>
                    <span>{ring.groupBy === 'gym' ? v.city : `${v.gym}, ${v.city}`}</span>
                    <span>{visitLine(v)}</span>
                    {notes[v.day] ? <em>{notes[v.day]}</em> : null}
                  </span>
                  <IconChevron />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
