'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { money } from '@/lib/format';

type OwnedGym = { id: string; slug: string; name: string; city: string; price_cents: number; confirmed_at: string; visits: number; sales: number; commission: number };

function Owned({ g }: { g: OwnedGym }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(g.price_cents / 100));
  const [msg, setMsg] = useState('');
  const age = Math.floor((Date.now() - new Date(g.confirmed_at).getTime()) / 86400000);
  const left = 90 - age;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/partners', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, price }) });
    const data = await res.json();
    setMsg(res.ok ? 'Price saved and details confirmed for another 90 days.' : data.error);
    if (res.ok) router.refresh();
  };

  return (
    <li className="owned">
      <div className="owned-head">
        <h3><Link href={`/gyms/${g.slug}`}>{g.name}</Link></h3>
        <p>{g.city}</p>
      </div>
      <dl className="owned-stats">
        <div><dt>Visits</dt><dd>{g.visits}</dd></div>
        <div><dt>Sales</dt><dd>{money(g.sales)}</dd></div>
        <div><dt>Commission owed</dt><dd>{money(g.commission)}</dd></div>
      </dl>
      <p className={left <= 14 ? 'form-error' : 'note'}>{left > 0 ? `Confirm details within ${left} ${left === 1 ? 'day' : 'days'}.` : 'Details are overdue. Confirm them now.'}</p>
      <form className="owned-form" onSubmit={save}>
        <div className="field"><label htmlFor={`price-${g.id}`}>Day pass price in euros</label><input id={`price-${g.id}`} type="number" min="1" max="200" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <button type="submit" className="btn btn-white">Save and confirm details</button>
      </form>
      {msg ? <p role="status">{msg}</p> : null}
    </li>
  );
}

export function PartnerClient({ gyms }: { gyms: OwnedGym[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', city: '', address: '', lat: '', lng: '', price: '12', capacity: '4', equipment: '', description: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    router.push(`/gyms/${data.slug}`);
  };

  return (
    <div className="partner-grid">
      {gyms.length ? (
        <section aria-labelledby="yours">
          <h2 id="yours" className="section-title">Your gyms</h2>
          <ul className="owned-list">{gyms.map((g) => <Owned key={g.id} g={g} />)}</ul>
        </section>
      ) : null}

      <form className="panel" onSubmit={submit} aria-labelledby="list-title">
        <h2 id="list-title" className="section-title">List a gym</h2>
        <div className="field"><label htmlFor="p-name">Gym name</label><input id="p-name" required value={form.name} onChange={set('name')} /></div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-city">City</label><input id="p-city" required value={form.city} onChange={set('city')} /></div>
          <div className="field"><label htmlFor="p-address">Street address</label><input id="p-address" required value={form.address} onChange={set('address')} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-lat">Entrance latitude (optional)</label><input id="p-lat" inputMode="decimal" value={form.lat} onChange={set('lat')} /></div>
          <div className="field"><label htmlFor="p-lng">Entrance longitude (optional)</label><input id="p-lng" inputMode="decimal" value={form.lng} onChange={set('lng')} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-price">Day pass price in euros</label><input id="p-price" type="number" min="1" max="200" step="0.5" required value={form.price} onChange={set('price')} /></div>
          <div className="field"><label htmlFor="p-cap">Visitors per hour</label><input id="p-cap" type="number" min="1" max="50" required value={form.capacity} onChange={set('capacity')} /></div>
        </div>
        <div className="field"><label htmlFor="p-kit">Equipment, separated by commas</label><input id="p-kit" value={form.equipment} onChange={set('equipment')} /></div>
        <div className="field"><label htmlFor="p-desc">Short description</label><textarea id="p-desc" rows={3} value={form.description} onChange={set('description')} /></div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="submit" className="btn btn-volt btn-block" disabled={busy}>{busy ? 'Listing your gym' : 'List gym'}</button>
      </form>
    </div>
  );
}
