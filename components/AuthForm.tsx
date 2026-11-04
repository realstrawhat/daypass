'use client';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

type Props = { onDone: () => void; initialMode?: 'login' | 'register' };

export function AuthForm({ onDone, initialMode = 'login' }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };

  const passkey = async () => {
    setBusy(true);
    setError('');
    try {
      const start = await fetch('/api/passkey/login-options', { method: 'POST' });
      const options = await start.json();
      if (!start.ok) throw new Error(options.error);
      const assertion = await startAuthentication({ optionsJSON: options.options });
      const res = await fetch('/api/passkey/login-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: options.id, response: assertion }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      setError(name === 'NotAllowedError' ? 'Face ID was cancelled. Try again or use your password.' : err instanceof Error ? err.message : 'Face ID did not work. Use your password.');
      setBusy(false);
    }
  };

  return (
    <form className="auth" onSubmit={submit} noValidate>
      <div className="auth-switch" role="group" aria-label="Log in or create an account">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
      </div>
      {mode === 'register' ? (
        <div className="field"><label htmlFor="auth-name">Name</label><input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>
      ) : null}
      <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
      <div className="field">
        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required aria-describedby={mode === 'register' ? 'pw-hint' : undefined} />
        {mode === 'register' ? <small id="pw-hint">At least 8 characters.</small> : null}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-volt btn-block" disabled={busy}>{busy ? 'One moment' : mode === 'login' ? 'Log in' : 'Create account'}</button>
      {mode === 'login' ? <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={passkey}>Log in with Face ID</button> : null}
    </form>
  );
}
