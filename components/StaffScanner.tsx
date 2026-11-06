'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconScan } from './Icons';
import { haptic } from './ui/feedback';

export type DeskResult = { result: 'valid' | 'used' | 'out' | 'expired' | 'too_early' | 'wrong_date' | 'cancelled' | 'unknown'; gym?: string; holder?: string; when?: string; code?: string; usedAt?: string; leftAt?: string; stay?: string; inside?: boolean };
type Result = DeskResult;

export const DESK_COPY: Record<Result['result'], { title: string; tone: string; line: (r: Result) => string }> = {
  valid: { title: 'Let them in', tone: 'is-valid', line: (r) => `${r.holder}, checked in for ${r.gym}.` },
  out: { title: 'Checked out', tone: 'is-valid', line: (r) => `${r.holder} left after ${r.stay}. In at ${r.usedAt}, out at ${r.leftAt}.` },
  used: { title: 'Already used', tone: 'is-bad', line: (r) => (r.leftAt ? `This pass came in at ${r.usedAt} and left at ${r.leftAt}.` : `This pass was checked in at ${r.usedAt}.`) },
  expired: { title: 'Expired', tone: 'is-bad', line: (r) => `This pass was for ${r.when}.` },
  too_early: { title: 'Too early', tone: 'is-warn', line: (r) => `This pass opens one hour before ${r.when}.` },
  wrong_date: { title: 'Wrong date', tone: 'is-warn', line: (r) => `This pass is for ${r.when}.` },
  cancelled: { title: 'Cancelled', tone: 'is-bad', line: () => 'This booking was cancelled and refunded.' },
  unknown: { title: 'Not found', tone: 'is-bad', line: () => 'Check the code, or ask for the pass on their phone.' },
};

// What reception uses: no software to install, and a typed code when a browser can't scan.
export function StaffScanner() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState<'off' | 'on' | 'none'>('off');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastScan = useRef('');
  const lastSeen = useRef(0);

  const check = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setCode('');
      haptic(data.result === 'valid' ? 20 : 40);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That check did not finish. Try again.');
      lastScan.current = '';
    } finally {
      setBusy(false);
    }
  }, []);

  const stop = useCallback(() => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, [stop]);

  const startCamera = async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices) {
      setCamera('none');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // The person may have left, or tapped twice, while the camera was starting.
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stop();
      stream.current = s;
      setCamera('on');
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      });
      const detector = new Detector({ formats: ['qr_code'] });
      timer.current = setInterval(async () => {
        if (!video.current || video.current.readyState < 2) return;
        const found = await detector.detect(video.current).catch(() => []);
        const value = found[0]?.rawValue;
        // Ready for the same pass again only once it has left the camera for a moment.
        if (!value) {
          if (Date.now() - lastSeen.current > 2500) lastScan.current = '';
          return;
        }
        if (!value.startsWith('DAYPASS:')) return;
        lastSeen.current = Date.now();
        if (value !== lastScan.current) {
          lastScan.current = value;
          check(value);
        }
      }, 450);
    } catch {
      setCamera('none');
    }
  };

  // A second scan straight after the first is a double scan, not a problem at the door.
  const copy = result?.inside ? { title: 'Already in', tone: 'is-warn', line: (r: Result) => `Checked in at ${r.usedAt}. Scan again when they leave.` } : result ? DESK_COPY[result.result] : null;

  return (
    <div className="staff-main">
      <div className="staff-camera">
        {camera === 'on' ? (
          <>
            <video ref={video} playsInline muted aria-label="Camera view for scanning" />
            <i className="staff-frame" aria-hidden="true" />
          </>
        ) : camera === 'none' ? (
          <p className="note">This browser can't scan with the camera. Type the code below instead.</p>
        ) : (
          <button type="button" className="btn btn-volt" onClick={startCamera}><IconScan /> Start scanning</button>
        )}
      </div>

      <form className="staff-form" onSubmit={(e) => { e.preventDefault(); check(code); }}>
        <div className="field"><label htmlFor="staff-code">Pass code</label><input id="staff-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DP-XXXXX" autoCapitalize="characters" autoComplete="off" /></div>
        <button type="submit" className="btn btn-white" disabled={busy || !code.trim()}>{busy ? 'Checking' : 'Check'}</button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {result && copy ? (
        <div key={`${result.code}-${result.result}`} className={`staff-result ${copy.tone}`} role="status">
          <h2>{copy.title}</h2>
          <p>{copy.line(result)}</p>
          {result.result !== 'unknown' && result.code ? <p><strong>{result.code}</strong></p> : null}
        </div>
      ) : null}
      <p className="fine">Demo door scanner. The first scan checks someone in, and a later scan checks them out. A pass is valid from one hour before its session until three hours after it starts. Demo passes work at any time, from any account. A real pass can only be scanned from its own account, so it says Not found anywhere else.</p>
    </div>
  );
}
