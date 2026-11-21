// The relay (/api/relay/<id>): one opaque answer, carried once between two windows of the app, gone two minutes after its write.
import { describe, it, expect } from 'vitest';
import { env, SELF, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { SECURITY_HEADERS } from '../src/index.js';

const APP = 'https://app.somaelectro.co.in';
const TTL = 120000;

// A fresh id each call: 32 base64url characters, as a 192-bit random id would be.
let seq = 0;
function newId(len = 32) {
  const s = 'T' + (seq++).toString(36) + '_' + Math.random().toString(36).slice(2) + 'x'.repeat(64);
  return s.replace(/[^A-Za-z0-9_-]/g, 'x').slice(0, len);
}
function bytes(n, fill = 7) { return new Uint8Array(n).fill(fill); }
function put(id, body, headers = {}) {
  return SELF.fetch(APP + '/api/relay/' + id, { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream', ...headers } });
}
function get(id, headers = {}) { return SELF.fetch(APP + '/api/relay/' + id, { headers }); }
function stubFor(id) { return env.RELAY.get(env.RELAY.idFromName(id)); }

describe('the relay carries one answer once', () => {
  it('PUT then GET returns the body once, then 204', async () => {
    const id = newId();
    const sent = new Uint8Array([1, 2, 3, 250, 0, 9]);
    const w = await put(id, sent);
    expect(w.status).toBe(204);
    const r = await get(id);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(sent);
    const again = await get(id);
    expect(again.status).toBe(204);
    expect(await again.text()).toBe('');
  });

  it('answers 204 while nothing is there, and text/plain is taken as well', async () => {
    const id = newId();
    const before = await get(id);
    expect(before.status).toBe(204);
    expect(before.headers.get('Cache-Control')).toBe('no-store');
    expect((await put(id, 'b64url-text.answer', { 'Content-Type': 'text/plain;charset=UTF-8' })).status).toBe(204);
    const r = await get(id);
    expect(r.status).toBe(200);
    expect(new TextDecoder().decode(await r.arrayBuffer())).toBe('b64url-text.answer');
  });

  it('first write wins: a second PUT answers 409 and the first body stays', async () => {
    const id = newId();
    expect((await put(id, bytes(10, 1))).status).toBe(204);
    expect((await put(id, bytes(10, 2))).status).toBe(409);
    const r = await get(id);
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes(10, 1));
    // Read once, the id stays spent until it is cleared: no second answer under it.
    expect((await put(id, bytes(10, 3))).status).toBe(409);
    expect((await get(id)).status).toBe(204);
  });

  it('takes 4096 bytes, refuses 4097 with 413 and stores nothing', async () => {
    const ok = newId();
    expect((await put(ok, bytes(4096))).status).toBe(204);
    expect((await get(ok)).status).toBe(200);
    const big = newId();
    expect((await put(big, bytes(4097))).status).toBe(413);
    expect((await get(big)).status).toBe(204);
  });

  it('refuses an over-size body sent without a length (streamed) with 413', async () => {
    const id = newId();
    const stream = new ReadableStream({
      start(c) { for (let i = 0; i < 5; i++) c.enqueue(bytes(1000)); c.close(); },
    });
    const res = await put(id, stream);
    expect(res.status).toBe(413);
    expect((await get(id)).status).toBe(204);
  });

  it('refuses an empty body (400) and any type but octet-stream or text/plain (415)', async () => {
    const id = newId();
    expect((await put(id, new Uint8Array(0))).status).toBe(400);
    expect((await put(id, '{"a":1}', { 'Content-Type': 'application/json' })).status).toBe(415);
    expect((await put(id, 'a=1', { 'Content-Type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await get(id)).status).toBe(204);
  });
});

describe('the relay answers only its own ids, methods and origin', () => {
  it('a bad id is 404; 22 and 43 characters are ids', async () => {
    for (const good of [newId(22), newId(43)]) {
      expect((await get(good)).status, good).toBe(204);
    }
    const bad = ['', 'x'.repeat(21), 'x'.repeat(44), 'abc+def/ghijklmnopqrstuvw', 'x'.repeat(30) + '=', 'x'.repeat(30) + '.', newId() + '/more'];
    for (const b of bad) {
      expect((await get(b)).status, 'GET ' + b).toBe(404);
      expect((await put(b, bytes(4))).status, 'PUT ' + b).toBe(404);
    }
    expect((await SELF.fetch(APP + '/api/relay')).status).toBe(404);
  });

  it('a foreign Origin is 403, with no CORS headers, and stores nothing', async () => {
    const id = newId();
    for (const origin of ['https://elsewhere.example', 'null', 'http://app.somaelectro.co.in', 'https://sep-app.someone.workers.dev']) {
      const w = await put(id, bytes(8), { Origin: origin });
      expect(w.status, origin).toBe(403);
      expect(w.headers.get('Access-Control-Allow-Origin'), origin).toBeNull();
      const r = await get(id, { Origin: origin });
      expect(r.status, origin).toBe(403);
      expect(r.headers.get('Access-Control-Allow-Origin'), origin).toBeNull();
    }
    expect((await get(id)).status).toBe(204);
    // The app's own origin is let through.
    expect((await put(id, bytes(8), { Origin: APP })).status).toBe(204);
    expect((await get(id, { Origin: APP })).status).toBe(200);
  });

  it('any other method on /api/relay is 405 with Allow', async () => {
    const id = newId();
    for (const method of ['POST', 'DELETE', 'PATCH', 'HEAD']) {
      const res = await SELF.fetch(APP + '/api/relay/' + id, { method });
      expect(res.status, method).toBe(405);
      expect(res.headers.get('Allow'), method).toBe('GET, PUT');
    }
  });

  it('PUT is allowed nowhere else: 405 on / and on other paths', async () => {
    for (const p of ['/', '/index.html', '/api/relayx/' + newId(), '/api/other', '/api']) {
      const res = await SELF.fetch(APP + p, { method: 'PUT', body: 'x', headers: { 'Content-Type': 'text/plain' } });
      expect(res.status, p).toBe(405);
      expect(res.headers.get('Allow'), p).toBe('GET, HEAD');
    }
  });

  it('a PUT reaching another host is sent to the one origin, never stored there', async () => {
    const id = newId();
    const res = await SELF.fetch('https://sep-app.someone.workers.dev/api/relay/' + id, { method: 'PUT', body: 'x', headers: { 'Content-Type': 'text/plain' }, redirect: 'manual' });
    expect(res.status).toBe(308);
    expect((await get(id)).status).toBe(204);
  });
});

describe('the relay forgets', () => {
  it('sets its alarm 120 s after the write, and the alarm clears the body (GET 410, then 204 once cleared)', async () => {
    const id = newId();
    const t0 = Date.now();
    expect((await put(id, bytes(16))).status).toBe(204);
    const stub = stubFor(id);
    const alarm = await runInDurableObject(stub, (_o, state) => state.storage.getAlarm());
    expect(alarm).toBeGreaterThanOrEqual(t0 + TTL);
    expect(alarm).toBeLessThan(Date.now() + TTL + 1000);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const stored = await runInDurableObject(stub, (_o, state) => state.storage.get('entry'));
    expect(stored.body).toBeUndefined();
    expect((await get(id)).status).toBe(410);
    expect((await put(id, bytes(16))).status).toBe(409);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const left = await runInDurableObject(stub, async (_o, state) => (await state.storage.list()).size);
    expect(left).toBe(0);
    expect((await get(id)).status).toBe(204);
  });

  it('never serves an entry older than 120 s, even when the alarm is late', async () => {
    const id = newId();
    expect((await put(id, bytes(16))).status).toBe(204);
    const stub = stubFor(id);
    await runInDurableObject(stub, async (_o, state) => {
      const e = await state.storage.get('entry');
      await state.storage.put('entry', { ...e, at: e.at - TTL - 1 });
    });
    expect((await get(id)).status).toBe(410);
    const stored = await runInDurableObject(stub, (_o, state) => state.storage.get('entry'));
    expect(stored.body).toBeUndefined();
  });

  it('an entry read before its time is cleared whole by the alarm', async () => {
    const id = newId();
    expect((await put(id, bytes(16))).status).toBe(204);
    expect((await get(id)).status).toBe(200);
    const stub = stubFor(id);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const left = await runInDurableObject(stub, async (_o, state) => (await state.storage.list()).size);
    expect(left).toBe(0);
  });
});

describe('the relay answers carry the headers', () => {
  it('every relay answer carries the security headers and no-store', async () => {
    const id = newId();
    const answers = [
      ['GET empty', await get(id)],
      ['PUT', await put(id, bytes(8))],
      ['PUT again', await put(id, bytes(8))],
      ['GET', await get(id)],
      ['413', await put(newId(), bytes(4097))],
      ['403', await get(newId(), { Origin: 'https://elsewhere.example' })],
      ['404', await get('short')],
      ['405', await SELF.fetch(APP + '/api/relay/' + newId(), { method: 'POST' })],
    ];
    expect(answers.map(([, r]) => r.status)).toEqual([204, 204, 409, 200, 413, 403, 404, 405]);
    for (const [label, res] of answers) {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(k), label + ' ' + k).toBe(v);
      expect(res.headers.get('Cache-Control'), label).toBe('no-store');
    }
  });
});
