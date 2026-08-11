// SEP Invoicing Service Worker
//
// Canon 0034 (global) reads: service workers NEVER cache HTML. The rule exists
// to stop the unbreakable update loop — a stale shell served from cache forever
// with no way to push a fix to a device that never asks the network again.
//
// This worker keeps that guarantee by a different mechanism. Navigations are
// network-FIRST: an online device always renders the HTML the server just sent,
// and the cached copy is consulted ONLY after the network has actually failed.
// The loop the canon guards against cannot form, because the cache is never
// preferred while the network answers. What it buys is the thing the canon cost
// us: every byte of business data lives in localStorage, yet the app could not
// be opened at all without signal.
//
// - Navigations: network-first, last-known-good copy as the offline fallback.
// - Static assets: cache-first, revalidated in the background.
// - Gemini (scanner), metals.dev (zinc) and GitHub (sync) are network-only.

const CACHE_NAME = 'sep-inv-v28';
const SHELL_CACHE = 'sep-inv-shell-v28';
const KEEP_CACHES = [CACHE_NAME, SHELL_CACHE];

// Every navigation, whatever its query string, maps to this one shell entry.
const SHELL_KEY = './';

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

// Same-origin and always available: if one of these fails the install is a lie,
// so they stay atomic.
const CORE_ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png'];

// Cross-origin and allowed to fail. These used to sit in the same addAll() as
// the core assets, and addAll is all-or-nothing — so a single hiccup reaching
// fonts.googleapis.com rejected the install, and the worker never activated at
// all. Nothing was cached, including the local icons that would have succeeded.
const OPTIONAL_ASSETS = [FONT_CSS];

// Never intercepted: live data, credentials in flight, or both.
const NETWORK_ONLY_HOSTS = [
  'generativelanguage.googleapis.com',
  'api.github.com',
  'api.metals.dev',
  'metals.dev'
];

// Runtime-cacheable third parties. The stylesheet alone was cached before,
// never the woff2 files it points at — so an installed app went offline and
// lost its typography anyway.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// Shown only when a device has never once loaded the app online, so there is no
// shell to fall back to. It cannot reference the stylesheet — that lives inside
// the very document that is missing — which is why this one page carries its
// own colours. The palette matches the light-theme design tokens.
const OFFLINE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>SEP Invoicing — Offline</title><style>' +
  'body{font-family:system-ui,sans-serif;background:#faf9f5;color:#1a1a1a;' +
  'display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}' +
  '.w{max-width:320px;text-align:center}h1{font-size:1.25rem;margin:0 0 8px}' +
  'p{color:#555;font-size:0.875rem;line-height:1.5;margin:0 0 16px}' +
  'a{display:inline-block;background:#b45a37;color:#fff;text-decoration:none;border-radius:8px;' +
  'padding:12px 20px;font-size:0.875rem;min-height:44px;line-height:20px}' +
  '@media(prefers-color-scheme:dark){body{background:#1a1918;color:#e8e6e1}p{color:#aaa8a0}}' +
  '</style></head><body><div class="w"><h1>SEP Invoicing is offline</h1>' +
  '<p>This device has not loaded the app while online yet, so there is no copy stored ' +
  // A link rather than a button with an inline handler: HR-2 holds here too,
  // and this document has no script bundle to delegate from.
  'to open. Connect once and it will work offline from then on.</p>' +
  '<a href="./">Try again</a></div></body></html>';

self.addEventListener('install', function(e) {
  e.waitUntil((async function() {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await Promise.all(OPTIONAL_ASSETS.map(function(url) {
      return cache.add(url).catch(function() { /* best effort, never fatal */ });
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function(e) {
  e.waitUntil((async function() {
    const keys = await caches.keys();
    await Promise.all(keys.map(function(k) {
      return KEEP_CACHES.indexOf(k) === -1 ? caches.delete(k) : null;
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(e) {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Network-only, before anything else can claim them.
  if (NETWORK_ONLY_HOSTS.indexOf(url.hostname) !== -1) return;

  // Browsers do not cache non-GET and neither do we.
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith(navigationResponse(req));
    return;
  }

  if (isCacheable(url)) {
    e.respondWith(assetResponse(e, req));
  }
});

function isCacheable(url) {
  if (url.origin === self.location.origin) return true;
  return FONT_HOSTS.indexOf(url.hostname) !== -1;
}

// Network-first. The cache is a fallback, never a preference — this is what
// keeps the promise Canon 0034 was written to protect.
async function navigationResponse(req) {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    // Only a genuine 200 is an app shell; a 404 page is not worth keeping.
    if (fresh && fresh.ok && fresh.type === 'basic') {
      await shell.put(SHELL_KEY, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await shell.match(SHELL_KEY);
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function assetResponse(e, req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  if (cached) {
    // Refresh behind the response rather than ahead of it, so a cached asset
    // cannot go stale permanently and the user still never waits on it.
    // waitUntil keeps the fetch alive after the event settles.
    e.waitUntil(revalidate(cache, req));
    return cached;
  }

  try {
    const fresh = await fetch(req);
    if (fresh && (fresh.ok || fresh.type === 'opaque')) {
      await cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return Response.error();
  }
}

async function revalidate(cache, req) {
  try {
    const fresh = await fetch(req);
    if (fresh && (fresh.ok || fresh.type === 'opaque')) await cache.put(req, fresh.clone());
  } catch (err) { /* offline: the cached copy stands */ }
}
