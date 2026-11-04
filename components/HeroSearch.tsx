'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconLocate, IconSearch } from './Icons';

export function HeroSearch() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) {
      setNote('This browser cannot share your location. Type a city instead.');
      return;
    }
    setLocating(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        // Passed in the page state only. It is never saved on our servers.
        sessionStorage.setItem('daypass-loc', JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }));
        router.push('/gyms?near=me');
      },
      () => {
        setLocating(false);
        setNote('Location is off. Type a city instead.');
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <form
      className="hero-search"
      onSubmit={(e) => {
        e.preventDefault();
        if (city.trim()) router.push(`/gyms?city=${encodeURIComponent(city.trim())}`);
        else locate();
      }}
    >
      <label htmlFor="hero-city" className="sr">City</label>
      <IconSearch className="hero-search-icon" />
      <input id="hero-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Type a city" autoComplete="address-level2" />
      <button type="button" className="hero-locate" onClick={locate} disabled={locating}>
        <IconLocate /> <span>{locating ? 'Locating' : 'Near me'}</span>
      </button>
      <button type="submit" className="hero-go">Find gyms</button>
      {note ? <p className="hero-note" role="status">{note}</p> : null}
    </form>
  );
}
