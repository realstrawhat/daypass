'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

type U = { name: string; email: string; home_city: string | null; default_sort: string; max_price_cents: number | null; saved_card: { brand: string; last4: string } | null };

export function AccountClient({ user, passkeys }: { user: U; passkeys: number }) {
  const router = useRouter();
  const [city, setCity] = useState(user.home_city ?? '');
  const [sort, setSort] = useState(user.default_sort);
  const [maxPrice, setMaxPrice] = useState(user.max_price_cents != null ? String(user.max_price_cents / 100) : '');
  const [card, setCard] = useState(user.saved_card);
  const [saved, setSaved] = useState('');
  const [faceId, setFaceId] = useState(passkeys > 0 ? 'on' : 'off');
  const [faceMsg, setFaceMsg] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleted, setDeleted] = useState(false);

  const savePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved('');
    const res = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ home_city: city, default_sort: sort, max_price_cents: maxPrice ? Math.round(Number(maxPrice) * 100) : null }) });
    setSaved(res.ok ? 'Preferences saved. Search uses them from now on.' : 'Preferences were not saved. Try again.');
    router.refresh();
  };

  const removeCard = async () => {
    const res = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remove_card: true }) });
    if (res.ok) setCard(null);
  };

  const addFace = async () => {
    setFaceMsg('');
    try {
      const start = await fetch('/api/passkey/register-options', { method: 'POST' });
      const data = await start.json();
      if (!start.ok) throw new Error(data.error);
      const attestation = await startRegistration({ optionsJSON: data.options });
      const done = await fetch('/api/passkey/register-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: data.id, response: attestation }) });
      const result = await done.json();
      if (!done.ok) throw new Error(result.error);
      setFaceId('on');
      setFaceMsg('Face ID is on. Use it next time you log in.');
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      setFaceMsg(name === 'NotAllowedError' ? 'Face ID setup was cancelled.' : e instanceof Error ? e.message : 'This device could not set up Face ID.');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  };

  const removeAccount = async () => {
    setDeleteError('');
    const res = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmText }) });
    const data = await res.json();
    if (!res.ok) {
      setDeleteError(data.error);
      return;
    }
    setDeleted(true);
    setTimeout(() => window.location.assign('/'), 2500);
  };

  if (deleted) return <div className="banner" role="status"><strong>Deletion requested</strong><span>Your account will be erased within 30 days. You have been logged out.</span></div>;

  return (
    <div className="account">
      <section className="panel" aria-labelledby="a-details">
        <h2 id="a-details" className="section-title">Your details</h2>
        <p><strong>{user.name}</strong><br />{user.email}</p>
        <div className="panel-links">
          <Link href="/bookings" className="btn btn-white">My bookings</Link>
          <button type="button" className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </section>

      <form className="panel" onSubmit={savePrefs} aria-labelledby="a-prefs">
        <h2 id="a-prefs" className="section-title">Search preferences</h2>
        <div className="field"><label htmlFor="pref-city">Home city</label><input id="pref-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" /></div>
        <div className="field"><label htmlFor="pref-sort">Sort gyms by</label>
          <select id="pref-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recommended">Recommended</option><option value="nearest">Nearest</option><option value="price_asc">Lowest price</option><option value="price_desc">Highest price</option><option value="rating">Top rated</option>
          </select>
        </div>
        <div className="field"><label htmlFor="pref-price">Highest day pass price in euros</label><input id="pref-price" type="number" min="1" max="200" inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></div>
        <button type="submit" className="btn btn-volt">Save preferences</button>
        {saved ? <p role="status">{saved}</p> : null}
      </form>

      <section className="panel" aria-labelledby="a-pay">
        <h2 id="a-pay" className="section-title">Saved payment</h2>
        {card ? (
          <>
            <p>{card.brand}{card.last4 ? ` •••• ${card.last4}` : ''}. Selected first at checkout.</p>
            <button type="button" className="btn btn-ghost" onClick={removeCard}>Remove</button>
          </>
        ) : <p className="note">Nothing saved. Tick "Save this for next time" at checkout.</p>}
      </section>

      <section className="panel" aria-labelledby="a-face">
        <h2 id="a-face" className="section-title">Log in with Face ID</h2>
        <p>{faceId === 'on' ? 'On for this account.' : 'Uses your device passkey: Face ID, Touch ID or Windows Hello.'}</p>
        <button type="button" className="btn btn-white" onClick={addFace}>{faceId === 'on' ? 'Add another device' : 'Turn on Face ID'}</button>
        {faceMsg ? <p role="status">{faceMsg}</p> : null}
      </section>

      <section className="panel" aria-labelledby="a-delete">
        <h2 id="a-delete" className="section-title">Delete account</h2>
        <p>We erase your account and bookings within 30 days of your request. <Link href="/privacy" className="link">Read the privacy notice</Link>.</p>
        <div className="field"><label htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></div>
        {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
        <button type="button" className="btn btn-danger" onClick={removeAccount}>Request deletion</button>
      </section>
    </div>
  );
}
