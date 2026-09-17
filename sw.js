/* ProdWise.VM — service worker
   Cache strategy:
   - App shell (HTML, manifest, icons) — network-first for HTML, cache-first for assets
   - CDN assets (SheetJS, Google Fonts) — cache-first with long TTL
   - Cloud sync (workers.dev) — always network (never cached)
*/

const CACHE_VERSION = 'prodwise-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache cloud sync calls
  if (url.hostname.endsWith('workers.dev')) return;

  // Only handle GET
  if (req.method !== 'GET') return;

  // CDN assets: cache-first
  const isCDN =
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isCDN) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // Same-origin
  if (url.origin === self.location.origin) {
    // HTML navigation: network-first (so updates roll in fast)
    if (req.mode === 'navigate' || req.destination === 'document') {
      event.respondWith(
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        }).catch(() => caches.match('./index.html'))
      );
      return;
    }
    // Other assets: cache-first
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});
