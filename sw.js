/* ProdWise.VM — Service Worker
   Strategy: network-first for HTML/CSS/JS so updates take effect immediately.
   Cache-first only for icons/fonts (rarely change).
*/

const CACHE_NAME = 'prodwise-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './prodwise.css',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.toLowerCase();
  const isHtml = req.mode === 'navigate' || path.endsWith('/') || path.endsWith('.html');
  const isCode = path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.json');

  // Network-first for HTML/CSS/JS — always try the server, fall back to cache offline
  if (isHtml || isCode) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (icons, images, fonts)
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && (path.endsWith('.png') || path.endsWith('.svg') || path.endsWith('.ico') || path.endsWith('.woff2') || path.endsWith('.woff'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
