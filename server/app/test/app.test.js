// The Worker as deployed (SELF: the default export, with wrangler.toml's vars and the assets binding over dist/).
import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { CSP, SECURITY_HEADERS } from '../src/index.js';

const APP = 'https://app.somaelectro.co.in';

describe('one origin', () => {
  it('reads APP_HOST from wrangler.toml', () => {
    expect(env.APP_HOST).toBe('app.somaelectro.co.in');
  });

  it('sends its workers.dev address, a preview and plain http to the custom domain, path and query kept', async () => {
    for (const from of ['https://sep-app.someone.workers.dev', 'https://1a2b3c4d-sep-app.someone.workers.dev', 'http://app.somaelectro.co.in']) {
      const res = await SELF.fetch(from + '/?tab=pageCreate', { redirect: 'manual' });
      expect(res.status, from).toBe(308);
      expect(res.headers.get('Location')).toBe(APP + '/?tab=pageCreate');
    }
  });

  it('sends the old path to the root', async () => {
    const res = await SELF.fetch(APP + '/sep-invoicing/?tab=pageIM&new=1', { redirect: 'manual' });
    expect(res.status).toBe(308);
    expect(res.headers.get('Location')).toBe(APP + '/?tab=pageIM&new=1');
  });
});

describe('only the app', () => {
  it('serves the page, the worker, the manifest, the stamp and the widget template', async () => {
    const page = await SELF.fetch(APP + '/');
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Type')).toMatch(/text\/html/);
    expect(await page.text()).toContain('var MOVE_NEW_ORIGIN = \'https://app.somaelectro.co.in\';');
    for (const p of ['/sw.js', '/manifest.json', '/version.json', '/widgets/todo-template.json', '/icons/icon-zinc.svg', '/favicon-32.png']) {
      const res = await SELF.fetch(APP + p);
      expect(res.status, p).toBe(200);
    }
  });

  it('serves no CLAUDE.md, no docs, no sources, no tests and no checkin.html', async () => {
    for (const p of ['/CLAUDE.md', '/AGENTS.md', '/docs/SERVER.md', '/docs/atlas/INDEX.md', '/split/move.js', '/split/build.sh', '/tests/e2e/server.mjs',
      '/server/app/src/index.js', '/package.json', '/checkin.html', '/sep-invoicing.html', '/.gitignore']) {
      const res = await SELF.fetch(APP + p);
      expect(res.status, p).toBe(404);
    }
  });

  it('refuses any method but GET and HEAD', async () => {
    const res = await SELF.fetch(APP + '/', { method: 'POST', body: 'x' });
    expect(res.status).toBe(405);
  });
});

describe('the headers', () => {
  it('every answer carries them, a 404 and a redirect too', async () => {
    for (const [url, init] of [[APP + '/'], [APP + '/sw.js'], [APP + '/docs/SERVER.md'], ['https://sep-app.someone.workers.dev/', { redirect: 'manual' }]]) {
      const res = await SELF.fetch(url, init);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(k), url + ' ' + k).toBe(v);
    }
  });

  it('frames nothing and is framed by nothing; scripts only its own; never a COOP that would cut the handover', async () => {
    const res = await SELF.fetch(APP + '/');
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("frame-src 'none'");
    expect(CSP).toContain("object-src 'none'");
    expect(CSP).toMatch(/script-src 'self' 'unsafe-inline'(;|$)/);
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBeNull();
  });

  it('lets the app reach every host it calls, and the error reports reach Sentry', async () => {
    const connect = CSP.split('; ').find((d) => d.startsWith('connect-src '));
    for (const h of ['https://api.github.com', 'https://api.anthropic.com', 'https://api.metals.dev', 'https://feeds.somaelectro.co.in',
      'https://api.gdeltproject.org', 'https://api.met.no', 'https://nominatim.openstreetmap.org', 'https://o4511273636855808.ingest.de.sentry.io']) {
      expect(connect, h).toContain(' ' + h);
    }
  });
});
