'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconChevron } from './Icons';
import { useSession, clearSavedPages } from './session';
import { useFeedback } from './ui/feedback';
import { feel, hapticsOn, setHaptics, setSound, soundOn } from './ui/sensory';
import { Sheet } from './ui/Sheet';

type U = { name: string; email: string; home_city: string | null; default_sort: string; max_price_cents: number | null; saved_card: { brand: string; last4: string } | null; is_demo: boolean };
type Name = 'prefs' | 'pay' | 'face' | 'notify' | 'delete' | null;

const SORT_LABEL: Record<string, string> = { recommended: 'Recommended', nearest: 'Nearest', price_asc: 'Lowest price', price_desc: 'Highest price', rating: 'Top rated' };

export function AccountClient({ user, passkeys }: { user: U; passkeys: number }) {
  const router = useRouter();
  const { refresh, unread, saved } = useSession();
  const { toast } = useFeedback();
  const [sheet, setSheet] = useState<Name>(null);
  const [city, setCity] = useState(user.home_city ?? '');
  const [sort, setSort] = useState(user.default_sort);
  const [maxPrice, setMaxPrice] = useState(user.max_price_cents != null ? String(user.max_price_cents / 100) : '');
  const [card, setCard] = useState(user.saved_card);
  const [faceOn, setFaceOn] = useState(passkeys > 0);
  const [faceMsg, setFaceMsg] = useState('');
  const [reminders, setReminders] = useState(true);
  const [sounds, setSounds] = useState(true);
  useEffect(() => setSounds(soundOn()), []);
  const [buzzes, setBuzzes] = useState(true);
  useEffect(() => setBuzzes(hapticsOn()), []);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (body: unknown) => fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const savePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await patch({ home_city: city, default_sort: sort, max_price_cents: maxPrice ? Math.round(Number(maxPrice) * 100) : null });
      if (!res.ok) throw new Error();
      toast('Preferences saved');
      setSheet(null);
      refresh();
      router.refresh();
    } catch {
      toast('Preferences did not save. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeCard = async () => {
    try {
      const res = await patch({ remove_card: true });
      if (!res.ok) throw new Error();
      setCard(null);
      setSheet(null);
      toast('Saved payment removed');
      refresh();
    } catch {
      toast('That did not save. Try again.', 'error');
    }
  };

  const addFace = async () => {
    setFaceMsg('');
    setBusy(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const start = await fetch('/api/passkey/register-options', { method: 'POST' });
      const data = await start.json();
      if (!start.ok) throw new Error(data.error);
      const attestation = await startRegistration({ optionsJSON: data.options });
      const done = await fetch('/api/passkey/register-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: data.id, response: attestation }) });
      const result = await done.json();
      if (!done.ok) throw new Error(result.error);
      try {
        localStorage.setItem('daypass-passkey', '1');
      } catch {}
      setFaceOn(true);
      setFaceMsg('Face ID is on for this device. Use it next time you log in.');
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      setFaceMsg(name === 'NotAllowedError' ? 'Face ID setup was cancelled.' : 'This device could not set up Face ID. On the login screen, Face ID signs in to a demo account instead.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error();
      try {
        sessionStorage.removeItem('daypass-session');
      } catch {}
      await clearSavedPages();
      window.location.assign('/home');
    } catch {
      toast('Log out did not finish. Try again.', 'error');
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    setDeleteError('');
    setBusy(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmText }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      try {
        sessionStorage.removeItem('daypass-session');
      } catch {}
      await clearSavedPages();
      toast('Account deleted');
      setTimeout(() => window.location.assign('/home'), 1400);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <section className="settings-group" aria-labelledby="s-you">
        <h2 id="s-you">Your Daypass</h2>
        <ul className="rows">
          <li><Link href="/bookings"><span>Passes</span><IconChevron /></Link></li>
          <li><Link href="/saved"><span>Saved gyms</span>{saved.length ? <span className="row-value">{saved.length}</span> : null}<IconChevron /></Link></li>
          <li><Link href="/wallet"><span>Wallet</span><IconChevron /></Link></li>
          <li><Link href="/inbox"><span>Inbox</span>{unread ? <span className="row-value">{unread} new</span> : null}<IconChevron /></Link></li>
        </ul>
      </section>

      <section className="settings-group" aria-labelledby="s-set">
        <h2 id="s-set">Settings</h2>
        <ul className="rows">
          <li><button type="button" onClick={() => setSheet('prefs')}><span>Search preferences</span><span className="row-value">{user.home_city ?? SORT_LABEL[user.default_sort] ?? ''}</span><IconChevron /></button></li>
          <li><button type="button" onClick={() => setSheet('pay')}><span>Saved payment</span><span className="row-value">{card ? `${card.brand}${card.last4 ? ` •••• ${card.last4}` : ''}` : 'None'}</span><IconChevron /></button></li>
          <li><button type="button" onClick={() => setSheet('face')}><span>Face ID</span><span className="row-value">{faceOn ? 'On' : 'Off'}</span><IconChevron /></button></li>
          <li><button type="button" onClick={() => setSheet('notify')}><span>Reminders</span><span className="row-value">{reminders ? 'On' : 'Off'}</span><IconChevron /></button></li>
          <li>
            <button type="button" className="switch-row" role="switch" aria-checked={sounds} onClick={() => { const on = !sounds; setSounds(on); setSound(on); if (on) feel('success'); }}>
              <span>Sounds</span>
              <i className="switch" aria-hidden="true" />
            </button>
          </li>
          <li>
            <button type="button" className="switch-row" role="switch" aria-checked={buzzes} onClick={() => { const on = !buzzes; setBuzzes(on); setHaptics(on); if (on) feel('success'); }}>
              <span>Haptics</span>
              <i className="switch" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <section className="settings-group" aria-labelledby="s-gym">
        <h2 id="s-gym">For gyms</h2>
        <ul className="rows">
          <li><Link href="/partners"><span>List your gym</span><IconChevron /></Link></li>
          <li><Link href="/staff"><span>Door scanner for staff</span><IconChevron /></Link></li>
        </ul>
      </section>

      <section className="settings-group" aria-labelledby="s-more">
        <h2 id="s-more">More</h2>
        <ul className="rows">
          <li><Link href="/privacy"><span>Privacy</span><IconChevron /></Link></li>
          <li><button type="button" disabled={busy} onClick={logout}><span>Log out</span><IconChevron /></button></li>
          <li><button type="button" onClick={() => setSheet('delete')}><span className="danger-text">Delete account</span><IconChevron /></button></li>
        </ul>
      </section>

      <Sheet open={sheet === 'prefs'} onClose={() => setSheet(null)} title="Search preferences">
        <form className="pref-form" onSubmit={savePrefs}>
          <div className="field"><label htmlFor="pref-city">Home city</label><input id="pref-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" /></div>
          <div className="field"><label htmlFor="pref-sort">Sort gyms by</label>
            <select id="pref-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="pref-price">Highest day pass price in euros</label><input id="pref-price" type="number" min="1" max="200" inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></div>
          <button type="submit" className="btn btn-volt btn-block" disabled={busy}>{busy ? 'Saving' : 'Save preferences'}</button>
        </form>
      </Sheet>

      <Sheet open={sheet === 'pay'} onClose={() => setSheet(null)} title="Saved payment">
        <div className="link-list">
          {card ? (
            <>
              <p className="sheet-sub">{card.brand}{card.last4 ? ` •••• ${card.last4}` : ''} is selected first at checkout.</p>
              <button type="button" className="btn btn-ghost btn-block" onClick={removeCard}>Remove</button>
            </>
          ) : <p className="sheet-sub">Nothing saved. Turn on Save for next time at checkout.</p>}
          <p className="fine">Demo payment methods only. No card details are ever collected.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'face'} onClose={() => setSheet(null)} title="Face ID">
        <div className="link-list">
          <p className="sheet-sub">{faceOn ? 'Face ID is on for this account.' : 'Uses your device passkey: Face ID, Touch ID or Windows Hello.'}</p>
          <button type="button" className="btn btn-white btn-block" disabled={busy} onClick={addFace}>{faceOn ? 'Add another device' : 'Turn on Face ID'}</button>
          {faceMsg ? <p role="status">{faceMsg}</p> : null}
        </div>
      </Sheet>

      <Sheet open={sheet === 'notify'} onClose={() => setSheet(null)} title="Reminders">
        <div className="link-list">
          <button type="button" className="switch-row" role="switch" aria-checked={reminders} onClick={() => setReminders(!reminders)}>
            <span><strong>Day-before reminder</strong><small>Appears in your Inbox</small></span>
            <i className="switch" aria-hidden="true" />
          </button>
          <p className="fine">Demo setting for this visit. Real push or email would need a messaging service.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete account">
        <div className="link-list">
          <p className="sheet-sub">This erases your account straight away, with your bookings, passes, ratings and saved gyms, and logs you out. It can't be undone. <Link href="/privacy" className="link">Read the privacy notice</Link>.</p>
          <div className="field"><label htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></div>
          {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
          <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={removeAccount}>Delete my account</button>
        </div>
      </Sheet>
    </>
  );
}
