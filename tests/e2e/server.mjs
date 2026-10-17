import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
// The app's faces, Geist and Geist Mono, served in Google Fonts' place (docs/UI_PASS_3.md §24m): a test browser reaches Google's
// fonts on CI and not in a sandbox, so a height, a title's room or a line's wrap was measured in whatever face the machine had.
// Every page this server sends links the local copies instead, so every spec draws in the face the app ships in.
const FONTS = path.resolve(__dirname, '..', 'fixtures', 'fonts');
const FONT_CSS = /https:\/\/fonts\.googleapis\.com\/css2\?[^"']*/g;
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

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const fonts = urlPath.startsWith('/__fonts/');
  const base = fonts ? FONTS : ROOT;
  const filePath = path.normalize(path.join(base, fonts ? urlPath.slice('/__fonts/'.length) : urlPath));
  if (!filePath.startsWith(base + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    let data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') data = Buffer.from(data.toString('utf8').replace(FONT_CSS, '/__fonts/fonts.css'), 'utf8');
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e] serving ${ROOT} on http://127.0.0.1:${PORT}`);
});
