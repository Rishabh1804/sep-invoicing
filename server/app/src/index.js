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
// - The relay, /api/relay/<id> (below): the one path that takes a PUT. S1 adds the rest of /api to this one Worker: one deploy,
//   one origin.

import { DurableObject } from 'cloudflare:workers';
import { APP_HOST_DEFAULT, OLD_PATH, secure } from './headers.js';

// Re-exported: the tests and tests/e2e/server.mjs read them (from headers.js in Node).
export { APP_HOST_DEFAULT, OLD_PATH, CONNECT, CSP, SECURITY_HEADERS, secure } from './headers.js';

// The relay. Approving a sign-in on another device from the owner's phone: the other device shows a QR holding a random id and a
// public key; the phone, after its passkey check, encrypts its answer to that key and PUTs it here under the id; the other device
// GETs it. Both are windows of this one origin. What is carried is opaque to the relay: encrypted end to end by the two browsers,
// it holds no secret and can read nothing. One answer per id (the first write wins), read once, gone 120 s after its write.
export const RELAY_PATH = '/api/relay';
export const RELAY_ID = /^[A-Za-z0-9_-]{22,43}$/;   // base64url, a 128- to 256-bit random id
export const RELAY_MAX_BYTES = 4096;
export const RELAY_TTL_MS = 120000;
const RELAY_TYPES = ['application/octet-stream', 'text/plain'];

// One Durable Object per id (idFromName), SQLite-backed (wrangler.toml's migration). Its one key, 'entry', is
// { at, body } while it waits, { at, read: true } once read, { at, gone: true } once its time ran out unread. The alarm at
// at + 120 s clears a read entry whole, and turns a waiting one into gone (the body deleted), kept another 120 s so the
// waiting device is told 410 rather than 204, then cleared. A GET checks the time itself, so a late alarm never serves an
// entry past its 120 s. Every method runs inside the object's input gate: the check and the write are one step.
export class Relay extends DurableObject {
  async put(body) {
    const st = this.ctx.storage;
    if (await st.get('entry')) return 409;
    const at = Date.now();
    await st.put('entry', { at, body });
    await st.setAlarm(at + RELAY_TTL_MS);
    return 204;
  }

  async take() {
    const st = this.ctx.storage;
    const e = await st.get('entry');
    if (!e) return { status: 204 };
    if (e.gone) return { status: 410 };
    if (!e.body) return { status: 204 };
    if (Date.now() >= e.at + RELAY_TTL_MS) {
      await st.put('entry', { at: e.at, gone: true });
      await st.setAlarm(e.at + 2 * RELAY_TTL_MS);
      return { status: 410 };
    }
    await st.put('entry', { at: e.at, read: true });
    return { status: 200, body: e.body };
  }

  async alarm() {
    const st = this.ctx.storage;
    const e = await st.get('entry');
    if (e && e.body) {
      await st.put('entry', { at: e.at, gone: true });
      await st.setAlarm(e.at + 2 * RELAY_TTL_MS);
      return;
    }
    await st.deleteAll();
  }
}

function relayAnswer(status, body, headers) {
  return secure(new Response(body === undefined ? null : body, { status, headers: { 'Cache-Control': 'no-store', ...(headers || {}) } }));
}

function relayText(status, text, headers) {
  return relayAnswer(status, text, { 'Content-Type': 'text/plain; charset=utf-8', ...(headers || {}) });
}

// The body, read up to max bytes and no further: null when it runs over, whatever Content-Length said.
async function readCapped(stream, max) {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}

async function relay(request, env, url, host) {
  // Same origin only: a browser's request from any other page carries its Origin, and is refused. No CORS headers are sent.
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== 'https://' + host) return relayText(403, 'Forbidden');
  if (request.method !== 'GET' && request.method !== 'PUT') return relayText(405, 'Method not allowed', { Allow: 'GET, PUT' });
  const id = url.pathname.startsWith(RELAY_PATH + '/') ? url.pathname.slice(RELAY_PATH.length + 1) : '';
  if (!RELAY_ID.test(id)) return relayText(404, 'Not found');
  const stub = env.RELAY.get(env.RELAY.idFromName(id));
  if (request.method === 'GET') {
    const r = await stub.take();
    if (r.status === 200) return relayAnswer(200, r.body, { 'Content-Type': 'application/octet-stream' });
    return relayAnswer(r.status);
  }
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!RELAY_TYPES.includes(type)) return relayText(415, 'Unsupported media type');
  const len = Number(request.headers.get('Content-Length'));
  if (len > RELAY_MAX_BYTES) return relayText(413, 'Too large');
  const body = await readCapped(request.body, RELAY_MAX_BYTES);
  if (body === null) return relayText(413, 'Too large');
  if (!body.byteLength) return relayText(400, 'Empty');
  return relayAnswer(await stub.put(body));
}

function canonical(host, path, search) { return 'https://' + host + path + search; }

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
    if (url.pathname === RELAY_PATH || url.pathname.startsWith(RELAY_PATH + '/')) return relay(request, env, url, host);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secure(new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
    return secure(await env.ASSETS.fetch(request));
  },
};
