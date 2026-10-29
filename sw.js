/* ProdWise.VM — Service Worker (v6)
   Strategy:
   - Network-first for HTML, CSS, JS — always get latest code when online.
   - Cache-first for icons, images, fonts — rarely change, safe to serve stale.
   - On new install, wipes all older caches so no stale assets linger.
*/

const CACHE_NAME = 'prodwise-v273';
const CORE_ASSETS = [
  './',
  './index.html',
  './prodwise.css',
  './manifest.json',
  './js/farmkey.js',
  './js/notify.js',
  './js/tasks.js',
  './js/shedsetup.js',
  './js/newfarm.js',
  './js/constants.js',
  './js/calc.js',
  './js/loads.js',
  './js/storage.js',
  './js/sync.js',
  './js/data.js',
  './js/ui.js',
  './js/render.js',
  './js/mortality.js',
  './js/manager.js',
  './js/batches.js',
  './js/ask.js',
  './js/pwnotify.js',
  './js/feedoff.js',
  './js/account.js',
  './js/closeout.js',
  './js/shedtabs.js',
  './js/tips.js',
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
      // no-cache: always check with the server, so a new version shows on the next open
      // instead of waiting out the browser's 10-minute cache
      (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }))
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

// ---------- Phone notifications (farm-notify worker, 2026-10-26) ----------
// The message is { title, body, tag, url }. Tapping it opens (or brings back) the app on that task / report.
self.addEventListener('push', (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch (e) { m = { title: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(m.title || 'Farm', {
    body: m.body || '', tag: m.tag || undefined, renotify: !!m.tag,
    requireInteraction: !!m.sticky, vibrate: m.sticky ? [300, 120, 300, 120, 600] : undefined,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: m.url || self.registration.scope },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const target = new URL(url, self.registration.scope);
    const nt = target.searchParams.get('nt') || '';
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = wins.find((w) => new URL(w.url).pathname === target.pathname) || wins.find((w) => w.url.startsWith(self.registration.scope));
    if (same) { await same.focus(); same.postMessage({ type: 'farm-notify-open', nt }); return; }
    await clients.openWindow(target.href);
  })());
});
