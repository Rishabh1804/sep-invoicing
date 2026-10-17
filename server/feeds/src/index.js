// sep-feeds: the news and the weather for SEP Invoicing's Home (docs/UI_PASS_3.md §9a).
//
//   GET /health                    → {ok: true, at, contact}
//   GET /news?topics=…&models=…    → {at, topics: {<id>: {at, items: [{title, url, source, at, lang}]}}, credit}
//   GET /weather?lat=…&lon=…       → {at, updated, lat, lon, hours, days, credit}
//   OPTIONS on any of the three    → the CORS preflight
//
// What it fetched is kept in Cloudflare's cache (caches.default), one copy a normalised URL,
// with the time it is due for a refresh. A request is answered from the copy at once; a copy
// that is due (news: 30 minutes old; weather: past MET's Expires) is refreshed behind the
// answer, inside ctx.waitUntil, and the next request gets the new one. With no copy at all the
// Worker fetches before answering. An upstream that fails leaves the copy served with
// stale: true; with no copy, 503 {error}. No database, no binding, no secret.

import { NEWS_CREDIT, NEWS_GAP_MS, NEWS_BUDGET_MS, parseTopics, parseModels, refreshNews } from './news.js';
import { WEATHER_CREDIT, parsePlace, cleanContact, fetchForecast, weatherAnswer } from './weather.js';
import { UpstreamError, iso } from './upstream.js';

