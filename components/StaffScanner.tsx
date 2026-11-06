'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconScan } from './Icons';
import { haptic } from './ui/feedback';
import { feel } from './ui/sensory';

export type DeskResult = { result: 'valid' | 'used' | 'out' | 'expired' | 'too_early' | 'wrong_date' | 'cancelled' | 'unknown'; gym?: string; holder?: string; when?: string; code?: string; usedAt?: string; leftAt?: string; stay?: string; inside?: boolean };
type Result = DeskResult;

export const DESK_COPY: Record<Result['result'], { title: string; tone: string; line: (r: Result) => string }> = {
  valid: { title: 'Checked in', tone: 'is-valid', line: (r) => `Let them in: ${r.holder}, ${r.gym}. They have 1 hour, plus 15 minutes' grace.` },
  out: { title: 'Checked out', tone: 'is-valid', line: (r) => `${r.holder} left after ${r.stay}. In at ${r.usedAt}, out at ${r.leftAt}.` },
  used: { title: 'Already used', tone: 'is-bad', line: (r) => (r.leftAt ? `This pass came in at ${r.usedAt} and left at ${r.leftAt}.` : `This pass was checked in at ${r.usedAt}.`) },
  expired: { title: 'Expired', tone: 'is-bad', line: (r) => `This pass was for ${r.when}.` },
  too_early: { title: 'Too early', tone: 'is-warn', line: (r) => `This pass opens 15 minutes before ${r.when}.` },
  wrong_date: { title: 'Wrong date', tone: 'is-warn', line: (r) => `This pass is for ${r.when}.` },
  cancelled: { title: 'Cancelled', tone: 'is-bad', line: () => 'This booking was cancelled and refunded.' },
  unknown: { title: 'Not found', tone: 'is-bad', line: () => 'Check the code, or ask for the pass on their phone.' },
};

type NativeReader = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type NativeReaderClass = { new (o: { formats: string[] }): NativeReader; getSupportedFormats?: () => Promise<string[]> };

// Uses the browser's own QR reader where it has one, such as Chrome on Android. iPhones and most laptops don't,
// so a small reader in the app does the job there, and only loads when someone starts scanning.
async function makeReader(): Promise<(v: HTMLVideoElement) => Promise<string | undefined>> {
  const Native = (window as unknown as { BarcodeDetector?: NativeReaderClass }).BarcodeDetector;
  const formats = Native ? await Native.getSupportedFormats?.().catch(() => null) : null;
  if (Native && (!formats || formats.includes('qr_code'))) {
    const reader = new Native({ formats: ['qr_code'] });
    return async (v) => (await reader.detect(v).catch(() => []))[0]?.rawValue;
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const paint = canvas.getContext('2d', { willReadFrequently: true });
  return async (v) => {
    if (!paint || !v.videoWidth) return undefined;
    // A smaller picture is read faster, and a pass held up to the camera is still plenty big enough.
    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    paint.drawImage(v, 0, 0, canvas.width, canvas.height);
    return jsQR(paint.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })?.data;
  };
}

// What reception uses: no software to install, and a typed code if the camera can't be used.
export function StaffScanner({ admin = false }: { admin?: boolean }) {
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
      if (data.result === 'valid' || data.result === 'out') feel('success');
      else haptic(40);
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

  // The picture joins the video once the video is on screen. Waiting for a camera permission or the reader to load
  // means that moment can't be guessed from when the camera started. iPhones also need muted set before it can play.
  useEffect(() => {
    const v = video.current;
    if (camera !== 'on' || !v || !stream.current) return;
    v.muted = true;
    v.srcObject = stream.current;
    v.play().catch(() => {});
  }, [camera]);

  const startCamera = async () => {
    if (!navigator.mediaDevices) {
      setCamera('none');
      return;
    }
    try {
      const read = await makeReader();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // The person may have left, or tapped twice, while the camera was starting.
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stop();
      stream.current = s;
      setCamera('on');
      timer.current = setInterval(async () => {
        if (!video.current || video.current.readyState < 2) return;
        const value = await read(video.current);
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
          <p className="note">The camera didn't start. Allow camera access for this site and try again, or type the code below.</p>
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
          <h2>{result.result === 'valid' || result.result === 'out' ? <IconCheck width={38} height={38} aria-hidden="true" /> : null} {copy.title}</h2>
          <p>{copy.line(result)}</p>
          {result.result !== 'unknown' && result.code ? <p><strong>{result.code}</strong></p> : null}
        </div>
      ) : null}
      <p className="fine">The first scan checks someone in, and a later scan checks them out. A session is 1 hour, with 15 minutes' grace before and after, so a pass works from 15 minutes before its start until 15 minutes after its hour ends. Demo passes work at any time. {admin ? 'You have the admin password, so every pass works here.' : 'A real pass can only be scanned from its own account, or by an admin, so it says Not found anywhere else.'}</p>
    </div>
  );
}
