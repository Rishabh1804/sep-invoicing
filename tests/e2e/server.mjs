import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP } from '../../server/app/src/headers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.argv[2] || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/* Geist under test (docs/UI_PASS_3.md §24m). The app's pages name Google Fonts' stylesheet; served here they name the test copy
   (tests/fixtures/fonts/fonts.css, the interface's two faces), so every page and every window measures in the face the app ships
   in, with no request intercepted. */
const FONTS_CSS = '/tests/fixtures/fonts/fonts.css';
function localFonts(html) {
  return html.replace(/<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\s*/g, '')
    .replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']*/g, FONTS_CSS);
}

/* P280, the new address (move.js, S0): the app checks two exact origins, the old address and the new one. A request carrying
   P280's header gets a page whose three lines naming them name this server on two local origins instead: the old address is
   127.0.0.1 here and the new one localhost, the same server, so each keeps its own storage as two hosts would. The checks
   themselves are never loosened, and a page fetched without the header is the page as built. */
const MOVE_TEST_HEADER = 'x-sep-move-test';
/* P280: a page asked with this header carries the new address's Content-Security-Policy, the Worker's own string
   (server/app/src/headers.js), so a spec can watch the app run under it. */
const CSP_TEST_HEADER = 'x-sep-csp';
/* P281: the move's waits (move.js: the push's limit, the new address's answer), shortened for a request carrying this header, as
   `MOVE_PUSH_MS=1500,MOVE_WAIT_READY_MS=1500`. Only the named lines and only digits; without the header each wait is as built. */
const MOVE_MS_TEST_HEADER = 'x-sep-move-ms';
const MOVE_MS_NAMES = ['MOVE_PUSH_MS', 'MOVE_WAIT_READY_MS', 'MOVE_WAIT_DONE_MS'];
function moveWaits(html, spec) {
  String(spec).split(',').forEach((pair) => {
    const m = /^\s*([A-Z_]+)=(\d+)\s*$/.exec(pair);
    if (!m || !MOVE_MS_NAMES.includes(m[1])) return;
    html = html.replace(new RegExp('var ' + m[1] + ' = \\d+;'), `var ${m[1]} = ${m[2]};`);
  });
  return html;
}
function moveOrigins(html) {
  return html.replace(/var MOVE_OLD_ORIGIN = '[^']*';/, `var MOVE_OLD_ORIGIN = 'http://127.0.0.1:${PORT}';`)
    .replace(/var MOVE_OLD_PATH = '[^']*';/, "var MOVE_OLD_PATH = '/';")
    .replace(/var MOVE_NEW_ORIGIN = '[^']*';/, `var MOVE_NEW_ORIGIN = 'http://localhost:${PORT}';`);
}

/* P284: the relay (server/app's /api/relay/<id>, docs/atlas/core/new-address.md), in memory, test-only, with the Worker's
   semantics: an id of 22 to 43 base64url characters; PUT (text/plain or application/octet-stream, 1 to 4096 bytes) 204, the
   first write wins (409 after it); GET 200 with the body once, 204 while nothing is there or after the one read, 410 once the
   entry ran out unread (120 s, kept as a mark for 120 s more); no-store on every answer. */
const RELAY = new Map();
const RELAY_MS = 120000;
function relay(req, res, id) {
  const head = { 'Cache-Control': 'no-store' };
  const end = (status, extra = {}, body) => { res.writeHead(status, { ...head, ...extra }); res.end(body); };
  if (!/^[A-Za-z0-9_-]{22,43}$/.test(id)) return end(404);
  const now = Date.now();
  const e = RELAY.get(id);
  if (e && now - e.at >= 2 * RELAY_MS) RELAY.delete(id);
  if (req.method === 'PUT') {
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (ct !== 'text/plain' && ct !== 'application/octet-stream') return end(415);
    const parts = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size <= 4096) parts.push(c); });
    req.on('end', () => {
      if (!size) return end(400);
      if (size > 4096) return end(413);
      if (RELAY.has(id)) return end(409);
      RELAY.set(id, { at: Date.now(), body: Buffer.concat(parts), expired: false });
      end(204);
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return end(405, { Allow: 'GET, PUT' });
  const cur = RELAY.get(id);
  if (!cur || (!cur.body && !cur.expired)) return end(204);
  if (cur.expired || now - cur.at >= RELAY_MS) { cur.body = null; cur.expired = true; return end(410); }
  const body = cur.body;
  cur.body = null;
  end(200, { 'Content-Type': 'application/octet-stream' }, body);
}

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relayId = /^\/api\/relay\/([^/]*)$/.exec(urlPath);
  if (relayId) { relay(req, res, relayId[1]); return; }
  if (urlPath.startsWith('/api/relay')) { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end(); return; }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    let data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') {
      let html = localFonts(data.toString('utf8'));
      if (req.headers[MOVE_TEST_HEADER]) html = moveOrigins(html);
      if (req.headers[MOVE_TEST_HEADER] && req.headers[MOVE_MS_TEST_HEADER]) html = moveWaits(html, req.headers[MOVE_MS_TEST_HEADER]);
      data = Buffer.from(html);
    }
    const head = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (ext === '.html' && req.headers[CSP_TEST_HEADER]) head['Content-Security-Policy'] = CSP;
    res.writeHead(200, head);
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e] serving ${ROOT} on http://127.0.0.1:${PORT}`);
});
