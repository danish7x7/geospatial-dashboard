'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Sidebar from './components/Sidebar';

// Dynamically import Map to avoid SSR issues with Deck.gl.
// ssr: false ensures the map only renders client-side — no mounted guard needed.
const Map = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="space-y-4 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400 mx-auto"></div>
        <h2 className="text-xl font-semibold">Loading Geospatial Dashboard...</h2>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-900">
      <Sidebar />
      <div className="ml-0 w-full h-full">
        <Map width={1200} height={800} />
      </div>
    </main>
  );
}