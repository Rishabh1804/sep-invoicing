// The app's origin and the headers on every answer (index.js). Kept apart from index.js, which imports the Workers runtime
// (the relay's Durable Object), so that Node can load these too: tests/e2e/server.mjs serves the app under the same policy.

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

export function secure(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
