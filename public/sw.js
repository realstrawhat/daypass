// Keeps passes and the app shell available with no signal, such as in a gym basement.
const VERSION = 'daypass-v2';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// In-app links aren't full page loads, so an opened pass asks to be saved directly.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'save-pages') return;
  event.waitUntil(caches.open(PAGES).then((c) => Promise.all(event.data.urls.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Fingerprinted assets and images: cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image') || url.pathname.startsWith('/img/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Full page loads: live when possible, last saved copy with no signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const saved = await caches.match(request, { ignoreSearch: true });
          if (saved) return saved;
          // An unsaved pass falls back to the saved Passes list. Other pages say they aren't saved.
          if (url.pathname.startsWith('/bookings')) {
            const list = await caches.match('/bookings');
            if (list) return list;
          }
          return caches.match(OFFLINE);
        }),
    );
  }
});
