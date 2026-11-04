'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconScan } from './Icons';
import { haptic } from './ui/feedback';

type Result = { result: 'valid' | 'used' | 'expired' | 'wrong_date' | 'cancelled' | 'unknown'; gym?: string; holder?: string; when?: string; code?: string; usedAt?: string };

const COPY: Record<Result['result'], { title: string; tone: string; line: (r: Result) => string }> = {
  valid: { title: 'Let them in', tone: 'is-valid', line: (r) => `${r.holder}, checked in for ${r.gym}.` },
  used: { title: 'Already used', tone: 'is-bad', line: (r) => `This pass was checked in at ${r.usedAt}.` },
  expired: { title: 'Expired', tone: 'is-bad', line: (r) => `This pass was for ${r.when}.` },
  wrong_date: { title: 'Wrong date', tone: 'is-warn', line: (r) => `This pass is for ${r.when}.` },
  cancelled: { title: 'Cancelled', tone: 'is-bad', line: () => 'This booking was cancelled and refunded.' },
  unknown: { title: 'Not found', tone: 'is-bad', line: () => 'Check the code, or ask for the pass on their phone.' },
};

// What reception uses: any phone, no software to install, and a typed code when scanning fails.
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

  const check = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setCode('');
      haptic(data.result === 'valid' ? 20 : 40);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That check did not finish. Try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const stop = useCallback(() => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const startCamera = async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices) {
      setCamera('none');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
        if (value && value !== lastScan.current) {
          lastScan.current = value;
          check(value);
        }
      }, 450);
    } catch {
      setCamera('none');
    }
  };

  const copy = result ? COPY[result.result] : null;

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
      <p className="fine">Demo door scanner. A pass is valid from one hour before its session until three hours after it starts.</p>
    </div>
  );
}
