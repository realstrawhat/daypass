'use client';
import { useState } from 'react';
import { FaceScan } from './ui/FaceScan';
import { haptic } from './ui/feedback';

type Props = { onDone: () => void | Promise<void>; initialMode?: 'login' | 'register' };

const post = async (url: string, body?: unknown) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not work. Try again.');
  return data;
};

export function AuthForm({ onDone, initialMode = 'login' }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<'scanning' | 'done' | null>(null);
  const [scanDemo, setScanDemo] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post(`/api/auth/${mode}`, { name, email, password });
      haptic();
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };

  // The subtle way in: a throwaway account with sample history, so a tester never has to sign up.
  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      await post('/api/auth/demo');
      haptic();
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The demo account did not start. Try again.');
      setBusy(false);
    }
  };

  // Uses a real passkey when this device has one for Daypass. Otherwise it plays the
  // Face ID moment and signs in to a demo account.
  const faceId = async () => {
    setBusy(true);
    setError('');
    setScan('scanning');
    try {
      let real = false;
      try {
        real = localStorage.getItem('daypass-passkey') === '1';
      } catch {}
      if (real) {
        const { startAuthentication } = await import('@simplewebauthn/browser');
        const start = await post('/api/passkey/login-options');
        const assertion = await startAuthentication({ optionsJSON: start.options });
        await post('/api/passkey/login-verify', { id: start.id, response: assertion });
      } else {
        setScanDemo(true);
        await Promise.all([post('/api/auth/demo'), new Promise((r) => setTimeout(r, 1300))]);
      }
      setScan('done');
      haptic(14);
      await new Promise((r) => setTimeout(r, 550));
      await onDone();
    } catch (err) {
      setScan(null);
      setBusy(false);
      const cancelled = err instanceof Error && err.name === 'NotAllowedError';
      setError(cancelled ? 'Face ID was cancelled. Try again or use your password.' : 'Face ID did not work. Use your password instead.');
    }
  };

  return (
    <form className="auth" onSubmit={submit} noValidate>
      {scan ? (
        <div className="auth-scan" role="status">
          <FaceScan state={scan} />
          <p>{scan === 'done' ? (scanDemo ? 'Signed in to a demo account' : 'Done') : scanDemo ? 'Demo Face ID' : 'Face ID'}</p>
        </div>
      ) : null}
      <div className="segmented" role="group" aria-label="Log in or create an account" data-index={mode === 'login' ? 0 : 1}>
        <i className="segmented-thumb" aria-hidden="true" />
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
      </div>
      {mode === 'register' ? (
        <div className="field field-in"><label htmlFor="auth-name">Name</label><input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>
      ) : null}
      <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
      <div className="field">
        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required aria-describedby={mode === 'register' ? 'pw-hint' : undefined} />
        {mode === 'register' ? <small id="pw-hint">At least 8 characters.</small> : null}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-volt btn-block" disabled={busy}>{busy && !scan ? 'One moment' : mode === 'login' ? 'Log in' : 'Create account'}</button>
      {mode === 'login' ? <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={faceId}>Log in with Face ID</button> : null}
      <button type="button" className="auth-skip" disabled={busy} onClick={demo}>Skip this, use a demo account</button>
    </form>
  );
}
