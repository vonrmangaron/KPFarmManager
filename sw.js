/* ProdWise.VM — Service Worker (v6)
   Strategy:
   - Network-first for HTML, CSS, JS — always get latest code when online.
   - Cache-first for icons, images, fonts — rarely change, safe to serve stale.
   - On new install, wipes all older caches so no stale assets linger.
*/

const CACHE_NAME = 'prodwise-v36';
const CORE_ASSETS = [
  './',
  './index.html',
  './prodwise.css',
  './manifest.json',
  './js/constants.js',
  './js/calc.js',
  './js/loads.js',
  './js/storage.js',
  './js/sync.js',
  './js/data.js',
  './js/ui.js',
  './js/render.js',
  './js/app.js'
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.toLowerCase();
  const isHtml = req.mode === 'navigate' || path.endsWith('/') || path.endsWith('.html');
  const isCode = path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.json');

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

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && (
          path.endsWith('.png') || path.endsWith('.svg') || path.endsWith('.ico') ||
          path.endsWith('.webp') || path.endsWith('.jpg') || path.endsWith('.jpeg') ||
          path.endsWith('.woff') || path.endsWith('.woff2') || path.endsWith('.ttf')
        )) {
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
