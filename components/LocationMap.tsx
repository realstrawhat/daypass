'use client';
import dynamic from 'next/dynamic';
import type { MapGym } from './GymMap';

const GymMap = dynamic(() => import('./GymMap').then((m) => m.GymMap), { ssr: false, loading: () => <div className="map-wrap map-loading" /> });

export function LocationMap({ gym }: { gym: MapGym }) {
  return <GymMap gyms={[gym]} center={{ lat: gym.lat, lng: gym.lng }} zoom={14.500} activeId={gym.id} single />;
}
