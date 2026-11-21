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

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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
