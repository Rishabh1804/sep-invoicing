// The routes, CORS and the answers' caching headers; and the Worker as deployed (SELF: the
// default export, with wrangler.toml's vars) for what needs no upstream.
import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { ALLOWED, makeApp, makeClock, makeUpstream, newBase, call, jsonResponse } from './helpers.js';
import { gdeltAnswer } from './fixtures/gdelt.js';

const quietApp = () => {
  const clock = makeClock();
  const upstream = makeUpstream({ clock, gdelt: () => jsonResponse(gdeltAnswer(3)) });
  return { app: makeApp({ upstream, clock }), upstream, clock };
};

describe('the Worker as deployed', () => {
  it('reads ALLOWED_ORIGINS from wrangler.toml and leaves CONTACT to the dashboard', () => {
    expect(env.ALLOWED_ORIGINS).toBe('https://rishabh1804.github.io,https://app.somaelectro.co.in');
    expect(env.CONTACT).toBeUndefined();
  });

  it('answers /health with ok, the time and whether CONTACT is set', async () => {
    const res = await SELF.fetch('https://feeds.test/health', { headers: { Origin: 'https://app.somaelectro.co.in' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.somaelectro.co.in');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Math.abs(Date.parse(body.at) - Date.now())).toBeLessThan(60000);
    expect(body.contact).toBe(false);
  });

  it('refuses the weather while CONTACT is not set, without asking MET', async () => {
    const res = await SELF.fetch('https://feeds.test/weather?lat=22.79&lon=86.15', { headers: { Origin: ALLOWED } });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'CONTACT is not set on the Worker' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
  });

  it('answers any other path 404', async () => {
    for (const path of ['/', '/news/', '/healthz', '/__cache/v1/news?topics=tata-cv', '/weather/x']) {
      const res = await SELF.fetch(`https://feeds.test${path}`);
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not found' });
    }
  });
});

describe('/health', () => {
  it('says contact: true once CONTACT is set, on the clock it is given', async () => {
    const { app, clock } = quietApp();
    const { res, body } = await call(app, newBase(), '/health');
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, at: new Date(clock.t).toISOString(), contact: true });
  });

  it('reads a CONTACT of spaces as not set', async () => {
    const { app } = quietApp();
    const { body } = await call(app, newBase(), '/health', { vars: { CONTACT: '   ' } });
    expect(body.contact).toBe(false);
  });
});

describe('methods', () => {
  it('answers only GET (and OPTIONS)', async () => {
    const { app } = quietApp();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
      const { res } = await call(app, newBase(), '/news?topics=tata-cv', { method });
      expect(res.status, method).toBe(405);
      expect(res.headers.get('Allow')).toBe('GET, OPTIONS');
    }
  });
});

describe('CORS', () => {
  it('echoes an allowed Origin, with Vary: Origin, on every answer', async () => {
    const { app } = quietApp();
    const base = newBase();
    for (const origin of ['https://rishabh1804.github.io', 'https://app.somaelectro.co.in']) {
      for (const path of ['/health', '/news?topics=tata-cv', '/news?topics=nope', '/nowhere']) {
        const { res } = await call(app, base, path, { origin });
        expect(res.headers.get('Access-Control-Allow-Origin'), `${origin} ${path}`).toBe(origin);
        expect(res.headers.get('Vary')).toBe('Origin');
      }
    }
  });

  it('gives any other Origin no CORS header at all', async () => {
    const { app } = quietApp();
    const base = newBase();
    for (const origin of ['https://evil.example', 'https://rishabh1804.github.io.evil.example', 'http://rishabh1804.github.io', 'null']) {
      const { res } = await call(app, base, '/news?topics=tata-cv', { origin });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin'), origin).toBeNull();
      expect(res.headers.get('Vary')).toBe('Origin');
      for (const [name] of res.headers) expect(name.startsWith('access-control-'), name).toBe(false);
    }
  });

  it('answers a request with no Origin (not a browser) without CORS headers', async () => {
    const { app } = quietApp();
    const { res } = await call(app, newBase(), '/health', { origin: null });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('reads ALLOWED_ORIGINS with spaces, case and a closing slash as the same list', async () => {
    const { app } = quietApp();
    const vars = { ALLOWED_ORIGINS: ' https://App.Somaelectro.co.in/ , ,https://x.example ' };
    const { res } = await call(app, newBase(), '/health', { origin: 'https://app.somaelectro.co.in', vars });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.somaelectro.co.in');
    const refused = await call(app, newBase(), '/health', { origin: ALLOWED, vars });
    expect(refused.res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers a preflight from an allowed Origin', async () => {
    const { app, upstream } = quietApp();
    const { res, body } = await call(app, newBase(), '/news?topics=tata-cv', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'content-type, x-sep-build' },
    });
    expect(res.status).toBe(204);
    expect(body).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('content-type, x-sep-build');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('7200');
    expect(res.headers.get('Vary')).toBe('Origin');
    expect(upstream.calls).toHaveLength(0);
  });

  it('refuses a preflight from any other Origin by leaving every CORS header off', async () => {
    const { app } = quietApp();
    const { res } = await call(app, newBase(), '/weather?lat=1&lon=1', {
      method: 'OPTIONS',
      origin: 'https://evil.example',
      headers: { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(res.status).toBe(204);
    for (const [name] of res.headers) expect(name.startsWith('access-control-'), name).toBe(false);
  });

  it('does not echo a request-headers list that is not a list of header names', async () => {
    const { app } = quietApp();
    const { res } = await call(app, newBase(), '/health', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Headers': 'content-type, <script>' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(res.headers.get('Access-Control-Allow-Headers')).toBeNull();
  });
});

describe("the answers' own caching", () => {
  it('lets a browser keep news and weather five minutes, and never an error or /health', async () => {
    const { app } = quietApp();
    const base = newBase();
    const ok = await call(app, base, '/news?topics=tata-cv');
    expect(ok.res.status).toBe(200);
    expect(ok.res.headers.get('Cache-Control')).toBe('max-age=300');
    expect(ok.res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    for (const path of ['/health', '/news?topics=nope', '/weather?lat=x&lon=1', '/nowhere']) {
      const { res } = await call(app, base, path);
      expect(res.headers.get('Cache-Control'), path).toBe('no-store');
    }
  });
});

describe('a fault in the Worker itself', () => {
  it('answers 500 with CORS, and says nothing of the fault to the browser', async () => {
    const clock = makeClock();
    const app = makeApp({
      clock,
      upstream: makeUpstream({ clock }),
      now: () => {
        throw new Error('clock broke');
      },
    });
    const { res, body } = await call(app, newBase(), '/health');
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'The feeds Worker failed' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(app.logs.join('\n')).toContain('clock broke');
  });
});
