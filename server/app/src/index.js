// sep-app: SEP Invoicing at its own address, app.somaelectro.co.in (docs/SERVER.md §9 step 0, S0).
//
// It serves dist/ (split/dist.sh: the page, sw.js, the manifest, the icons, version.json, the widget's template) as Workers
// static assets, and nothing else: CLAUDE.md, docs/ and the sources are not in dist/, so no path reaches them. The Worker runs
// before the assets on every request (run_worker_first) for two things only:
// - One origin. Any other host it is reached on (its *.workers.dev address, a preview's address) answers with a redirect to
//   the custom domain, so no second origin ever collects a book or a key. The old path /sep-invoicing/… redirects to /….
// - Headers on every answer: a Content-Security-Policy naming the hosts the app calls today, nosniff, a referrer policy,
//   framing refused, HSTS. No Cross-Origin-Opener-Policy: the handover (split/move.js) needs the window the old address
//   opens to keep its opener, and a COOP of same-origin would cut it.
// S1 adds /api to this one Worker: one deploy, one origin.

export const APP_HOST_DEFAULT = 'app.somaelectro.co.in';
export const OLD_PATH = '/sep-invoicing';

// Every host the app calls (read from split/*.js, 17 Nov 2026): GitHub (sync and the print queue), Claude (photo reads),
// metals.dev (zinc), the feeds Worker, GDELT and MET Norway (the feeds' fallback), Nominatim (placing the plant), Sentry
// (error reports), and Google Fonts (sw.js caches the stylesheet and the faces, and a worker's fetches are connect-src).
// A feeds address typed in Settings other than the default is refused by this list; the app then asks GDELT and MET itself.
export const CONNECT = [
  "'self'",
  'https://api.github.com',
  'https://api.anthropic.com',
  'https://api.metals.dev',
  'https://feeds.somaelectro.co.in',
  'https://api.gdeltproject.org',
  'https://api.met.no',
  'https://nominatim.openstreetmap.org',
  'https://o4511273636855808.ingest.de.sentry.io',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// The page is one built document with its script and style inline (split/build.sh), so both keep 'unsafe-inline'; hashes
// would have to be stamped by the build into this Worker, which S1 can take on. What the policy holds back is everything
// else: no script or frame from anywhere, no request to a host not listed, no form posted, no base rewritten, no framing.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  'connect-src ' + CONNECT.join(' '),
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  // The apex, somaelectro.co.in, is the website's, built elsewhere: no includeSubDomains.
  'Strict-Transport-Security': 'max-age=31536000',
  // The camera reads a worker's ID card (idcard.js); the location places the office QR (checkin.js). Nothing else is asked.
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function canonical(host, path, search) { return 'https://' + host + path + search; }

export function secure(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = (env && env.APP_HOST) || APP_HOST_DEFAULT;
    // One origin: any other host, or plain http, goes to the custom domain, path and query kept.
    if (url.hostname !== host || url.protocol !== 'https:') {
      return secure(new Response(null, { status: 308, headers: { Location: canonical(host, url.pathname, url.search), 'Cache-Control': 'no-store' } }));
    }
    // The old address's path, typed on the new host: the same screen at the root.
    if (url.pathname === OLD_PATH || url.pathname.startsWith(OLD_PATH + '/')) {
      const rest = url.pathname.slice(OLD_PATH.length) || '/';
      return secure(new Response(null, { status: 308, headers: { Location: canonical(host, rest, url.search) } }));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secure(new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
    return secure(await env.ASSETS.fetch(request));
  },
};
