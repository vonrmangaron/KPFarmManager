/**
 * ProdPlan.VM service worker
 * --------------------------
 * Shared by both the main app and the read-only viewer.
 * Strategy: network-first for same-origin files (so you always get the latest
 * version when online), falling back to the last cached copy when offline.
 * Cross-origin requests (GitHub API, Google Fonts, jsPDF, SortableJS CDN) are
 * left alone entirely — never cached here — so synced data is always fresh
 * when there's a connection, and views/CSS/JS still work with none.
 */

const CACHE_NAME = 'prodplan-vm-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // don't touch cross-origin requests

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        throw err;
      }
    })
  );
});
