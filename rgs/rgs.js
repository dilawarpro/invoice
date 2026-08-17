// sw.js
const CACHE_NAME = 'app-cache-v4'; // bump this string every time you deploy changes

// Paths are relative to sw.js's own location (rgs/ folder).
// This MUST list every file the app needs to load with zero network.
const ASSETS = [
  './',
  './rgs.html',
  './rgs.json',
  './manifest.json',
  './dukan.webp',
  './dukanslip.png'
];

// Install: cache all core assets individually so one failing file
// doesn't break the whole install.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('Failed to cache:', url, err))
        )
      );
    })
  );
});

// Activate: delete old caches, take control of open pages immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch handler.
// Navigation requests (page loads / reloads / pull-to-refresh) are handled
// separately from asset requests: they ALWAYS get index.html from cache
// first, regardless of the exact URL, because pull-to-refresh / restarts
// often navigate to a URL that doesn't exactly match the cached key
// (e.g. "/invoice/" vs "/invoice/index.html").
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./rgs.html', clone));
          return response;
        })
        .catch(() =>
          caches.match('./rgs.html').then((cached) => cached || caches.match('./'))
        )
    );
    return;
  }

  // Non-navigation requests (images, css, js, etc): cache-first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./rgs.html'));
    })
  );
});