const RECORD_VERSION = 1;
const NEWS_TTL_MS = 30 * 60000;
// After a refresh that failed, the next try waits this long (or what MET's Retry-After asks, up
// to an hour): a copy past due is not refreshed on every request while its source is down.
const RETRY_MS = 5 * 60000;
// MET's Expires, held between a minute and six hours; 30 minutes when it sends none.
const EXPIRES_MIN_MS = 60000;
const EXPIRES_MAX_MS = 6 * 3600000;
const EXPIRES_DEFAULT_MS = 30 * 60000;
const RETRY_AFTER_MAX_MS = 3600000;
// How long Cloudflare may keep a copy: long, since the copy is what is served while a source is down.
const KEEP_S = 7 * 24 * 3600;
// The answers' own caching: five minutes in the browser for news and weather; never for
// /health (Settings' Check asks the Worker itself) or an error (a retry must reach the Worker).
const ANSWER_CACHE = 'max-age=300';
const NO_STORE = 'no-store';
const ROUTES = new Set(['/health', '/news', '/weather']);
const HEADER_LIST_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+(?:\s*,\s*[A-Za-z0-9!#$%&'*+.^_`|~-]+)*$/;

// The app's homes, from ALLOWED_ORIGINS: a comma list, compared without case or a closing slash.
function allowedOrigins(env) {
  return String((env && env.ALLOWED_ORIGINS) || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

// Every answer varies by Origin; only a listed Origin is echoed back.
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const h = { Vary: 'Origin' };
  if (origin && allowedOrigins(env).includes(origin.toLowerCase())) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function preflight(request, cors) {
  const h = { ...cors, 'Cache-Control': NO_STORE };
  if (cors['Access-Control-Allow-Origin']) {
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    const asked = request.headers.get('Access-Control-Request-Headers');
    if (asked && HEADER_LIST_RE.test(asked.trim())) h['Access-Control-Allow-Headers'] = asked.trim();
    h['Access-Control-Max-Age'] = '7200';
  }
  return new Response(null, { status: 204, headers: h });
}

function reply(status, body, cors, cacheControl, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheControl,
      ...cors,
      ...extra,
    },
  });
}

// A query parameter given twice reads as one comma list.
const param = (url, name) => (url.searchParams.has(name) ? url.searchParams.getAll(name).join(',') : null);

function dueFromExpires(expires, t) {
  if (!Number.isFinite(expires)) return t + EXPIRES_DEFAULT_MS;
  return Math.min(Math.max(expires, t + EXPIRES_MIN_MS), t + EXPIRES_MAX_MS);
}

// `deps` lets the tests hand the Worker its upstream, its clock and its sleep; the deployed
// Worker uses the defaults.
export function createApp(deps = {}) {
  const upstream = deps.fetch || ((input, init) => fetch(input, init));
  const now = deps.now || (() => Date.now());
  const sleep = deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const gapMs = deps.gapMs ?? NEWS_GAP_MS;
  const budgetMs = deps.budgetMs ?? NEWS_BUDGET_MS;
  const log = deps.log || ((line) => console.log(line));
  const cacheOf = () => deps.cache || caches.default;
  const inflight = new Map(); // one refresh at a time per copy, in this isolate

  async function readRecord(keyReq) {
    try {
      const res = await cacheOf().match(keyReq);
      if (!res) return null;
      const rec = await res.json();
      return rec && rec.v === RECORD_VERSION && typeof rec.due === 'number' ? rec : null;
    } catch (e) {
      log(`cache read failed: ${e && e.message}`);
      return null;
    }
  }

  // Runs `refresh(prev)` (which never throws: a failure is a record too) and keeps what it gives.
  function run(key, keyReq, prev, refresh) {
    let p = inflight.get(key);
    if (!p) {
      p = (async () => {
        const rec = await refresh(prev);
        try {
          await cacheOf().put(
            keyReq,
            new Response(JSON.stringify(rec), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${KEEP_S}` },
            }),
          );
        } catch (e) {
          log(`cache write failed: ${e && e.message}`);
        }
        return rec;
      })().finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  }

  const keep = (ctx, p) => {
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p.catch((e) => log(`refresh failed: ${e && e.message}`)));
  };

  // The copy, or a fetch for one. Returns {status, body}.
  async function serve({ key, ctx, refresh, answer }) {
    const keyReq = new Request(key);
    const rec = await readRecord(keyReq);
    const t = now();
    if (rec && rec.data) {
      if (t >= rec.due) keep(ctx, run(key, keyReq, rec, refresh));
      return { status: 200, body: answer(rec, t) };
    }
    // A fetch that failed with no copy to fall back on is not tried again until its retry is due.
    if (rec && t < rec.due) return { status: 503, body: { error: rec.error } };
    const p = run(key, keyReq, rec, refresh);
    keep(ctx, p); // a client that gives up waiting does not cancel the fetch: the next request gets it
    const fresh = await p;
    if (fresh.data) return { status: 200, body: answer(fresh, now()) };
    return { status: 503, body: { error: fresh.error } };
  }

  async function news(url, ctx) {
    const t = parseTopics(param(url, 'topics'));
    if (t.error) return { status: 400, body: { error: t.error } };
    const m = parseModels(param(url, 'models'));
    if (m.error) return { status: 400, body: { error: m.error } };
    const wantsModels = t.topics.includes('tata-models');
    if (wantsModels && !m.models.length) return { status: 400, body: { error: 'models is needed for tata-models' } };
    const topics = t.topics;
    const models = wantsModels ? m.models : []; // the other topics do not read them, so neither does the key
    const query = new URLSearchParams();
    if (models.length) query.set('models', models.join(','));
    query.set('topics', topics.join(','));
    return serve({
      key: `${url.origin}/__cache/v${RECORD_VERSION}/news?${query}`,
      ctx,
      refresh: async (prev) => {
        const before = prev && prev.data;
        const r = await refreshNews({ fetch: upstream, now, sleep, gapMs, budgetMs, topics, models, prev: before && before.topics, log });
        const at = now();
        if (r.failed === topics.length) {
          const error = r.topics[topics[0]].error;
          if (!before) return { v: RECORD_VERSION, due: at + RETRY_MS, data: null, error };
          return { v: RECORD_VERSION, due: at + RETRY_MS, data: { at: before.at, topics: r.topics } };
        }
        return { v: RECORD_VERSION, due: at + (r.failed ? RETRY_MS : NEWS_TTL_MS), data: { at: r.at, topics: r.topics } };
      },
      answer: (rec) => {
        const body = { at: rec.data.at, topics: rec.data.topics, credit: NEWS_CREDIT };
        if (Object.values(rec.data.topics).some((x) => x.stale)) body.stale = true;
        return body;
      },
    });
  }

  async function weather(url, env, ctx) {
    const place = parsePlace(url.searchParams.get('lat'), url.searchParams.get('lon'));
    if (place.error) return { status: 400, body: { error: place.error } };
    // MET's terms want a contact in the User-Agent; without one the Worker does not ask MET.
    const contact = cleanContact(env && env.CONTACT);
    if (!contact) return { status: 503, body: { error: 'CONTACT is not set on the Worker' } };
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    return serve({
      key: `${url.origin}/__cache/v${RECORD_VERSION}/weather?lat=${place.lat}&lon=${place.lon}`,
      ctx,
      refresh: async (prev) => {
        const before = prev && prev.data;
        try {
          const r = await fetchForecast({
            fetch: upstream,
            lat: place.lat,
            lon: place.lon,
            contact,
            lastModified: before ? prev.lastModified : null,
            nowMs: now(),
          });
          const at = now();
          if (r.same) {
            if (!before) throw new UpstreamError('MET Norway answered 304 with no copy here');
            return { v: RECORD_VERSION, due: dueFromExpires(r.expires, at), lastModified: r.lastModified, data: { ...before, at: iso(at) } };
          }
          return {
            v: RECORD_VERSION,
            due: dueFromExpires(r.expires, at),
            lastModified: r.lastModified,
            data: { at: iso(at), updated: r.updated, series: r.series },
          };
        } catch (e) {
          const at = now();
          const error = e instanceof UpstreamError ? e.message : 'MET Norway answered something this Worker could not read';
          log(`weather ${place.lat},${place.lon}: ${error}`);
          const due = at + Math.max(RETRY_MS, Math.min((e && e.retryAfterMs) || 0, RETRY_AFTER_MAX_MS));
          if (!before) return { v: RECORD_VERSION, due, data: null, error };
          return { ...prev, v: RECORD_VERSION, due, stale: true, error };
        }
      },
      answer: (rec, t) => {
        const body = { at: rec.data.at, updated: rec.data.updated, lat, lon, ...weatherAnswer(rec.data, t), credit: WEATHER_CREDIT };
        if (rec.stale) {
          body.stale = true;
          body.error = rec.error;
        }
        return body;
      },
    });
  }

  return {
    async fetch(request, env, ctx) {
      const cors = corsHeaders(request, env);
      try {
        const url = new URL(request.url);
        if (!ROUTES.has(url.pathname)) return reply(404, { error: 'Not found' }, cors, NO_STORE);
        if (request.method === 'OPTIONS') return preflight(request, cors);
        if (request.method !== 'GET') {
          return reply(405, { error: 'Only GET is answered' }, cors, NO_STORE, { Allow: 'GET, OPTIONS' });
        }
        if (url.pathname === '/health') {
          return reply(200, { ok: true, at: iso(now()), contact: Boolean(cleanContact(env && env.CONTACT)) }, cors, NO_STORE);
        }
        const out = url.pathname === '/news' ? await news(url, ctx) : await weather(url, env, ctx);
        return reply(out.status, out.body, cors, out.status === 200 ? ANSWER_CACHE : NO_STORE);
      } catch (e) {
        log(`failed: ${e && e.stack ? e.stack : e}`);
        return reply(500, { error: 'The feeds Worker failed' }, cors, NO_STORE);
      }
    },
  };
}

export default createApp();
