// SEP Invoicing Service Worker
// Canon 0034 (global): Service workers NEVER cache HTML.
// - Navigation requests (HTML) always go to network, no SW interception beyond passthrough.
// - Static assets (manifest, icons, Google Fonts CSS) are cached for offline PWA install.
// - Gemini API calls (scanner) are network-only, never cached.

const CACHE_NAME = 'sep-inv-v26';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Canon 0034: Navigation requests (HTML) always go to network. Never cached.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req));
    return;
  }

  // Skip non-GET (POSTs to Gemini, etc.) — browsers don't cache these and neither do we.
  if (req.method !== 'GET') return;

  // Network-only for Gemini API (scanner) — no interception, no caching.
  if (req.url.indexOf('generativelanguage.googleapis.com') !== -1) {
    return;
  }

  // Static assets: cache-first, network fallback.
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
