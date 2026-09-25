/* ============================================================
   CluckWise.vm — service worker
   ------------------------------------------------------------
   What it does:
   • Pages (cluckwise.html, viewer.html): NETWORK FIRST.
     Online → always the newest version from GitHub Pages.
     No signal → the last saved copy, so the app still opens in the sheds.
   • Icons / manifests: served from the saved copy instantly, refreshed
     in the background.
   • CDN libraries + Google Fonts: saved once, reused (their URLs are versioned).
   • NEVER touched (always straight to the internet):
       - the sync Worker (farm data, reports, restore points)
       - Open-Meteo weather + location search
       - WhatsApp links, and anything that isn't a GET request
   Bump CACHE_VERSION when you deploy. It clears the old saved files on every
   device. Because pages are network-first you'll get new pages even if you
   forget, but bumping keeps icons/libraries fresh too.
   ============================================================ */

const CACHE_VERSION = 'cluckwise-2026.09.25-n1';
const PAGE_CACHE    = CACHE_VERSION + '-pages';
const STATIC_CACHE  = CACHE_VERSION + '-static';
const CDN_CACHE     = CACHE_VERSION + '-cdn';

// Files saved on install. Missing files are skipped, so this list can include
// names you may or may not have (e.g. index.html, icon-512.png).
const APP_SHELL = [
  './',
  'index.html',
  'cluckwise.html',
  'viewer.html',
  'manifest.json',
  'manifest-viewer.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Third-party hosts that are safe to keep a copy of.
const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// How long to wait for the network before falling back to the saved page.
const PAGE_TIMEOUT_MS = 4000;

// ---------- install: save the app shell ----------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGE_CACHE);
    await Promise.allSettled(APP_SHELL.map(async (path) => {
      try {
        const res = await fetch(new Request(path, { cache: 'reload' }));
        if (res.ok) await cache.put(path, res);
      } catch (e) { /* offline during install or file doesn't exist — skip */ }
    }));
    // Take over straight away instead of waiting for every tab to close.
    await self.skipWaiting();
  })());
});

// ---------- activate: delete old versions ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [PAGE_CACHE, STATIC_CACHE, CDN_CACHE];
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // let POST/PUT go straight through

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Anything cross-origin that isn't a trusted CDN is left completely alone:
  // the sync Worker, Open-Meteo weather, geocoding, wa.me, etc.
  if (!sameOrigin) {
    if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req, CDN_CACHE));
    return;
  }

  // Pages: network first, saved copy when offline.
  const isPage = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html') ||
                 url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isPage) {
    event.respondWith(networkFirstPage(req));
    return;
  }

  // Never cache the service worker file itself.
  if (url.pathname.endsWith('/sw.js')) return;

  // Icons, manifests and other same-origin files.
  event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
});

// ---------- strategies ----------
async function networkFirstPage(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetchWithTimeout(req, PAGE_TIMEOUT_MS);
    if (res && res.ok) {
      // Save under the plain URL (no ?query) so offline lookups match.
      cache.put(stripQuery(req.url), res.clone());
    }
    return res;
  } catch (e) {
    const saved = await cache.match(stripQuery(req.url)) ||
                  await cache.match(req, { ignoreSearch: true }) ||
                  await cache.match('cluckwise.html') ||
                  await cache.match('index.html') ||
                  await cache.match('./');
    if (saved) return saved;
    return new Response(
      '<h2 style="font-family:sans-serif;padding:24px">Offline — open CluckWise once with a connection first.</h2>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(req);
  const refresh = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return saved || (await refresh) || new Response('', { status: 504 });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(req);
  if (saved) return saved;
  try {
    const res = await fetch(req);
    // Opaque (no-cors) responses from font/CDN hosts are fine to keep.
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('', { status: 504 });
  }
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req, { cache: 'no-store' }).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function stripQuery(u) {
  const x = new URL(u);
  x.search = '';
  x.hash = '';
  return x.href;
}

// Lets a page ask a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
