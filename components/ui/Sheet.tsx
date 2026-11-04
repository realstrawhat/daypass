'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconClose } from '../Icons';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Hides the visible title. It is still announced by screen readers. */
  hideTitle?: boolean;
  /** Blocks closing while something important is running, such as a payment. */
  locked?: boolean;
  /** Set when closing because the app is moving to a new page, so history stays intact. */
  keepHistory?: boolean;
  className?: string;
  full?: boolean;
  children: React.ReactNode;
};

const EXIT_MS = 300;

// A native dialog gives focus handling and Escape. On top of that: drag to dismiss with
// velocity, and the phone's Back gesture closes the sheet instead of leaving the page.
export function Sheet({ open, onClose, title, hideTitle, locked, keepHistory, className = '', full, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rendered, setRendered] = useState(open);
  const [state, setState] = useState<'enter' | 'open' | 'exit'>('enter');
  const pushedHistory = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const keepHistoryRef = useRef(keepHistory);
  keepHistoryRef.current = keepHistory;
  const drag = useRef<{ y: number; t: number; lastY: number; lastT: number; id: number } | null>(null);

  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d || !rendered) return;
    if (open) {
      if (!d.open) d.showModal();
      document.documentElement.classList.add('sheet-open');
      const f = requestAnimationFrame(() => requestAnimationFrame(() => setState('open')));
      if (!pushedHistory.current) {
        window.history.pushState({ ...window.history.state, daypassSheet: true }, '');
        pushedHistory.current = true;
      }
      const onPop = () => {
        pushedHistory.current = false;
        if (lockedRef.current) {
          window.history.pushState({ ...window.history.state, daypassSheet: true }, '');
          pushedHistory.current = true;
          return;
        }
        onCloseRef.current();
      };
      window.addEventListener('popstate', onPop);
      return () => {
        cancelAnimationFrame(f);
        window.removeEventListener('popstate', onPop);
      };
    }
    setState('exit');
    d.style.removeProperty('--drag');
    const t = setTimeout(() => {
      if (d.open) d.close();
      document.documentElement.classList.remove('sheet-open');
      setRendered(false);
      setState('enter');
    }, EXIT_MS);
    if (pushedHistory.current) {
      pushedHistory.current = false;
      if (!keepHistoryRef.current && window.history.state?.daypassSheet) window.history.back();
    }
    return () => clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => () => document.documentElement.classList.remove('sheet-open'), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (lockedRef.current || (e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const now = performance.now();
    drag.current = { y: e.clientY, t: now, lastY: e.clientY, lastT: now, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ref.current?.classList.add('is-dragging');
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y;
    // Pulling up past the top resists, like a rubber band.
    const y = dy < 0 ? dy * 0.18 : dy;
    ref.current?.style.setProperty('--drag', `${y}px`);
    g.lastY = e.clientY;
    g.lastT = performance.now();
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    drag.current = null;
    const d = ref.current;
    d?.classList.remove('is-dragging');
    const dy = e.clientY - g.y;
    const velocity = dy / Math.max(1, performance.now() - g.t);
    if (dy > 110 || (dy > 24 && velocity > 0.55)) onCloseRef.current();
    else d?.style.removeProperty('--drag');
  }, []);

  if (!rendered) return null;

  return (
    <dialog
      ref={ref}
      className={`sheet ${full ? 'is-full ' : ''}${className}`}
      data-state={state}
      aria-label={hideTitle ? title : undefined}
      aria-labelledby={!hideTitle && title ? 'sheet-title' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        // A tap on the dimmed area outside the sheet closes it.
        if (e.target === ref.current && !locked) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-grip" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <i className="sheet-handle" aria-hidden="true" />
          <div className="sheet-head">
            {title && !hideTitle ? <h2 id="sheet-title">{title}</h2> : <span />}
            <button type="button" className="round round-sm" aria-label="Close" disabled={locked} onClick={onClose}><IconClose /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
