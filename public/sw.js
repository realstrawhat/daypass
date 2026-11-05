// Keeps passes and the app shell available with no signal, such as in a gym basement.
const VERSION = 'daypass-v3';
const STATIC = `${VERSION}-static`;
// Saved passes keep this name across versions, so an update doesn't lose them.
const PAGES = 'daypass-pages';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      for (const name of await caches.keys()) {
        if (name === STATIC || name === PAGES) continue;
        // Passes saved by an older version move across, so an update doesn't lose them.
        if (name.endsWith('-pages')) {
          const old = await caches.open(name);
          for (const req of await old.keys()) {
            const res = await old.match(req);
            if (res) await pages.put(req, res);
          }
        }
        await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// A log-out moves this on, so a save that was still on its way can't land after the pages were cleared.
let generation = 0;

// A redirect to the login screen must never be saved in place of a pass.
async function savePage(cache, url) {
  const started = generation;
  const res = await fetch(url);
  if (started === generation && res.ok && !res.redirected) await cache.put(url, res);
}

// In-app links aren't full page loads, so an opened pass asks to be saved directly.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'forget-pages') generation += 1;
  if (event.data?.type !== 'save-pages') return;
  event.waitUntil(caches.open(PAGES).then((c) => Promise.all(event.data.urls.map((u) => savePage(c, u).catch(() => {})))));
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
          if (res.ok && !res.redirected) {
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
