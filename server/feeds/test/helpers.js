// What every test file shares: the Worker built with a fake upstream, a clock the test moves,
// and a request run through its own execution context. Nothing here reaches the network.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { createApp } from '../src/index.js';

export const ALLOWED = 'https://rishabh1804.github.io';
export const CONTACT = 'ops@example.com';

// A clock that only moves when the test (or the Worker's sleep) moves it.
export function makeClock(startIso = '2026-10-16T04:10:00Z') {
  const c = { t: Date.parse(startIso), sleeps: [] };
  c.now = () => c.t;
  c.sleep = async (ms) => {
    c.sleeps.push(ms);
    c.t += ms;
  };
  c.advance = (ms) => {
    c.t += ms;
  };
  return c;
}

// The topic a GDELT request is for, read back from its query.
export function topicOf(url) {
  const q = url.searchParams.get('query') || '';
  if (q.includes('jamshedpur')) return 'tata-plant';
  if (q.includes('exports')) return 'tata-exports';
  if (q.includes('sourcecountry')) return 'tata-cv';
  if (q.includes('"tata ')) return 'tata-models';
  return null;
}

export const jsonResponse = (body, init = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: init.status || 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

// A fake fetch: `gdelt(url, call)` and `met(url, call)` answer for their hosts; every call is
// kept ({url, headers, at, topic}) so a test can say what the Worker asked and when.
export function makeUpstream({ gdelt, met, clock } = {}) {
  const calls = [];
  let open = 0;
  let maxOpen = 0;
  const fn = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const call = { url, headers: new Headers(init.headers || {}), at: clock ? clock.now() : Date.now(), signal: init.signal };
    if (url.hostname === 'api.gdeltproject.org') call.topic = topicOf(url);
    calls.push(call);
    open += 1;
    maxOpen = Math.max(maxOpen, open);
    try {
      const route = url.hostname === 'api.gdeltproject.org' ? gdelt : url.hostname === 'api.met.no' ? met : null;
      if (!route) throw new Error(`the test reached an unexpected host: ${url.href}`);
      return await route(url, call);
    } finally {
      open -= 1;
    }
  };
  fn.calls = calls;
  fn.gdeltCalls = () => calls.filter((c) => c.url.hostname === 'api.gdeltproject.org');
  fn.metCalls = () => calls.filter((c) => c.url.hostname === 'api.met.no');
  fn.maxOpen = () => maxOpen;
  return fn;
}

// The Worker with a fake upstream and clock. GDELT's 6 s spacing is kept (the clock's sleep
// moves time on at once, so nothing waits).
export function makeApp({ upstream, clock, ...rest } = {}) {
  const logs = [];
  const app = createApp({ fetch: upstream, now: clock.now, sleep: clock.sleep, log: (l) => logs.push(l), ...rest });
  app.logs = logs;
  return app;
}

// Each test asks on a host of its own, so no test can meet another's cached copy.
export function newBase() {
  return `https://t-${crypto.randomUUID().slice(0, 8)}.feeds.test`;
}

// One request: {res, body, ctx, settle()}; settle() waits for what ctx.waitUntil was given.
export async function call(app, base, path, { origin = ALLOWED, method = 'GET', headers = {}, vars = { CONTACT } } = {}) {
  const ctx = createExecutionContext();
  const h = new Headers(headers);
  if (origin) h.set('Origin', origin);
  const res = await app.fetch(new Request(base + path, { method, headers: h }), { ...env, ...vars }, ctx);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, ctx, settle: () => waitOnExecutionContext(ctx) };
}

// A promise the test resolves when it chooses, to hold an upstream open.
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
